import { AbstractCronEntry } from './abstract-cron-entry';

/**
  of 2020-04-30, my recommendation is that CRON should be used ONLY to fire
 * off Background tasks (this makes your CRON stuff easier to debug since it can
 * be called from anywhere, not just CRON, and also makes sure that your processor
 * gets the full 15 minutes if necessary)
 *
 * This simplifies doing that - you can basically just configure the set of
 * constraints, and the background task to fire off if the constraints match.
 */
export interface CronBackgroundEntry extends AbstractCronEntry {
  backgroundTaskType: string;
  fireImmediate: boolean;

  data?: any;
}
