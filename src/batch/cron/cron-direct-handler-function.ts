import { ScheduledEvent } from 'aws-lambda';

export interface CronDirectHandlerFunction {
  (event: ScheduledEvent): Promise<void>;
}
