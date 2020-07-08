import { expect } from 'chai';
import { APIGatewayEvent, APIGatewayEventRequestContext, ScheduledEvent } from 'aws-lambda';
import * as fs from 'fs';
import { AbstractCronEntry } from '../../../src/batch/cron/abstract-cron-entry';
import { CronConfig } from '../../../src/batch/cron/cron-config';
import { CronUtil } from '../../../src/batch/cron/cron-util';

describe('#cronUtil', function() {
  this.timeout(30000);
  it('should test matching event to entry', async () => {
    const sEvent: ScheduledEvent = JSON.parse(fs.readFileSync('test/sample-json/sample-schedule-event-1.json').toString());

    const cfg: CronConfig = {
      context: 'prod',
      timezone: 'America/Los_Angeles',
      directEntries: [],
      saltMineEntries: [] // only works since this isn't checked
    };

    const cron1: AbstractCronEntry = {
      contextMatchFilter: new RegExp('prod')
    };

    const match1: boolean = CronUtil.eventMatchesEntry(sEvent, cron1, cfg);
    expect(match1).to.be.true;

    const cron2: AbstractCronEntry = {
      contextMatchFilter: new RegExp('dev')
    };

    const match2: boolean = CronUtil.eventMatchesEntry(sEvent, cron2, cfg);
    expect(match2).to.be.false;

    const cron3: AbstractCronEntry = {
      eventFilter: new RegExp('.*MyScheduledRule.*')
    };

    const match3: boolean = CronUtil.eventMatchesEntry(sEvent, cron3, cfg);
    expect(match3).to.be.true;

    const cron4: AbstractCronEntry = {
      eventFilter: new RegExp('.*NotMyRule.*')
    };

    const match4: boolean = CronUtil.eventMatchesEntry(sEvent, cron4, cfg);
    expect(match4).to.be.true;
  });
});
