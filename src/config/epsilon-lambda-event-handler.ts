import { Context, ProxyResult } from 'aws-lambda';

export interface EpsilonLambdaEventHandler<T> {
  handlesEvent(evt: any): boolean;
  extractLabel(evt: T, context: Context): string;
  processEvent(evt: T, context: Context): Promise<ProxyResult>;
  // If you define a processUncaughtError function, then any errors that are thrown while running this handler,
  // and not caught by the handler itself, will be processed by this.  Usually you wouldn't implement this
  // function (since you would want the default 'catch/log/return 500' logic, but if you want retries,
  // (eg, for Dynamo, Kinesis, etc) you can override this to allow the error to slip outside Epsilon
  processUncaughtError?(evt: T, context: Context, err: Error): Promise<ProxyResult>;
}
