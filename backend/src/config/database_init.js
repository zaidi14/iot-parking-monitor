import { initDatabase, initViolationLogs } from './database.js';

export async function initAllTables() {
  await initDatabase();
  await initViolationLogs();
}
