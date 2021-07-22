import { ScheduledEvent } from 'aws-lambda';
import { CronConfig } from './background/cron/cron-config';
import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { BackgroundConfig } from './background/background-config';
import { BackgroundHandler } from './background/background-handler';
import { BackgroundManager } from './background/background-manager';
import { ModelValidator } from '@bitblit/ratchet/dist/model-validator';

// jest.mock('@bitblit/background');

describe('#epsilonGlobalHandler', function () {
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
      directEntries: [],
      context: 'Test',
      backgroundEntries: [
        {
          backgroundTaskType: 'test',
          fireImmediate: true,
          data: () => {
            return { curDate: new Date().toISOString(), fixed: 'abc' };
          },
          metadata: { a: 'b' },
        },
      ],
    };
    const smConfig: BackgroundConfig = {
      processors: [],
      aws: null,
    };
    const background = new BackgroundHandler(null, null);
    background.getConfig = jest.fn(() => smConfig);

    const backgroundManager: BackgroundManager = new BackgroundManager(smConfig.aws, true);

    const res: boolean = await EpsilonGlobalHandler.processCronEvent(evt, cronConfig, backgroundManager, background);
    expect(res).toBeTruthy();
  }, 500);
});
