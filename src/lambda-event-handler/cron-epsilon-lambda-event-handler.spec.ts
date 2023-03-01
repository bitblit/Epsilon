import { ScheduledEvent } from 'aws-lambda';
import { BackgroundHandler } from '../background/background-handler';
import { CronConfig } from '../config/cron/cron-config';
import { BackgroundConfig } from '../config/background/background-config';
import { JestRatchet } from '@bitblit/ratchet/jest';
import { CronEpsilonLambdaEventHandler } from './cron-epsilon-lambda-event-handler';
import { BackgroundManagerLike } from '../background/manager/background-manager-like';
import { SingleThreadLocalBackgroundManager } from '../background/manager/single-thread-local-background-manager';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';

// jest.mock('@bitblit/background');

describe('#cronEpsilonLambdaEventHandler', function () {
  let mockSqs;
  let mockSns;

  beforeEach(() => {
    mockSqs = JestRatchet.mock<SQSClient>();
    mockSns = JestRatchet.mock<SNSClient>();
  });

  // CAW 2021-03-10 : Disabling for now since jest mock not working when run in batch from command line...unclear why
  xit('should verify that cron data functions get executed', async () => {
    // Logger.setLevel(LoggerLevelName.silly);
    const evt: ScheduledEvent = {
      id: '1',
      version: '1',
      account: 'test',
      time: 'test',
      region: '',
      resources: ['test'],
      source: null,
      detail: {},
      'detail-type': null,
    };
    const cronConfig: CronConfig = {
      timezone: 'America/Los_Angeles',
      context: 'Test',
      entries: [
        {
          backgroundTaskType: 'test',
          fireImmediate: true,
          data: () => {
            return { curDate: new Date().toISOString(), fixed: 'abc' };
          },
        },
      ],
    };
    const smConfig: BackgroundConfig = {
      processors: [],
      httpSubmissionPath: '/background/',
      implyTypeFromPathSuffix: true,
      httpMetaEndpoint: '/background-meta',
    };
    const background = new BackgroundHandler(null, null);
    background.getConfig = jest.fn(() => smConfig);

    const backgroundManager: BackgroundManagerLike = new SingleThreadLocalBackgroundManager();

    const res: boolean = await CronEpsilonLambdaEventHandler.processCronEvent(evt, cronConfig, backgroundManager, background);
    expect(res).toBeTruthy();
  }, 500);
});
