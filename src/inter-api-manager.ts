import { Logger } from '@bitblit/ratchet/common';
import { EpsilonConstants } from './epsilon-constants';
import { InterApiEntry } from './inter-api/inter-api-entry';
import { InterApiAwsConfig } from './config/inter-api/inter-api-aws-config';
import { InterApiUtil } from './inter-api/inter-api-util';
import { PublishCommand, PublishCommandOutput, SNSClient } from '@aws-sdk/client-sns';

/**
 * Handles all submission of events to the inter-api SNS topic (if any)
 */
export class InterApiManager {
  constructor(
    private _aws: InterApiAwsConfig,
    private _sns: SNSClient,
  ) {}

  public get config(): InterApiAwsConfig {
    return this._aws;
  }

  public get sns(): SNSClient {
    return this._sns;
  }

  public createEntry<T>(type: string, data?: T): InterApiEntry<T> {
    const rval: InterApiEntry<T> = {
      source: this._aws.source,
      type: type,
      data: data,
    };
    return rval;
  }

  public async fireInterApiEventByParts<T>(type: string, data?: T): Promise<string> {
    const entry: InterApiEntry<T> = this.createEntry(type, data);
    const rval: string = await this.fireInterApiEvent(entry);
    return rval;
  }

  public async fireInterApiEvent<T>(entry: InterApiEntry<T>): Promise<string> {
    let rval: string = null;
    if (this.config.localMode) {
      Logger.info('Fire inter-api event ignored because running locally (was %j)', entry);
      rval = 'INTER-API-IGNORED';
    } else {
      try {
        // Guard against bad entries up front
        Logger.info('Firing inter-api event (remote) : %j ', entry);
        const toWrite: any = {
          type: EpsilonConstants.INTER_API_SNS_EVENT,
          interApiEvent: InterApiUtil.addTraceToInterApiEntry(entry),
        };
        const msg: string = JSON.stringify(toWrite);
        const snsId: string = await this.writeMessageToSnsTopic(msg);
        Logger.debug('Inter-api Wrote message : %s to SNS : %s', rval, msg, snsId);
      } catch (err) {
        Logger.error('Failed to fireImmediateProcessRequest : %s', err, err);
      }
    }
    return rval;
  }

  public async writeMessageToSnsTopic(message: string): Promise<string> {
    let rval: string = null;
    const params = {
      Message: message,
      TopicArn: this._aws.snsArn,
    };

    Logger.debug('Writing message to SNS topic : j', params);
    const result: PublishCommandOutput = await this.sns.send(new PublishCommand(params));
    rval = result.MessageId;
    return rval;
  }
}
