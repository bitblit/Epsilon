import { BackgroundEntry } from './background-entry';
import { Logger, StringRatchet } from '@bitblit/ratchet/dist/common';
import { BackgroundQueueManager } from './background-queue-manager';
import { BackgroundHandler } from './background-handler';
import { BackgroundEntryValidator } from './background-entry-validator';

/**
 * This class just validates and puts items into the background queue - it does not do
 * any processing.  It also does NOT start queue processing.  This is to prevent circular
 * dependencies - the BackgroundConfig holds references to all the processor functions, but
 * none of the processor functions hold references back, so they can make calls to the
 * adder or starter if necessary.
 */
export class LocalBackgroundQueueManager implements BackgroundQueueManager {
  constructor(private inValidator: BackgroundEntryValidator, private backgroundHandler: BackgroundHandler) {}

  public validator(): BackgroundEntryValidator {
    return this.inValidator;
  }

  public async addEntryToQueue(entry: BackgroundEntry, fireStartMessage?: boolean): Promise<string> {
    // Guard against bad entries up front
    this.inValidator.validateEntryAndThrowException(entry);

    const rval: boolean = await this.backgroundHandler.processSingleBackgroundEntry(entry);
    return 'addEntryToQueue' + new Date().toISOString() + StringRatchet.safeString(rval);
  }

  public async addEntriesToQueue(entries: BackgroundEntry[], fireStartMessage?: boolean): Promise<string[]> {
    const rval: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      try {
        const tmp: string = await this.addEntryToQueue(entries[i]);
        rval.push(tmp);
      } catch (err) {
        Logger.error('Error processing %j : %s', entries[i], err);
        rval.push(err.message);
      }
    }
    return rval;
  }

  public async fireImmediateProcessRequest(entry: BackgroundEntry): Promise<string> {
    // Guard against bad entries up front
    this.inValidator.validateEntryAndThrowException(entry);
    const rval: boolean = await this.backgroundHandler.processSingleBackgroundEntry(entry);
    return 'fireImmediateProcessRequest' + new Date().toISOString() + StringRatchet.safeString(rval);
  }

  public async fireStartProcessingRequest(): Promise<string> {
    return 'NO-OP';
  }

  public async fetchApproximateNumberOfQueueEntries(): Promise<number> {
    return 0; // No queue when running locally
  }
}
