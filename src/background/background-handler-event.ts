import { BackgroundHandlerEventType } from './background-handler-event-type';

export class BackgroundHandlerEvent {
  type: BackgroundHandlerEventType;
  guid: string;
  processorType: string;
  data: any;

  constructor(type: BackgroundHandlerEventType, processorType: string, data: any = null) {
    this.type = type;
    this.processorType = processorType;
    this.data = data;
  }
}
