import { APIGatewayEvent } from 'aws-lambda';
import { RouterConfig } from './router-config';
import { HttpError } from '../error/http-error';

export interface ErrorProcessorFunction {
  (event: APIGatewayEvent, err: HttpError, cfg: RouterConfig): Promise<void>;
}
