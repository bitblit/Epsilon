import {CronHandlerFunction} from './cron-handler-function';

export interface CronConfig {
    // Mapped from the name of the schedule
    handlers: Map<string, CronHandlerFunction>;
}
