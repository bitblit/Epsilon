import { EpsilonLambdaEventHandler } from '../config/epsilon-lambda-event-handler';
import { Context, ProxyResult, ScheduledEvent } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/common/logger';
import { AwsUtil } from '../util/aws-util';
import { EpsilonInstance } from '../epsilon-instance';
import { CronConfig } from '../config/cron/cron-config';
import { BackgroundHandler } from '../background/background-handler';
import { BackgroundEntry } from '../background/background-entry';
import { CronBackgroundEntry } from '../config/cron/cron-background-entry';
import { CronUtil } from '../util/cron-util';
import { BackgroundManagerLike } from '../background/manager/background-manager-like';
import { LambdaEventDetector } from '@bitblit/ratchet/aws';

export class CronEpsilonLambdaEventHandler implements EpsilonLambdaEventHandler<ScheduledEvent> {
  constructor(private _epsilon: EpsilonInstance) {}

  public extractLabel(evt: ScheduledEvent, context: Context): string {
    return 'CronEvt:' + evt.source;
  }

  public handlesEvent(evt: any): boolean {
    return LambdaEventDetector.isValidCronEvent(evt);
  }

  public async processEvent(evt: ScheduledEvent, context: Context): Promise<ProxyResult> {
    let rval: ProxyResult = null;
    Logger.debug('Epsilon: CRON: %j', evt);
    if (!this._epsilon.config.cron) {
      Logger.debug('Skipping - CRON disabled');
      rval = {
        statusCode: 200,
        body: JSON.stringify({ message: 'CRON skipped - disabled' }),
        isBase64Encoded: false,
      };
    } else {
      const output: boolean = await CronEpsilonLambdaEventHandler.processCronEvent(
        evt,
        this._epsilon.config.cron,
        this._epsilon.backgroundManager,
        this._epsilon.backgroundHandler
      );
      rval = {
        statusCode: 200,
        body: JSON.stringify({ message: 'CRON complete' }),
        isBase64Encoded: false,
      };
    }
    return rval;
  }

  public static async processCronEvent(
    evt: ScheduledEvent,
    cronConfig: CronConfig,
    backgroundManager: BackgroundManagerLike,
    background: BackgroundHandler
  ): Promise<boolean> {
    let rval: boolean = false;
    if (cronConfig && evt && evt.resources[0]) {
      // Run all the background ones
      if (!!cronConfig.entries) {
        if (!!background) {
          const toEnqueue: BackgroundEntry<any>[] = [];
          for (let i = 0; i < cronConfig.entries.length; i++) {
            const smCronEntry: CronBackgroundEntry = cronConfig.entries[i];
            if (CronUtil.eventMatchesEntry(evt, smCronEntry, cronConfig)) {
              Logger.info('CRON Firing : %s', CronUtil.cronEntryName(smCronEntry));

              const backgroundEntry: BackgroundEntry<any> = {
                type: smCronEntry.backgroundTaskType,
                data: AwsUtil.resolvePotentialFunctionToResult<any>(smCronEntry.data, {}),
              };
              Logger.silly('Resolved entry : %j', backgroundEntry);
              if (smCronEntry.fireImmediate) {
                await backgroundManager.fireImmediateProcessRequest(backgroundEntry);
                rval = true;
              } else {
                toEnqueue.push(backgroundEntry);
              }
            }
          }
          if (toEnqueue.length > 0) {
            await backgroundManager.addEntriesToQueue(toEnqueue, true);
            rval = true;
          }
        } else {
          Logger.warn('Cron defines background tasks, but no background manager provided');
        }
      }
    }
    return rval;
  }
}
