import { BackgroundEntry } from '../background-entry';
import { InternalBackgroundEntry } from '../internal-background-entry';
import { Subject } from 'rxjs';

/**
 * Classes implementing this interface handle all submission of work to the background processing system.
 *
 * Note that these do NOT validate the input, they just passes it along.  This is
 * because it creates a circular reference to the processors if we try since they
 * define the type and validation.
 */
export interface BackgroundManagerLike {
  // Used in info dumps and logging
  get backgroundManagerName(): string;
  // If the class defines this, other classes can register to be notified the instant anything arrives in the queue
  immediateProcessQueue?(): Subject<InternalBackgroundEntry<any>>;
  // Wraps up an entry
  createEntry<T>(type: string, data?: T): BackgroundEntry<T>;
  // Wraps up an entry and adds internal control structures
  wrapEntryForInternal<T>(entry: BackgroundEntry<T>, overrideTraceId?: string, overrideTraceDepth?: number): InternalBackgroundEntry<T>;
  // Helper method to simplify building a request and add it to the queue
  addEntryToQueueByParts<T>(type: string, data?: T, fireStartMessage?: boolean): Promise<string>;
  // Add an entry to the queue for background processing, and optionally fire a start message after it is added
  addEntryToQueue<T>(entry: BackgroundEntry<T>, fireStartMessage?: boolean): Promise<string>;
  // Helper method to add more than one entry, and optionally fire a start message after all are added
  addEntriesToQueue(entries: BackgroundEntry<any>[], fireStartMessage?: boolean): Promise<string[]>;
  // Helper method to simplify building a request and then immediately run it in the background processor
  fireImmediateProcessRequestByParts<T>(type: string, data?: T): Promise<string>;
  // Immediately run a request in the background processor
  fireImmediateProcessRequest<T>(entry: BackgroundEntry<T>): Promise<string>;
  // Tell the processor to try reading the queue and start processing if anything is found
  fireStartProcessingRequest(): Promise<string>;
  // Check approximately how many entries are currently waiting in the queue
  fetchApproximateNumberOfQueueEntries(): Promise<number>;
  // Read a single entry from the background queue
  takeEntryFromBackgroundQueue(): Promise<InternalBackgroundEntry<any>[]>;
}
