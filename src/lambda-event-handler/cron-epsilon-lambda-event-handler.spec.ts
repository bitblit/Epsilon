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
import { jest } from '@jest/globals';
import { DateTime } from 'luxon';

// jest.mock('@bitblit/background');

describe('#cronEpsilonLambdaEventHandler', function () {
  let mockSqs;
  let mockSns;

  beforeEach(() => {
    mockSqs = JestRatchet.mock<SQSClient>(jest.fn);
    mockSns = JestRatchet.mock<SNSClient>(jest.fn);
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

describe('cronEpsilonLambdaEventHandler.getCronTimeToUse', () => {
  const currentTimestampEpochMS = new Date().getTime();

  const sampleEvent: ScheduledEvent = {
    version: '0',
    id: '403a3159-cf4d-4cbe-315d-ed688c429988',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: '000011112222',
    time: '2024-08-30T13:16:24Z',
    region: 'us-east-1',
    resources: ['arn:aws:events:us-east-1:000011112222:rule/MyRule1'],
    detail: {},
  };

  // @ts-expect-error private method
  const getCronTimeToUse = CronEpsilonLambdaEventHandler.getCronTimeToUse;

  it('should return current timestamp when evt is undefined', () => {
    const result = getCronTimeToUse(undefined, currentTimestampEpochMS);
    expect(result).toBe(currentTimestampEpochMS);
  });

  it('should return current timestamp when evt.time is undefined', () => {
    const result = getCronTimeToUse({} as ScheduledEvent, currentTimestampEpochMS);
    expect(result).toBe(currentTimestampEpochMS);
  });

  it('should return event time in milliseconds when evt.time is a valid ISO string', () => {
    const recentISOTime = DateTime.fromMillis(currentTimestampEpochMS).toUTC().plus({ seconds: 30 }).toISO();
    const eventTimeInMillis = DateTime.fromISO(recentISOTime).toMillis();
    const result = getCronTimeToUse(
      {
        ...sampleEvent,
        time: recentISOTime,
      },
      currentTimestampEpochMS,
    );
    expect(result).toBe(eventTimeInMillis);
  });

  it('should return current timestamp when evt.time is an invalid ISO string', () => {
    const invalidISOTime = 'invalid-time';
    const result = getCronTimeToUse(
      {
        ...sampleEvent,
        time: invalidISOTime,
      },
      currentTimestampEpochMS,
    );
    expect(result).toBe(currentTimestampEpochMS);
  });

  it('should return current timestamp when time difference exceeds threshold', () => {
    const oldISOTime = '2023-10-10T10:00:00.000Z';
    const largeTimeDifference =
      currentTimestampEpochMS + (CronEpsilonLambdaEventHandler.CRON_EVENT_TIMESTAMP_MISMATCH_MAX_THRESHOLD_MINUTES + 1) * 60 * 1000;

    const result = getCronTimeToUse({ ...sampleEvent, time: oldISOTime }, largeTimeDifference);
    expect(result).toBe(largeTimeDifference);
  });
});
