import { ScheduledEvent } from 'aws-lambda';
import { CronConfig } from './batch/cron/cron-config';
import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { SaltMineConfig } from './salt-mine/salt-mine-config';
import { SaltMineHandler } from './salt-mine/salt-mine-handler';
import { SaltMineQueueManager } from './salt-mine/salt-mine-queue-manager';
import { LocalSaltMineQueueManager } from './salt-mine/local-salt-mine-queue-manager';

// jest.mock('@bitblit/saltmine');

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
      saltMineEntries: [
        {
          saltMineTaskType: 'test',
          fireImmediate: true,
          data: () => {
            return { curDate: new Date().toISOString(), fixed: 'abc' };
          },
          metadata: { a: 'b' },
        },
      ],
    };
    const smConfig: SaltMineConfig = {
      processors: [],
      aws: null,
    };
    const saltMine = new SaltMineHandler(null, null);
    saltMine.getConfig = jest.fn(() => smConfig);

    const backgroundManager: SaltMineQueueManager = new LocalSaltMineQueueManager(null, null);

    const res: boolean = await EpsilonGlobalHandler.processCronEvent(evt, cronConfig, backgroundManager, saltMine);
    expect(res).toBeTruthy();
  }, 500);
});
