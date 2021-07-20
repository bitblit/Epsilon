import { BackgroundEntry } from './background-entry';
import { BackgroundEntryValidator } from './background-entry-validator';

/**
 * This interface defines the things the background queue manager can do
 */
export interface BackgroundQueueManager {
  validator(): BackgroundEntryValidator;
  addEntryToQueue(entry: BackgroundEntry, fireStartMessage?: boolean): Promise<string>;
  addEntriesToQueue(entries: BackgroundEntry[], fireStartMessage?: boolean): Promise<string[]>;
  fireImmediateProcessRequest(entry: BackgroundEntry): Promise<string>;
  fireStartProcessingRequest(): Promise<string>;
  fetchApproximateNumberOfQueueEntries(): Promise<number>;
}
