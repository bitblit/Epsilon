import { BackgroundEntry } from './background-entry';
import { BackgroundAwsConfig } from './background-aws-config';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';
import { Subject } from 'rxjs';
import { Logger, NumberRatchet } from '@bitblit/ratchet/dist/common';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { GetQueueAttributesRequest, GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import AWS from 'aws-sdk';
import { EpsilonConstants } from '../epsilon-constants';

/**
 * Handles all submission of work to the background processing system.
 *
 * IMPORTANT NOTE!!!  This may NOT reference BackgroundConfig (and its processors)
 * in ANY way.  If it does, it will cause a circular reference.  That's why the constructor
 * has all those broke-out maps
 */
export class BackgroundManager {
  private _localBus: Subject<BackgroundEntry> = new Subject<BackgroundEntry>();

  constructor(
    private validTypes: string[],
    private awsConfig: BackgroundAwsConfig,
    private modelValidator: ModelValidator,
    private dataValidators: Map<string, string>,
    private metaDataValidators: Map<string, string>,
    private localMode: boolean
  ) {}

  public localBus(): Subject<BackgroundEntry> {
    return this._localBus;
  }

  public validType(type: string): boolean {
    return this.validTypes.includes(type);
  }

  public createEntry(type: string, data: any = {}, metadata: any = {}, returnNullOnInvalid: boolean = false): BackgroundEntry {
    if (!this.validType(type)) {
      Logger.warn('Tried to create invalid type : %s (Valid are %j)', type, this.validTypes);
      return null;
    }

    let rval: BackgroundEntry = {
      created: new Date().getTime(),
      type: type,
      data: data,
      metadata: metadata,
    };

    const errors: string[] = this.validateEntry(rval);
    if (errors.length > 0) {
      if (returnNullOnInvalid) {
        Logger.warn('Supplied entry data was invalid, returning null');
        rval = null;
      } else {
        ErrorRatchet.throwFormattedErr('Cannot create entry %j : errors : %j', rval, errors);
      }
    }

    return rval;
  }

  public validateEntry(entry: BackgroundEntry): string[] {
    let rval: string[] = [];
    if (!entry) {
      rval.push('Entry is null');
    } else if (!StringRatchet.trimToNull(entry.type)) {
      rval.push('Entry type is null or empty');
    } else if (!this.validType(entry.type)) {
      rval.push('Entry type is invalid');
    } else {
      const dataSchema: string = this.dataValidators.get(entry.type);
      if (dataSchema) {
        rval = rval.concat(this.modelValidator.validate(dataSchema, entry.data) || []);
      }
      const metaDataSchema: string = this.metaDataValidators.get(entry.type);
      if (metaDataSchema) {
        rval = rval.concat(this.modelValidator.validate(metaDataSchema, entry.metadata) || []);
      }
    }
    return rval;
  }

  public validateEntryAndThrowException(entry: BackgroundEntry): void {
    const errors: string[] = this.validateEntry(entry);
    if (errors.length > 0) {
      Logger.warn('Invalid entry %j : errors : %j', entry, errors);
      ErrorRatchet.throwFormattedErr('Invalid entry %j : errors : %j', entry, errors);
    }
  }

  public async addEntryToQueue(entry: BackgroundEntry, fireStartMessage?: boolean): Promise<string> {
    // Guard against bad entries up front
    this.validateEntryAndThrowException(entry);
    let rval: string = null;
    if (this.localMode) {
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

      Logger.debug('Adding %j to queue', entry);
      const result: AWS.SQS.SendMessageResult = await this.awsConfig.sqs.sendMessage(params).promise();

      if (fireStartMessage) {
        const fireResult: string = await this.fireStartProcessingRequest();
        Logger.silly('FireResult : %s', fireResult);
      }

      rval = result.MessageId;
    }
    return rval;
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
    let rval: string = null;
    // Guard against bad entries up front
    this.validateEntryAndThrowException(entry);
    if (this.localMode) {
      this.localBus().next(entry);
      rval = 'fireImmediateProcessRequest' + new Date().toISOString() + StringRatchet.safeString(rval);
    } else {
      // Guard against bad entries up front
      Logger.debug('Immediately processing %j', entry);
      const toWrite: any = {
        type: EpsilonConstants.BACKGROUND_SNS_IMMEDIATE_RUN_FLAG,
        backgroundEntry: entry,
      };
      const msg: string = JSON.stringify(toWrite);
      rval = await this.writeMessageToSnsTopic(msg);
      Logger.debug('Wrote message : %s : %s', msg, rval);
    }
    return rval;
  }

  public async fireStartProcessingRequest(): Promise<string> {
    let rval: string = null;
    if (this.localMode) {
      rval = 'NO-OP';
    } else {
      rval = await this.writeMessageToSnsTopic(EpsilonConstants.BACKGROUND_SNS_START_MARKER);
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

    const result: AWS.SNS.Types.PublishResponse = await this.awsConfig.sns.publish(params).promise();
    rval = result.MessageId;
    return rval;
  }
}
