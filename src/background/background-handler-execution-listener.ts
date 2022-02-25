import { BackgroundHandlerExecutionEvent } from './background-handler-execution-event';

export interface BackgroundHandlerExecutionListener {
  onEvent(event: BackgroundHandlerExecutionEvent): Promise<void>;
}
