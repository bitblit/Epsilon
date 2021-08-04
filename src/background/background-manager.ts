import { BackgroundEntry } from './background-entry';
import { BackgroundAwsConfig } from './background-aws-config';
import { Subject } from 'rxjs';
import { Logger, NumberRatchet } from '@bitblit/ratchet/dist/common';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { GetQueueAttributesRequest, GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import AWS from 'aws-sdk';
import { EpsilonConstants } from '../epsilon-constants';

/**
 * Handles all submission of work to the background processing system.
 *
 * Note that this does NOT validate the input, it just passes it along.  This is
 * because it creates a circular reference to the processors if we try since they
 * define the type and validation.
 */
export class BackgroundManager {
  private _localBus: Subject<BackgroundEntry> = new Subject<BackgroundEntry>();
  private _localMode: boolean = false;

  constructor(private _awsConfig: BackgroundAwsConfig) {}

  public get awsConfig(): BackgroundAwsConfig {
    return this._awsConfig;
  }

  public get localMode(): boolean {
    return this._localMode;
  }

  public set localMode(newVal: boolean) {
    Logger.info('Setting local-mode for background processing to : %s', newVal);
    this._localMode = newVal;
  }

  public localBus(): Subject<BackgroundEntry> {
    return this._localBus;
  }

  public createEntry(type: string, data: any = {}): BackgroundEntry {
    const rval: BackgroundEntry = {
      created: new Date().getTime(),
      type: type,
      data: data,
    };
    return rval;
  }

  public async addEntryToQueueByParts(type: string, data: any = {}): Promise<string> {
    let rval: string = null;
    const entry: BackgroundEntry = this.createEntry(type, data);
    if (entry) {
      rval = await this.addEntryToQueue(entry);
    }
    return rval;
  }

  public async addEntryToQueue(entry: BackgroundEntry, fireStartMessage?: boolean): Promise<string> {
    let rval: string = null;
    try {
      if (this.localMode) {
        Logger.info('Add entry to queue (local) : %j : Start : %s', entry, fireStartMessage);
        this._localBus.next(entry);
        rval = 'addEntryToQueue' + new Date().toISOString() + StringRatchet.safeString(rval);
      } else {
        // Guard against bad entries up front
        const params = {
          DelaySeconds: 0,
          MessageBody: JSON.stringify(entry),
          MessageGroupId: entry.type,
          QueueUrl: this.awsConfig.queueUrl,
        };

        Logger.info('Add entry to queue (remote) : %j : Start : %s', params, fireStartMessage);
        const result: AWS.SQS.SendMessageResult = await this.awsConfig.sqs.sendMessage(params).promise();

        if (fireStartMessage) {
          const fireResult: string = await this.fireStartProcessingRequest();
          Logger.silly('FireResult : %s', fireResult);
        }

        rval = result.MessageId;
      }
    } catch (err) {
      Logger.error('Failed to add entry to queue: %s', err, err);
    }
    return rval;
  }

  public async addEntriesToQueue(entries: BackgroundEntry[], fireStartMessage?: boolean): Promise<string[]> {
    const rval: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      try {
        // Always defer the fire to after the last enqueue
        const tmp: string = await this.addEntryToQueue(entries[i], false);
        rval.push(tmp);
      } catch (err) {
        Logger.error('Error processing %j : %s', entries[i], err);
        rval.push(err.message);
      }

      if (fireStartMessage) {
        const fireResult: string = await this.fireStartProcessingRequest();
        Logger.silly('FireResult : %s', fireResult);
      }
    }
    return rval;
  }

  public async fireImmediateProcessRequestByParts(type: string, data: any = {}, returnNullOnInvalid: boolean = false): Promise<string> {
    let rval: string = null;
    const entry: BackgroundEntry = this.createEntry(type, data);
    if (entry) {
      rval = await this.fireImmediateProcessRequest(entry);
    }
    return rval;
  }

  public async fireImmediateProcessRequest(entry: BackgroundEntry): Promise<string> {
    let rval: string = null;
    if (this.localMode) {
      Logger.info('Fire immediately (local) : %j ', entry);
      this.localBus().next(entry);
      rval = 'fireImmediateProcessRequest' + new Date().toISOString() + StringRatchet.safeString(rval);
    } else {
      try {
        // Guard against bad entries up front
        Logger.info('Fire immediately (remote) : %j ', entry);
        const toWrite: any = {
          type: EpsilonConstants.BACKGROUND_SNS_IMMEDIATE_RUN_FLAG,
          backgroundEntry: entry,
        };
        const msg: string = JSON.stringify(toWrite);
        rval = await this.writeMessageToSnsTopic(msg);
        Logger.debug('Wrote message : %s : %s', msg, rval);
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

    rval = await this.awsConfig.sqs.getQueueAttributes(req).promise();
    return rval;
  }

  public async writeMessageToSnsTopic(message: string): Promise<string> {
    let rval: string = null;
    const params = {
      Message: message,
      TopicArn: this.awsConfig.notificationArn,
    };

    Logger.debug('Writing message to SNS topic : j', params);
    const result: AWS.SNS.Types.PublishResponse = await this.awsConfig.sns.publish(params).promise();
    rval = result.MessageId;
    return rval;
  }
}
