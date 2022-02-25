import { BackgroundExecutionEvent } from './background-execution-event';

export interface BackgroundExecutionListener<T> {
  label?: string;
  onEvent(event: BackgroundExecutionEvent<T>): Promise<void>;
}
