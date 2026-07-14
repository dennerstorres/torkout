import { bodyMeasurements, habitDefinitions, userProfiles, users } from '@torkout/database';
import { profileUpdateSchema } from '@torkout/contracts';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';

const initialHabits = {
  coffee: 'Café',
  protein: 'Proteína',
  rice: 'Arroz',
  salad: 'Salada',
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
          heightCm: input.heightCm?.toString() ?? null,
          locale: input.locale,
          preferredWorkoutTime: input.preferredWorkoutTime ?? null,
          timeZone: input.timeZone,
          unitSystem: input.unitSystem,
          userId: user.id,
        })
        .onConflictDoUpdate({
          set: {
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

      const knownNames = Object.values(initialHabits);
      await transaction
        .update(habitDefinitions)
        .set({ active: false, updatedAt: now })
        .where(
          and(eq(habitDefinitions.userId, user.id), inArray(habitDefinitions.name, knownNames)),
        );
      for (const habit of input.enabledInitialHabits) {
        const existing = await transaction
          .update(habitDefinitions)
          .set({ active: true, updatedAt: now })
          .where(
            and(
              eq(habitDefinitions.userId, user.id),
              eq(habitDefinitions.name, initialHabits[habit]),
            ),
          )
          .returning({ id: habitDefinitions.id });
        if (existing.length === 0) {
          await transaction.insert(habitDefinitions).values({
            active: true,
            name: initialHabits[habit],
            type: 'boolean',
            userId: user.id,
          });
        }
      }
    });

    return {
      displayName: input.displayName,
      heightCm: input.heightCm ?? null,
      locale: input.locale,
      preferredWorkoutTime: input.preferredWorkoutTime ?? null,
      timeZone: input.timeZone,
      unitSystem: input.unitSystem,
    };
  });
}
