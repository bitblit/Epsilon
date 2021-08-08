import { ScheduledEvent } from 'aws-lambda';
import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { BackgroundHandler } from './background/background-handler';
import { BackgroundManager } from './background-manager';
import { CronConfig } from './config/cron/cron-config';
import { BackgroundConfig } from './config/background/background-config';
import { Substitute } from '@fluffy-spoon/substitute';
import AWS from 'aws-sdk';

// jest.mock('@bitblit/background');

describe('#epsilonGlobalHandler', function () {
  let mockSqs;
  let mockSns;

  beforeEach(() => {
    mockSqs = Substitute.for<AWS.SQS>();
    mockSns = Substitute.for<AWS.SNS>();
  });

  // CAW 2021-03-10 : Disabling for now since jest mock not working when run in batch from command line...unclear why
  xit('should verify that cron data functions get executed', async () => {
    // Logger.setLevelByName('silly');
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
      backgroundHttpEndpointPrefix: '/background/',
      backgroundHttpEndpointAuthorizerName: 'BackgroundAuthorizer',
      aws: null,
    };
    const background = new BackgroundHandler(null, null);
    background.getConfig = jest.fn(() => smConfig);

    const backgroundManager: BackgroundManager = new BackgroundManager(smConfig.aws, mockSqs, mockSns);
    backgroundManager.localMode = true;

    const res: boolean = await EpsilonGlobalHandler.processCronEvent(evt, cronConfig, backgroundManager, background);
    expect(res).toBeTruthy();
  }, 500);
});
