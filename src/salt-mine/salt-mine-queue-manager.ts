import { SaltMineEntry } from './salt-mine-entry';
import { SaltMineEntryValidator } from './salt-mine-entry-validator';

/**
 * This interface defines the things the salt mine queue manager can do
 */
export interface SaltMineQueueManager {
  validator(): SaltMineEntryValidator;
  addEntryToQueue(entry: SaltMineEntry, fireStartMessage?: boolean): Promise<string>;
  addEntriesToQueue(entries: SaltMineEntry[], fireStartMessage?: boolean): Promise<string[]>;
  fireImmediateProcessRequest(entry: SaltMineEntry): Promise<string>;
  fireStartProcessingRequest(): Promise<string>;
  fetchApproximateNumberOfQueueEntries(): Promise<number>;
}
