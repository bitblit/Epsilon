import { SaltMineEntry } from './salt-mine-entry';

/**
 * This interface defines the things the salt mine queue manager can do
 */
export interface SaltMineQueueManager {
  validType(type: string): boolean;
  createEntry(type: string, data?: any, metadata?: any): SaltMineEntry;
  validEntry(entry: SaltMineEntry): boolean;
  addEntryToQueue(entry: SaltMineEntry, fireStartMessage?: boolean): Promise<string>;
  addEntriesToQueue(entries: SaltMineEntry[], fireStartMessage?: boolean): Promise<string[]>;
  fireImmediateProcessRequest(entry: SaltMineEntry): Promise<string>;
  fireStartProcessingRequest(): Promise<string>;
  fetchApproximateNumberOfQueueEntries(): Promise<number>;
}
