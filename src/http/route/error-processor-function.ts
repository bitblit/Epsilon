import { APIGatewayEvent } from 'aws-lambda';
import { EpsilonRouter } from './epsilon-router';

export interface ErrorProcessorFunction {
  (event: APIGatewayEvent, err: Error, cfg: EpsilonRouter): Promise<void>;
}
