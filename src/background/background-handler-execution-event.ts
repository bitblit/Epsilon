import { BackgroundHandlerExecutionEventType } from './background-handler-execution-event-type';

export class BackgroundHandlerExecutionEvent {
  type: BackgroundHandlerExecutionEventType;
  guid: string;
  processorType: string;
  data: any;

  constructor(type: BackgroundHandlerExecutionEventType, processorType: string, data: any = null) {
    this.type = type;
    this.processorType = processorType;
    this.data = data;
  }
}
