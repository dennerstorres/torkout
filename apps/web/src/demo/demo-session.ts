import { createUserSyncDatabase, deleteUserSyncDatabase } from '../sync/local-database';
import { buildDemoRecords } from './demo-seed';
import { DEMO_USER_ID } from './demo-sync';

/**
 * Semeia a réplica da demonstração e a deixa pronta para uso. Recomeçar apaga o que existia antes,
 * para que o visitante volte sempre ao mesmo ponto de partida.
 */
export async function startDemo(today = new Date()): Promise<void> {
  await discardDemoReplica();
  const database = createUserSyncDatabase(DEMO_USER_ID);
  await database.records.bulkPut(buildDemoRecords(today));
  database.close();
}

/**
 * Apaga a réplica da demonstração. É chamada ao sair, ao recomeçar e sempre que uma conta real
 * assume a sessão, para que nenhum resíduo de demonstração conviva com dados de verdade.
 */
export async function discardDemoReplica(): Promise<void> {
  await deleteUserSyncDatabase(DEMO_USER_ID);
}

export async function hasDemoReplica(): Promise<boolean> {
  const databases = await indexedDB.databases();
  return databases.some((entry) => entry.name === `torkout-replica-v1-${DEMO_USER_ID}`);
}
