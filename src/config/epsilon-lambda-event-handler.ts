import { Context, ProxyResult } from 'aws-lambda';

export interface EpsilonLambdaEventHandler<T> {
  handlesEvent(evt: any): boolean;
  extractLabel(evt: T, context: Context): string;
  processEvent(evt: T, context: Context): Promise<ProxyResult>;
}
