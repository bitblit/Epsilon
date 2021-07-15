import AWS from 'aws-sdk';
import { SaltMineEntry } from './salt-mine-entry';
import { SaltMineConfig } from './salt-mine-config';
import { GetQueueAttributesRequest, GetQueueAttributesResult } from 'aws-sdk/clients/sqs';
import { SaltMineLocalSimulationEntry } from './salt-mine-local-simulation-entry';
import fetch from 'isomorphic-fetch';
import { ErrorRatchet, NumberRatchet, Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineConfigUtil } from './salt-mine-config-util';
import { EpsilonConstants } from '../epsilon-constants';

/**
 * This class just validates and puts items into the salt mine queue - it does not do
 * any processing.  It also does NOT start queue processing.  This is to prevent circular
 * dependencies - the SaltMineConfig holds references to all the processor functions, but
 * none of the processor functions hold references back, so they can make calls to the
 * adder or starter if necessary.
 */
export class SaltMineQueueUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static validType(cfg: SaltMineConfig, type: string): boolean {
    return SaltMineConfigUtil.processNames(cfg).includes(type);
  }

  public static createEntry(cfg: SaltMineConfig, type: string, data: any = {}, metadata: any = {}): SaltMineEntry {
    if (!SaltMineQueueUtil.validType(cfg, type)) {
      Logger.warn('Tried to create invalid type : %s (Valid are %j)', type, SaltMineConfigUtil.processNames(cfg));
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

  public static validEntry(cfg: SaltMineConfig, entry: SaltMineEntry): boolean {
    return entry != null && entry.type != null && SaltMineQueueUtil.validType(cfg, entry.type);
  }

  public static async addEntryToQueue(cfg: SaltMineConfig, entry: SaltMineEntry, fireStartMessage: boolean = true): Promise<string> {
    let rval: string = null;
    if (SaltMineQueueUtil.validEntry(cfg, entry)) {
      if (SaltMineConfigUtil.awsConfig(cfg)) {
        const params = {
          DelaySeconds: 0,
          MessageBody: JSON.stringify(entry),
          MessageGroupId: entry.type,
          QueueUrl: cfg.aws.queueUrl,
        };

        Logger.debug('Adding %j to queue', entry);
        const result: AWS.SQS.SendMessageResult = await cfg.aws.sqs.sendMessage(params).promise();

        if (fireStartMessage) {
          const fireResult: string = await SaltMineQueueUtil.fireStartProcessingRequest(cfg);
          Logger.silly('FireResult : %s', fireResult);
        }

        rval = result.MessageId;
      } else {
        Logger.debug('addEntryToQueue : dev server  : %j', entry);
        rval = await SaltMineQueueUtil.fireEntryToDevelopmentServer(cfg, entry);
      }
    } else {
      Logger.warn('Not adding invalid entry to queue : %j', entry);
      rval = null;
    }
    return rval;
  }

  public static async fireEntryToDevelopmentServer(cfg: SaltMineConfig, entry: SaltMineEntry): Promise<string> {
    const targetBody: SaltMineLocalSimulationEntry = {
      entry: entry,
      delayMS: cfg.development.queueDelayMS || 0,
    };
    const body: string = JSON.stringify(targetBody);

    const resp: Response = await fetch(cfg.development.url, { method: 'POST', body: body });
    const rval: string = await resp.text();
    return rval;
  }

  public static async addEntriesToQueue(cfg: SaltMineConfig, entries: SaltMineEntry[], fireStartMessage: boolean): Promise<string[]> {
    // Only fire one start message at the end
    const promises: Promise<string>[] = entries.map((e) => this.addEntryToQueue(cfg, e, false));
    const results: string[] = await Promise.all(promises);
    if (fireStartMessage) {
      const fireResult: string = await SaltMineQueueUtil.fireStartProcessingRequest(cfg);
      Logger.silly('Fire Result : %s', fireResult);
    }
    return results;
  }

  public static async fireImmediateProcessRequest(cfg: SaltMineConfig, entry: SaltMineEntry): Promise<string> {
    let rval: string = null;
    if (SaltMineQueueUtil.validEntry(cfg, entry)) {
      if (SaltMineConfigUtil.awsConfig(cfg)) {
        Logger.debug('Immediately processing %j', entry);
        const toWrite: any = {
          type: EpsilonConstants.SALT_MINE_SNS_IMMEDIATE_RUN_FLAG,
          saltMineEntry: entry,
        };
        const msg: string = JSON.stringify(toWrite);
        rval = await this.writeMessageToSnsTopic(cfg, msg);
        Logger.debug('Wrote message : %s : %s', msg, rval);
      } else {
        Logger.debug('fireImmediateProcessRequest : dev server  : %j', entry);
        rval = await SaltMineQueueUtil.fireEntryToDevelopmentServer(cfg, entry);
      }
    } else {
      Logger.warn('Cannot fire null value as immediate process request');
    }

    return rval;
  }

  public static async fireStartProcessingRequest(cfg: SaltMineConfig): Promise<string> {
    if (SaltMineConfigUtil.awsConfig(cfg)) {
      return this.writeMessageToSnsTopic(cfg, EpsilonConstants.SALT_MINE_SNS_START_MARKER);
    } else {
      Logger.debug('fireStartProcessingRequest ignored, local');
      return 'OK';
    }
  }

  public static async writeMessageToSnsTopic(cfg: SaltMineConfig, message: string): Promise<string> {
    let rval: string = null;
    if (SaltMineConfigUtil.awsConfig(cfg)) {
      const params = {
        Message: message,
        TopicArn: cfg.aws.notificationArn,
      };

      const result: AWS.SNS.Types.PublishResponse = await cfg.aws.sns.publish(params).promise();
      rval = result.MessageId;
    } else {
      ErrorRatchet.throwFormattedErr('Cannot write message to topic - local development server');
    }
    return rval;
  }

  public static async fetchCurrentQueueAttributes(cfg: SaltMineConfig): Promise<GetQueueAttributesResult> {
    let rval: GetQueueAttributesResult = null;
    if (SaltMineConfigUtil.awsConfig(cfg)) {
      const req: GetQueueAttributesRequest = {
        AttributeNames: ['All'],
        QueueUrl: cfg.aws.queueUrl,
      };

      rval = await cfg.aws.sqs.getQueueAttributes(req).promise();
    } else {
      Logger.info('No attributes - not an AWS config');
    }
    return rval;
  }

  public static async fetchQueueApproximateNumberOfMessages(cfg: SaltMineConfig): Promise<number> {
    let rval: number = 0;
    if (SaltMineConfigUtil.awsConfig(cfg)) {
      const all: GetQueueAttributesResult = await this.fetchCurrentQueueAttributes(cfg);
      rval = NumberRatchet.safeNumber(all.Attributes['ApproximateNumberOfMessages']);
    } else {
      Logger.debug('Running development server - treating as 0 messages queued');
    }
    return rval;
  }
}
