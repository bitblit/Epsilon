import { GenericAwsEventHandlerFunction } from './generic-aws-event-handler-function';
import { SNSEvent } from 'aws-lambda';

export interface SnsConfig {
  // Map of TopicARN to handler
  handlers: Map<string, GenericAwsEventHandlerFunction<SNSEvent>>;
}
