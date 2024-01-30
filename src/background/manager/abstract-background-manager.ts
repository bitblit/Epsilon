import { ErrorRatchet, Logger, RequireRatchet, StringRatchet } from '@bitblit/ratchet/common';
import { BackgroundEntry } from '../background-entry';
import { InternalBackgroundEntry } from '../internal-background-entry';
import { DateTime } from 'luxon';
import { ContextUtil } from '../../util/context-util';
import { BackgroundManagerLike } from './background-manager-like';

/**
 * Handles all submission of work to the background processing system.
 *
 * Note that this does NOT validate the input, it just passes it along.  This is
 * because it creates a circular reference to the processors if we try since they
 * define the type and validation.
 */
export abstract class AbstractBackgroundManager implements BackgroundManagerLike {
  abstract addEntryToQueue<T>(entry: BackgroundEntry<T>, fireStartMessage?: boolean): Promise<string>;
  abstract fireImmediateProcessRequest<T>(entry: BackgroundEntry<T>): Promise<string>;
  abstract fireStartProcessingRequest(): Promise<string>;
  abstract fetchApproximateNumberOfQueueEntries(): Promise<number>;
  abstract get backgroundManagerName(): string;
  abstract takeEntryFromBackgroundQueue(): Promise<InternalBackgroundEntry<any>[]>;
  abstract populateInternalEntry<T>(entry: InternalBackgroundEntry<T>): Promise<InternalBackgroundEntry<T>>;

  public createEntry<T>(type: string, data?: T): BackgroundEntry<T> {
    const rval: BackgroundEntry<T> = {
      type: type,
      data: data,
    };
    return rval;
  }

  public wrapEntryForInternal<T>(
    entry: BackgroundEntry<T>,
    overrideTraceId?: string,
    overrideTraceDepth?: number,
  ): InternalBackgroundEntry<T> {
    const rval: InternalBackgroundEntry<T> = Object.assign({}, entry, {
      createdEpochMS: new Date().getTime(),
      guid: AbstractBackgroundManager.generateBackgroundGuid(),
      traceId: overrideTraceId || ContextUtil.currentTraceId(), // || cuz no empty strings allowed
      traceDepth: overrideTraceDepth || ContextUtil.currentTraceDepth() + 1, // || no 0 allowed either
    });
    return rval;
  }

  public async addEntryToQueueByParts<T>(type: string, data?: T, fireStartMessage?: boolean): Promise<string> {
    let rval: string = null;
    const entry: BackgroundEntry<T> = this.createEntry(type, data);
    if (entry) {
      rval = await this.addEntryToQueue(entry, fireStartMessage);
    }
    return rval;
  }

  public async addEntriesToQueue(entries: BackgroundEntry<any>[], fireStartMessage?: boolean): Promise<string[]> {
    const rval: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      try {
        // Always defer the fire to after the last enqueue
        const tmp: string = await this.addEntryToQueue(entries[i], false);
        rval.push(tmp);
      } catch (err) {
        Logger.error('Error processing %j : %s', entries[i], err);
        rval.push(err['message']);
      }

      if (fireStartMessage) {
        const fireResult: string = await this.fireStartProcessingRequest();
        Logger.silly('FireResult : %s', fireResult);
      }
    }
    return rval;
  }

  public async fireImmediateProcessRequestByParts<T>(type: string, data?: T): Promise<string> {
    let rval: string = null;
    const entry: BackgroundEntry<T> = this.createEntry(type, data);
    if (entry) {
      rval = await this.fireImmediateProcessRequest(entry);
    }
    return rval;
  }

  public static generateBackgroundGuid(targetEpochMS: number = new Date().getTime()): string {
    const dt: DateTime = DateTime.fromMillis(targetEpochMS);
    return dt.toFormat('yyyy-MM-dd-HH-mm-ss-') + StringRatchet.createType4Guid();
  }

  public static backgroundGuidToPath(prefix: string, guid: string): string {
    let path: string = StringRatchet.trimToEmpty(prefix);
    if (path.length && !path.endsWith('/')) {
      path += '/';
    }
    path += guid.substring(0, 4) + '/' + guid.substring(5, 7) + '/' + guid.substring(8, 10) + '/';
    path += guid + '.json';
    return path;
  }

  public static pathToBackgroundGuid(prefix: string, path: string): string {
    RequireRatchet.notNullOrUndefined(path, 'path');
    let start: number = 0;
    if (!path.endsWith('.json')) {
      ErrorRatchet.throwFormattedErr('Cannot extract guid, does not end with .json : %s : %s', path, prefix);
    }
    if (StringRatchet.trimToNull(prefix)) {
      if (!path.startsWith(prefix)) {
        ErrorRatchet.throwFormattedErr('Cannot extract guid, does not start with prefix : %s : %s', path, prefix);
      }
      start = prefix.length;
      if (!prefix.endsWith('/')) {
        start++;
      }
    }
    start += 11;
    return path.substring(start, path.length - 5); // strip prefix and .json at the end
  }
}
