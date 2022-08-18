import { Context } from 'aws-lambda';

export interface LoggingTraceIdGenerator {
  (event?: any, context?: Context): string;
}
