import { GenericAwsEventHandlerFunction } from './generic-aws-event-handler-function';
import { DynamoDBStreamEvent } from 'aws-lambda';

export interface DynamoDbConfig {
  handlers: Map<string, GenericAwsEventHandlerFunction<DynamoDBStreamEvent>>;
}
