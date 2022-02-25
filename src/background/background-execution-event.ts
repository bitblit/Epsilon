import { BackgroundExecutionEventType } from './background-execution-event-type';

export interface BackgroundExecutionEvent<T> {
  type: BackgroundExecutionEventType;
  guid: string;
  processorType: string;
  data: T;
  errors?: string[];
}
