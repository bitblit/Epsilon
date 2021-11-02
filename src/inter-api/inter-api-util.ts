import { LambdaEventDetector } from '@bitblit/ratchet/dist/aws';
import { SNSEvent } from 'aws-lambda';
import { EpsilonConstants } from '../epsilon-constants';
import { InterApiEntry } from './inter-api-entry';
import { BackgroundManager } from '../background-manager';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';
import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundEntry } from '../background/background-entry';
import { InterApiConfig } from '../config/inter-api/inter-api-config';

export class InterApiUtil {
  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public static isInterApiSnsEvent(event: any): boolean {
    let rval: boolean = false;
    if (event) {
      if (LambdaEventDetector.isSingleSnsEvent(event)) {
        const cast: SNSEvent = event as SNSEvent;
        rval = cast.Records[0].Sns.Message === EpsilonConstants.INTER_API_SNS_EVENT;
      }
    }
    return rval;
  }

  public static async processInterApiEvent(evt: InterApiEntry<any>, cfg: InterApiConfig, mgr: BackgroundManager): Promise<string[]> {
    let rval: string[] = [];
    RequireRatchet.notNullOrUndefined(evt, 'InterApiEntry');
    RequireRatchet.notNullOrUndefined(mgr, 'BackgroundManager');

    Logger.info('Processing inter-api event : %j', evt);
    const backgroundEntries: BackgroundEntry<any>[] = [];
    cfg.processMappings.forEach((map) => {
      if (evt.source.match(map.sourceRegex) && evt.type.match(map.typeRegex)) {
        map.backgroundProcessTypes.forEach((taskName) => {
          const entry: BackgroundEntry<any> = mgr.createEntry(taskName, evt.data);
          backgroundEntries.push(entry);
        });
      }
    });
    if (backgroundEntries.length > 0) {
      Logger.info('Adding %d entries to queue', backgroundEntries.length);
      rval = await mgr.addEntriesToQueue(backgroundEntries, true);
    } else {
      Logger.info('No entries mapped for this event');
    }
    return rval;
  }
}
