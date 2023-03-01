import { Logger, NumberRatchet } from '@bitblit/ratchet/common';
import {
  DeleteMessageCommand,
  DeleteMessageCommandOutput,
  GetQueueAttributesCommand,
  GetQueueAttributesCommandOutput,
  GetQueueAttributesRequest,
  GetQueueAttributesResult,
  Message,
  ReceiveMessageCommand,
  ReceiveMessageCommandOutput,
  SendMessageCommand,
  SendMessageCommandOutput,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { BackgroundEntry } from '../background-entry';
import { BackgroundAwsConfig } from '../../config/background/background-aws-config';
import { EpsilonConstants } from '../../epsilon-constants';
import { InternalBackgroundEntry } from '../internal-background-entry';
import { AbstractBackgroundManager } from './abstract-background-manager';
import { BackgroundValidator } from '../background-validator';
import { ErrorRatchet } from '@bitblit/ratchet/common/error-ratchet';
import { PublishCommand, PublishCommandOutput, SNSClient } from '@aws-sdk/client-sns';

/**
 * Handles all submission of work to the background processing system.
 *
 * Note that this does NOT validate the input, it just passes it along.  This is
 * because it creates a circular reference to the processors if we try since they
 * define the type and validation.
 */
export class AwsSqsSnsBackgroundManager extends AbstractBackgroundManager {
  constructor(private _awsConfig: BackgroundAwsConfig, private _sqs: SQSClient, private _sns: SNSClient) {
    super();
    const cfgErrors: string[] = BackgroundValidator.validateAwsConfig(_awsConfig);
    if (cfgErrors.length) {
      ErrorRatchet.throwFormattedErr('Cannot start - invalid AWS config : %j', cfgErrors);
    }
  }

  public get backgroundManagerName(): string {
    return 'AwsSqsSnsBackgroundManager';
  }

  public get awsConfig(): BackgroundAwsConfig {
    return this._awsConfig;
  }

  public get sqs(): SQSClient {
    return this._sqs;
  }

  public get sns(): SNSClient {
    return this._sns;
  }

  public async addEntryToQueue<T>(entry: BackgroundEntry<T>, fireStartMessage?: boolean): Promise<string> {
    try {
      const wrapped: InternalBackgroundEntry<T> = this.wrapEntryForInternal(entry);
      const rval: string = wrapped.guid;
      // Guard against bad entries up front
      const params = {
        DelaySeconds: 0,
        MessageBody: JSON.stringify(wrapped),
        MessageGroupId: entry.type,
        QueueUrl: this.awsConfig.queueUrl,
      };

      Logger.info('Add entry to queue (remote) : %j : Start : %s', params, fireStartMessage);
      const result: SendMessageCommandOutput = await this.sqs.send(new SendMessageCommand(params));

      if (fireStartMessage) {
        const fireResult: string = await this.fireStartProcessingRequest();
        Logger.silly('FireResult : %s', fireResult);
      }

      Logger.info('Background process %s using message id %s', rval, result.MessageId);
      return rval;
    } catch (error) {
      Logger.error('Error inserting background entry into SQS queue : %j', error);
      throw new Error('Error inserting background entry into SQS queue : ' + error['code'] + ' : ' + error['name']);
    }
  }

  public async fireImmediateProcessRequest<T>(entry: BackgroundEntry<T>): Promise<string> {
    let rval: string = null;
    const wrapped: InternalBackgroundEntry<T> = this.wrapEntryForInternal(entry);
    rval = wrapped.guid;
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
    return rval;
  }

  public async fireStartProcessingRequest(): Promise<string> {
    let rval: string = null;
    try {
      Logger.info('Fire start processing request (remote)');
      rval = await this.writeMessageToSnsTopic(EpsilonConstants.BACKGROUND_SNS_START_MARKER);
    } catch (err) {
      Logger.error('Failed to fireStartProcessingRequest : %s', err, err);
    }
    return rval;
  }

  public async fetchApproximateNumberOfQueueEntries(): Promise<number> {
    let rval: number = null;
    const all: GetQueueAttributesResult = await this.fetchCurrentQueueAttributes();
    rval = NumberRatchet.safeNumber(all.Attributes['ApproximateNumberOfMessages']);
    return rval;
  }

  public async fetchCurrentQueueAttributes(): Promise<GetQueueAttributesCommandOutput> {
    let rval: GetQueueAttributesCommandOutput = null;
    const req: GetQueueAttributesRequest = {
      AttributeNames: ['All'],
      QueueUrl: this.awsConfig.queueUrl,
    };

    rval = await this.sqs.send(new GetQueueAttributesCommand(req));
    return rval;
  }

  public async writeMessageToSnsTopic(message: string): Promise<string> {
    let rval: string = null;
    const params = {
      Message: message,
      TopicArn: this.awsConfig.notificationArn,
    };

    Logger.debug('Writing message to SNS topic : j', params);
    const result: PublishCommandOutput = await this.sns.send(new PublishCommand(params));
    rval = result.MessageId;
    return rval;
  }

  public async takeEntryFromBackgroundQueue(): Promise<InternalBackgroundEntry<any>[]> {
    const rval: InternalBackgroundEntry<any>[] = [];

    const params = {
      MaxNumberOfMessages: 1,
      QueueUrl: this.awsConfig.queueUrl,
      VisibilityTimeout: 300,
      WaitTimeSeconds: 0,
    };

    const message: ReceiveMessageCommandOutput = await this.sqs.send(new ReceiveMessageCommand(params));
    if (message && message.Messages && message.Messages.length > 0) {
      for (let i = 0; i < message.Messages.length; i++) {
        const m: Message = message.Messages[i];
        try {
          const parsedBody: InternalBackgroundEntry<any> = JSON.parse(m.Body);
          if (!parsedBody.type) {
            Logger.warn('Dropping invalid background entry : %j', parsedBody);
          } else {
            rval.push(parsedBody);
          }

          Logger.debug('Removing message from queue');
          const delParams = {
            QueueUrl: this.awsConfig.queueUrl,
            ReceiptHandle: m.ReceiptHandle,
          };
          const delResult: DeleteMessageCommandOutput = await this.sqs.send(new DeleteMessageCommand(delParams));
          Logger.silly('Delete result : %j', delResult);
        } catch (err) {
          Logger.warn('Error parsing message, dropping : %j', m);
        }
      }
    } else {
      Logger.debug('No messages found (likely end of recursion)');
    }

    return rval;
  }
}
