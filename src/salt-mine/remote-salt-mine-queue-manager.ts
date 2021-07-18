import AWS from 'aws-sdk';
import { SaltMineEntry } from './salt-mine-entry';
import { GetQueueAttributesRequest, GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import { NumberRatchet, Logger } from '@bitblit/ratchet/dist/common';
import { EpsilonConstants } from '../epsilon-constants';
import { SaltMineAwsConfig } from './salt-mine-aws-config';
import { SaltMineQueueManager } from './salt-mine-queue-manager';
import { SaltMineEntryValidator } from './salt-mine-entry-validator';

/**
 * This class just validates and puts items into the salt mine queue - it does not do
 * any processing.  It also does NOT start queue processing.  This is to prevent circular
 * dependencies - the SaltMineConfig holds references to all the processor functions, but
 * none of the processor functions hold references back, so they can make calls to the
 * adder or starter if necessary.
 */
export class RemoteSaltMineQueueManager implements SaltMineQueueManager {
  constructor(private awsCfg: SaltMineAwsConfig, private inValidator: SaltMineEntryValidator) {}

  public validator(): SaltMineEntryValidator {
    return this.inValidator;
  }

  public async addEntryToQueue(entry: SaltMineEntry, fireStartMessage: boolean = true): Promise<string> {
    let rval: string = null;

    // Guard against bad entries up front
    this.inValidator.validateEntryAndThrowException(entry);
    const params = {
      DelaySeconds: 0,
      MessageBody: JSON.stringify(entry),
      MessageGroupId: entry.type,
      QueueUrl: this.awsCfg.queueUrl,
    };

    Logger.debug('Adding %j to queue', entry);
    const result: AWS.SQS.SendMessageResult = await this.awsCfg.sqs.sendMessage(params).promise();

    if (fireStartMessage) {
      const fireResult: string = await this.fireStartProcessingRequest();
      Logger.silly('FireResult : %s', fireResult);
    }

    rval = result.MessageId;
    return rval;
  }

  public async addEntriesToQueue(entries: SaltMineEntry[], fireStartMessage: boolean): Promise<string[]> {
    // Only fire one start message at the end
    const promises: Promise<string>[] = entries.map((e) => this.addEntryToQueue(e, false));
    const results: string[] = await Promise.all(promises);
    if (fireStartMessage) {
      const fireResult: string = await this.fireStartProcessingRequest();
      Logger.silly('Fire Result : %s', fireResult);
    }
    return results;
  }

  public async fireImmediateProcessRequest(entry: SaltMineEntry): Promise<string> {
    let rval: string = null;
    // Guard against bad entries up front
    this.inValidator.validateEntryAndThrowException(entry);
    Logger.debug('Immediately processing %j', entry);
    const toWrite: any = {
      type: EpsilonConstants.SALT_MINE_SNS_IMMEDIATE_RUN_FLAG,
      saltMineEntry: entry,
    };
    const msg: string = JSON.stringify(toWrite);
    rval = await this.writeMessageToSnsTopic(msg);
    Logger.debug('Wrote message : %s : %s', msg, rval);

    return rval;
  }

  public async fireStartProcessingRequest(): Promise<string> {
    return this.writeMessageToSnsTopic(EpsilonConstants.SALT_MINE_SNS_START_MARKER);
  }

  public async writeMessageToSnsTopic(message: string): Promise<string> {
    let rval: string = null;
    const params = {
      Message: message,
      TopicArn: this.awsCfg.notificationArn,
    };

    const result: AWS.SNS.Types.PublishResponse = await this.awsCfg.sns.publish(params).promise();
    rval = result.MessageId;
    return rval;
  }

  public async fetchCurrentQueueAttributes(): Promise<GetQueueAttributesResult> {
    let rval: GetQueueAttributesResult = null;
    const req: GetQueueAttributesRequest = {
      AttributeNames: ['All'],
      QueueUrl: this.awsCfg.queueUrl,
    };

    rval = await this.awsCfg.sqs.getQueueAttributes(req).promise();
    return rval;
  }

  public async fetchApproximateNumberOfQueueEntries(): Promise<number> {
    let rval: number = 0;
    const all: GetQueueAttributesResult = await this.fetchCurrentQueueAttributes();
    rval = NumberRatchet.safeNumber(all.Attributes['ApproximateNumberOfMessages']);
    return rval;
  }
}
