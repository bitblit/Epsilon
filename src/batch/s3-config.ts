import { S3CreateHandlerFunction } from './s3-create-handler-function';
import { S3RemoveHandlerFunction } from './s3-remove-handler-function';

export interface S3Config {
  // S3 events mapped by bucket name
  createHandlers: Map<string, S3CreateHandlerFunction>;
  removeHandlers: Map<string, S3RemoveHandlerFunction>;
}
