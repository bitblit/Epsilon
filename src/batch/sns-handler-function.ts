import { SNSEvent } from 'aws-lambda';

export interface SnsHandlerFunction {
  (event: SNSEvent): Promise<void>;
}
