import { LambdaEventDetector } from '@bitblit/ratchet/aws';
import { SNSEvent } from 'aws-lambda';
import { EpsilonConstants } from '../epsilon-constants';
import { InterApiEntry } from './inter-api-entry';
import { BackgroundManager } from '../background-manager';
import { RequireRatchet } from '@bitblit/ratchet/common/require-ratchet';
import { Logger, StringRatchet } from '@bitblit/ratchet/common';
import { BackgroundEntry } from '../background/background-entry';
import { InterApiConfig } from '../config/inter-api/inter-api-config';
import { ContextUtil } from '../util/context-util';

export class InterApiUtil {
  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
  public static isInterApiSnsEvent(event: any): boolean {
    return !!InterApiUtil.extractEntryFromEvent(event);
  }

  public static extractEntryFromEvent(evt: SNSEvent): InterApiEntry<any> {
    let rval: InterApiEntry<any> = null;

    if (!!evt) {
      if (LambdaEventDetector.isSingleSnsEvent(evt)) {
        const cast: SNSEvent = evt as SNSEvent;
        const msg: string = cast.Records[0].Sns.Message;
        if (!!StringRatchet.trimToNull(msg)) {
          const parsed: any = JSON.parse(msg);
          if (!!parsed && parsed['type'] === EpsilonConstants.INTER_API_SNS_EVENT) {
            rval = parsed['interApiEvent'];
          }
        }
      }
    }

    return rval;
  }

  public static async processInterApiEvent(evt: SNSEvent, cfg: InterApiConfig, mgr: BackgroundManager): Promise<string[]> {
    let rval: string[] = [];
    RequireRatchet.notNullOrUndefined(evt, 'InterApiEntry');
    RequireRatchet.notNullOrUndefined(mgr, 'BackgroundManager');

    const interApiEntry: InterApiEntry<any> = InterApiUtil.extractEntryFromEvent(evt);
    ContextUtil.setOverrideTraceFromInterApiEntry(interApiEntry);
    Logger.info('Processing inter-api event : %j', evt);
    const backgroundEntries: BackgroundEntry<any>[] = [];
    cfg.processMappings.forEach((map) => {
      if (!map.disabled && interApiEntry.source.match(map.sourceRegex) && interApiEntry.type.match(map.typeRegex)) {
        map.backgroundProcessTypes.forEach((taskName) => {
          const entry: BackgroundEntry<any> = mgr.createEntry(taskName, interApiEntry.data);
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

  public static addTraceToInterApiEntry(ent: InterApiEntry<any>): InterApiEntry<any> {
    if (ent) {
      ent.traceId = ent.traceId || ContextUtil.currentTraceId();
      ent.traceDepth = ent.traceDepth || ContextUtil.currentTraceDepth() + 1;
    }
    return ent;
  }
}
