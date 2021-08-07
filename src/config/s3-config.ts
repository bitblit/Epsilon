import { GenericAwsEventHandlerFunction } from './generic-aws-event-handler-function';
import { S3Event } from 'aws-lambda';

export interface S3Config {
  // S3 events mapped by bucket name
  createHandlers: Map<string, GenericAwsEventHandlerFunction<S3Event>>;
  removeHandlers: Map<string, GenericAwsEventHandlerFunction<S3Event>>;
}
