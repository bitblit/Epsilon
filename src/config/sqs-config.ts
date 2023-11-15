import { GenericAwsEventHandlerFunction } from './generic-aws-event-handler-function';
import { SQSEvent } from 'aws-lambda';

export interface SqsConfig {
  // Map of TopicARN to handler
  handlers: Map<string, GenericAwsEventHandlerFunction<SQSEvent>>;
}
