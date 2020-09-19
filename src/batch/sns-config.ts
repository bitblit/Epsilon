import { SnsHandlerFunction } from './sns-handler-function';

export interface SnsConfig {
  // Map of TopicARN to handler
  handlers: Map<string, SnsHandlerFunction>;
}
