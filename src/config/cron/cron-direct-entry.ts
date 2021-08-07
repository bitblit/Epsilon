import { AbstractCronEntry } from './abstract-cron-entry';
import { CronDirectHandlerFunction } from './cron-direct-handler-function';

export interface CronDirectEntry extends AbstractCronEntry {
  directHandler: CronDirectHandlerFunction;
}
