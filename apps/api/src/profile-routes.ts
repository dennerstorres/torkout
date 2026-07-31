import {
  bodyMeasurements,
  habitDefinitions,
  habitOptions,
  userProfiles,
  users,
} from '@torkout/database';
import { profileUpdateSchema } from '@torkout/contracts';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';

const initialHabits = {
  coffee: {
    name: 'Café',
    options: [
      ['Não consumido', 'none'],
      ['Sem açúcar', 'no_sugar'],
      ['Com açúcar', 'with_sugar'],
    ],
  },
  protein: {
    name: 'Proteína',
    options: [
      ['Não consumida', 'none'],
      ['Uma porção', 'one_portion'],
      ['Duas ou mais porções', 'multiple_portions'],
    ],
  },
  rice: {
    name: 'Arroz',
    options: [
      ['Não consumido', 'none'],
      ['Reduzido', 'reduced'],
      ['Habitual', 'usual'],
      ['Aumentado', 'increased'],
    ],
  },
  salad: {
    name: 'Salada',
    options: [
      ['Não consumida', 'none'],
      ['Uma porção', 'one_portion'],
      ['Duas ou mais porções', 'multiple_portions'],
    ],
  },
} as const;

function civilDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function registerProfileRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get('/api/v1/profile', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const [profile] = await dependencies.database
      .select({
        displayName: users.name,
        goal: userProfiles.goal,
        heightCm: userProfiles.heightCm,
        locale: userProfiles.locale,
        preferredWorkoutTime: userProfiles.preferredWorkoutTime,
        timeZone: userProfiles.timeZone,
        unitSystem: userProfiles.unitSystem,
      })
      .from(userProfiles)
      .innerJoin(users, eq(users.id, userProfiles.userId))
      .where(eq(userProfiles.userId, user.id))
      .limit(1);
    if (!profile) throw new ApiHttpError(404, 'PROFILE_NOT_FOUND', 'Perfil ainda não criado.');
    return { ...profile, heightCm: profile.heightCm === null ? null : Number(profile.heightCm) };
  });

  app.put('/api/v1/profile', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Dados de perfil inválidos.');
    }
    const input = parsed.data;
    const now = new Date();

    await dependencies.database.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ name: input.displayName, updatedAt: now })
        .where(eq(users.id, user.id));
      await transaction
        .insert(userProfiles)
        .values({
          goal: input.goal ?? null,
          heightCm: input.heightCm?.toString() ?? null,
          locale: input.locale,
          preferredWorkoutTime: input.preferredWorkoutTime ?? null,
          timeZone: input.timeZone,
          unitSystem: input.unitSystem,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
            goal: input.goal ?? null,
            heightCm: input.heightCm?.toString() ?? null,
            locale: input.locale,
            preferredWorkoutTime: input.preferredWorkoutTime ?? null,
            timeZone: input.timeZone,
            unitSystem: input.unitSystem,
            updatedAt: now,
          },
          target: userProfiles.userId,
        });

      if (input.initialWeightKg || input.initialWaistCm) {
        await transaction.insert(bodyMeasurements).values({
          localDate: civilDate(now, input.timeZone),
          measuredAt: now,
          userId: user.id,
          waistCm: input.initialWaistCm?.toString(),
          weightKg: input.initialWeightKg?.toString(),
        });
      }

      const knownNames = Object.values(initialHabits).map((habit) => habit.name);
      await transaction
        .update(habitDefinitions)
        .set({ active: false, updatedAt: now })
        .where(
          and(eq(habitDefinitions.userId, user.id), inArray(habitDefinitions.name, knownNames)),
        );
      for (const habit of input.enabledInitialHabits) {
        const existing = await transaction
          .update(habitDefinitions)
          .set({ active: true, type: 'choice', unit: null, updatedAt: now })
          .where(
            and(
              eq(habitDefinitions.userId, user.id),
              eq(habitDefinitions.name, initialHabits[habit].name),
            ),
          )
          .returning({ id: habitDefinitions.id });
        let definitionId = existing[0]?.id;
        if (!definitionId) {
          const [created] = await transaction
            .insert(habitDefinitions)
            .values({
              active: true,
              name: initialHabits[habit].name,
              sortOrder: Object.keys(initialHabits).indexOf(habit),
              type: 'choice',
              userId: user.id,
            })
            .returning({ id: habitDefinitions.id });
          if (!created) throw new Error('Initial habit insert did not return a row.');
          definitionId = created.id;
        }
        await transaction
          .insert(habitOptions)
          .values(
            initialHabits[habit].options.map(([label, stableValue], sortOrder) => ({
              habitDefinitionId: definitionId,
              label,
              sortOrder,
              stableValue,
              userId: user.id,
            })),
          )
          .onConflictDoUpdate({
            set: { deletedAt: null, updatedAt: now },
            target: [habitOptions.habitDefinitionId, habitOptions.stableValue],
          });
      }
    });

    return {
      displayName: input.displayName,
      goal: input.goal ?? null,
      heightCm: input.heightCm ?? null,
      locale: input.locale,
      preferredWorkoutTime: input.preferredWorkoutTime ?? null,
      timeZone: input.timeZone,
      unitSystem: input.unitSystem,
    };
  });
}
