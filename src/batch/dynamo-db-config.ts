import { DynamoDbHandlerFunction } from './dynamo-db-handler-function';

export interface DynamoDbConfig {
  handlers: Map<string, DynamoDbHandlerFunction>;
}
