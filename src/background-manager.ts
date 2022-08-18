import { Subject } from 'rxjs';
import { ErrorRatchet, Logger, NumberRatchet } from '@bitblit/ratchet/dist/common';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { GetQueueAttributesRequest, GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import AWS from 'aws-sdk';
import { BackgroundEntry } from './background/background-entry';
import { BackgroundAwsConfig } from './config/background/background-aws-config';
import { EpsilonConstants } from './epsilon-constants';
import { InternalBackgroundEntry } from './background/internal-background-entry';
import { DateTime } from 'luxon';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';
import { PromiseResult } from 'aws-sdk/lib/request';
import { AWSError } from 'aws-sdk/lib/error';
import { ContextUtil } from './util/context-util';

/**
 * Handles all submission of work to the background processing system.
 *
 * Note that this does NOT validate the input, it just passes it along.  This is
 * because it creates a circular reference to the processors if we try since they
 * define the type and validation.
 */
export class BackgroundManager {
  private _localBus: Subject<InternalBackgroundEntry<any>> = new Subject<InternalBackgroundEntry<any>>();
  private _localMode: boolean = false;

  constructor(private _awsConfig: BackgroundAwsConfig, private _sqs: AWS.SQS, private _sns: AWS.SNS) {}

  public get awsConfig(): BackgroundAwsConfig {
    return this._awsConfig;
  }

  public get sqs(): AWS.SQS {
    return this._sqs;
  }

  public get sns(): AWS.SNS {
    return this._sns;
  }

  public get localMode(): boolean {
    return this._localMode;
  }

  public set localMode(newVal: boolean) {
    Logger.info('Setting local-mode for background processing to : %s', newVal);
    this._localMode = newVal;
  }

  public localBus(): Subject<InternalBackgroundEntry<any>> {
    return this._localBus;
  }

  public createEntry<T>(type: string, data?: T): BackgroundEntry<T> {
    const rval: BackgroundEntry<T> = {
      type: type,
      data: data,
    };
    return rval;
  }

  public wrapEntryForInternal<T>(entry: BackgroundEntry<T>): InternalBackgroundEntry<T> {
    const rval: InternalBackgroundEntry<T> = Object.assign({}, entry, {
      createdEpochMS: new Date().getTime(),
      guid: BackgroundManager.generateBackgroundGuid(),
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

  public async addEntryToQueue<T>(entry: BackgroundEntry<T>, fireStartMessage?: boolean): Promise<string> {
    const wrapped: InternalBackgroundEntry<T> = this.wrapEntryForInternal(entry);
    const rval: string = wrapped.guid;
    if (this.localMode) {
      Logger.info('Add entry to queue (local) : %j : Start : %s', entry, fireStartMessage);
      this._localBus.next(wrapped);
    } else {
      // Guard against bad entries up front
      const params = {
        DelaySeconds: 0,
        MessageBody: JSON.stringify(wrapped),
        MessageGroupId: entry.type,
        QueueUrl: this.awsConfig.queueUrl,
      };

      Logger.info('Add entry to queue (remote) : %j : Start : %s', params, fireStartMessage);
      const result: PromiseResult<AWS.SQS.Types.SendMessageResult, AWSError> = await this.sqs.sendMessage(params).promise();

      const error = result?.$response?.error;
      if (error) {
        Logger.error('Error inserting background entry into SQS queue : %j', error);
        throw new Error('Error inserting background entry into SQS queue : ' + error.code + ' : ' + error.name);
      }

      if (fireStartMessage) {
        const fireResult: string = await this.fireStartProcessingRequest();
        Logger.silly('FireResult : %s', fireResult);
      }

      Logger.info('Background process %s using message id %s', rval, result.MessageId);
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

  public async fireImmediateProcessRequest<T>(entry: BackgroundEntry<T>): Promise<string> {
    let rval: string = null;
    const wrapped: InternalBackgroundEntry<T> = this.wrapEntryForInternal(entry);
    rval = wrapped.guid;
    if (this.localMode) {
      Logger.info('Fire immediately (local) : %j ', entry);
      this.localBus().next(wrapped);
    } else {
      try {
        // Guard against bad entries up front
        Logger.info('Fire immediately (remote) : %j ', entry);
        const toWrite: any = {
          type: EpsilonConstants.BACKGROUND_SNS_IMMEDIATE_RUN_FLAG,
          backgroundEntry: wrapped,
        };
        const msg: string = JSON.stringify(toWrite);
        const snsId: string = await this.writeMessageToSnsTopic(msg);
        Logger.debug('Background guid %s Wrote message : %s to SNS : %s', rval, msg, snsId);
      } catch (err) {
        Logger.error('Failed to fireImmediateProcessRequest : %s', err, err);
      }
    }
    return rval;
  }

  public async fireStartProcessingRequest(): Promise<string> {
    let rval: string = null;
    if (this.localMode) {
      Logger.info('Fire start processing request (local, ignored)');
      rval = 'NO-OP';
    } else {
      try {
        Logger.info('Fire start processing request (remote)');
        rval = await this.writeMessageToSnsTopic(EpsilonConstants.BACKGROUND_SNS_START_MARKER);
      } catch (err) {
        Logger.error('Failed to fireStartProcessingRequest : %s', err, err);
      }
    }
    return rval;
  }

  public async fetchApproximateNumberOfQueueEntries(): Promise<number> {
    let rval: number = null;
    if (this.localMode) {
      rval = 0; // No queue when running locally
    } else {
      const all: GetQueueAttributesResult = await this.fetchCurrentQueueAttributes();
      rval = NumberRatchet.safeNumber(all.Attributes['ApproximateNumberOfMessages']);
    }
    return rval;
  }

  public async fetchCurrentQueueAttributes(): Promise<GetQueueAttributesResult> {
    let rval: GetQueueAttributesResult = null;
    const req: GetQueueAttributesRequest = {
      AttributeNames: ['All'],
      QueueUrl: this.awsConfig.queueUrl,
    };

    rval = await this.sqs.getQueueAttributes(req).promise();
    return rval;
  }

  public async writeMessageToSnsTopic(message: string): Promise<string> {
    let rval: string = null;
    const params = {
      Message: message,
      TopicArn: this.awsConfig.notificationArn,
    };

    Logger.debug('Writing message to SNS topic : j', params);
    const result: AWS.SNS.Types.PublishResponse = await this.sns.publish(params).promise();
    rval = result.MessageId;
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
