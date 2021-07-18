import AWS from 'aws-sdk';
import { SaltMineEntry } from './salt-mine-entry';
import { GetQueueAttributesRequest, GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import { NumberRatchet, Logger, StringRatchet } from '@bitblit/ratchet/dist/common';
import { EpsilonConstants } from '../epsilon-constants';
import { SaltMineAwsConfig } from './salt-mine-aws-config';
import { SaltMineQueueUtil } from '../../dist';
import { SaltMineQueueManager } from './salt-mine-queue-manager';
import { SaltMineHandler } from './salt-mine-handler';

/**
 * This class just validates and puts items into the salt mine queue - it does not do
 * any processing.  It also does NOT start queue processing.  This is to prevent circular
 * dependencies - the SaltMineConfig holds references to all the processor functions, but
 * none of the processor functions hold references back, so they can make calls to the
 * adder or starter if necessary.
 */
export class LocalSaltMineQueueManager implements SaltMineQueueManager {
  constructor(private validTypes: string[], private saltMineHandler: SaltMineHandler) {}

  public validType(type: string): boolean {
    return this.validTypes.includes(type);
  }

  public createEntry(type: string, data: any = {}, metadata: any = {}): SaltMineEntry {
    if (!this.validType(type)) {
      Logger.warn('Tried to create invalid type : %s (Valid are %j)', type, this.validTypes);
      return null;
    }

    const rval: SaltMineEntry = {
      created: new Date().getTime(),
      type: type,
      data: data,
      metadata: metadata,
    };
    return rval;
  }

  public validEntry(entry: SaltMineEntry): boolean {
    return entry != null && entry.type != null && this.validType(entry.type);
  }

  public async addEntryToQueue(entry: SaltMineEntry, fireStartMessage?: boolean): Promise<string> {
    const rval: boolean = await this.saltMineHandler.processSingleSaltMineEntry(entry);
    return 'addEntryToQueue' + new Date().toISOString() + StringRatchet.safeString(rval);
  }

  public async addEntriesToQueue(entries: SaltMineEntry[], fireStartMessage?: boolean): Promise<string[]> {
    let rval: string[] = [];
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

  public async fireImmediateProcessRequest(entry: SaltMineEntry): Promise<string> {
    const rval: boolean = await this.saltMineHandler.processSingleSaltMineEntry(entry);
    return 'fireImmediateProcessRequest' + new Date().toISOString() + StringRatchet.safeString(rval);
  }

  public async fireStartProcessingRequest(): Promise<string> {
    return 'NO-OP';
  }

  public async fetchQueueApproximateNumberOfQueueEntries(): Promise<number> {
    return 0; // No queue when running locally
  }
}
