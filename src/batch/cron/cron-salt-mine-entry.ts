import { AbstractCronEntry } from './abstract-cron-entry';

/**
 * As of 2020-04-30, my recommendation is that CRON should be used ONLY to fire
 * off Salt Mine tasks (this makes your CRON stuff easier to debug since it can
 * be called from anywhere, not just CRON, and also makes sure that your processor
 * gets the full 15 minutes if necessary)
 *
 * This simplifies doing that - you can basically just configure the set of
 * constraints, and the salt mine task to fire off if the constraints match.  It
 * doesn't allow setting of data, since for CRON there is nothing but the event anyway.
 */
export interface CronSaltMineEntry extends AbstractCronEntry {
  saltMineTaskType: string;
  fireImmediate: boolean;

  data?: any;
  metadata?: any;
}
