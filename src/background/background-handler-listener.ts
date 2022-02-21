import { BackgroundHandlerEvent } from './background-handler-event';

export interface BackgroundHandlerListener {
  onEvent(event: BackgroundHandlerEvent): Promise<void>;
}
