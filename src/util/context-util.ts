import { Context } from 'aws-lambda';
import { EpsilonGlobalHandler } from '../epsilon-global-handler';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';

// This class serves as a static holder for the AWS Lambda context, and also adds some
// simple helper functions
export class ContextUtil {
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

  public static currentTraceId(): string {
    const evt: any = EpsilonGlobalHandler.CURRENT_EVENT;
    const rval: string = evt?.headers?.['x-trace-id'] || ContextUtil.currentRequestId();
    return rval;
  }

  public static currentTraceDepth(): number {
    const evt: any = EpsilonGlobalHandler.CURRENT_EVENT;
    const caller: number = NumberRatchet.safeNumber(evt?.headers?.['x-trace-depth'], 0);
    return caller + 1;
  }
}
