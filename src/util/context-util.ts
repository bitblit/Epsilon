import { Context } from 'aws-lambda';
import { EpsilonGlobalHandler } from '../epsilon-global-handler';

// This class serves as a static holder for the AWS Lambda context, and also adds some
// simple helper functions
export class ContextUtil {
  private static contextCache: Context;

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static currentRequestId(): string {
    const ctx: Context = EpsilonGlobalHandler.CURRENT_CONTEXT;
    return ctx ? ctx.awsRequestId : null;
  }

  public static remainingTimeMS(): number {
    const ctx: Context = EpsilonGlobalHandler.CURRENT_CONTEXT;
    return ctx ? ctx.getRemainingTimeInMillis() : null;
  }
}
