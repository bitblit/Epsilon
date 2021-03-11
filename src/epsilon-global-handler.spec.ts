import { ScheduledEvent } from 'aws-lambda';
import { CronConfig } from './batch/cron/cron-config';
import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { SaltMineConfig, SaltMineHandler } from '@bitblit/saltmine';
import { Logger } from '@bitblit/ratchet/dist/common';

jest.mock('@bitblit/saltmine');

describe('#epsilonGlobalHandler', function () {
  it('should verify that cron data functions get executed', async () => {
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
    const smConfig: SaltMineConfig = { validTypes: ['test'], aws: null, development: { url: 'http://test', queueDelayMS: 4 } };
    const saltMine = new SaltMineHandler(null, null);
    saltMine.getConfig = jest.fn(() => smConfig);

    const res: boolean = await EpsilonGlobalHandler.processCronEvent(evt, cronConfig, saltMine);
    expect(res).toBeTruthy();
  }, 500);
});
