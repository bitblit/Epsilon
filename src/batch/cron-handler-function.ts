import {ScheduledEvent} from 'aws-lambda';

export interface CronHandlerFunction {
    (event: ScheduledEvent): Promise<any>
}
