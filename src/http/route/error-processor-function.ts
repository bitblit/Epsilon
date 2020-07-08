import { APIGatewayEvent } from 'aws-lambda';
import { RouterConfig } from './router-config';

export interface ErrorProcessorFunction {
  (event: APIGatewayEvent, err: Error, cfg: RouterConfig): Promise<void>;
}
