import { Context, ProxyResult } from 'aws-lambda';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';
import { EpsilonInstance } from '../epsilon-instance';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { LoggingTraceIdGenerator } from '../config/logging-trace-id-generator';
import { BuiltInTraceIdGenerators } from '../built-in/built-in-trace-id-generators';
import { BackgroundEntry } from '../background/background-entry';
import { Logger } from '@bitblit/ratchet/dist/common/logger';

// This class serves as a static holder for the AWS Lambda context, and also adds some
// simple helper functions
export class ContextUtil {
  // This only really works because Node is single-threaded - otherwise need some kind of thread local
  private static CURRENT_EPSILON_REFERENCE: EpsilonInstance;
  private static CURRENT_CONTEXT: Context;
  private static CURRENT_EVENT: any;
  private static CURRENT_LOG_VARS: Record<string, string | number | boolean> = {};
  private static CURRENT_PROCESS_LABEL: string;

  private static CURRENT_OVERRIDE_TRACE_ID: string;
  private static CURRENT_OVERRIDE_TRACE_DEPTH: number;

  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static initContext(epsilon: EpsilonInstance, evt: any, ctx: Context, processLabel: string): void {
    ContextUtil.CURRENT_EPSILON_REFERENCE = epsilon;
    ContextUtil.CURRENT_CONTEXT = ctx;
    ContextUtil.CURRENT_EVENT = evt;
    ContextUtil.CURRENT_LOG_VARS = {};
    ContextUtil.CURRENT_PROCESS_LABEL = processLabel;
  }

  public static clearContext() {
    ContextUtil.CURRENT_EPSILON_REFERENCE = null;
    ContextUtil.CURRENT_CONTEXT = null;
    ContextUtil.CURRENT_EVENT = null;
    ContextUtil.CURRENT_LOG_VARS = {};
    ContextUtil.CURRENT_PROCESS_LABEL = null;
    ContextUtil.CURRENT_OVERRIDE_TRACE_ID = null;
    ContextUtil.CURRENT_OVERRIDE_TRACE_DEPTH = null;
  }

  public static setTraceFromBackgroundEntry(be: BackgroundEntry<any>): void {
    if (be?.meta?.traceId) {
      ContextUtil.CURRENT_OVERRIDE_TRACE_ID = be.meta.traceId;
      ContextUtil.CURRENT_OVERRIDE_TRACE_DEPTH = NumberRatchet.safeNumber(be.meta.traceDepth, 1);
    } else {
      Logger.info('Cannot set trace from background entry that lacks the meta fields : %j', be);
    }
  }

  public static addHeadersToRecord(input: Record<string, any>): void {
    if (input) {
      input[ContextUtil.traceHeaderName()] = ContextUtil.currentTraceId();
      input[ContextUtil.traceDepthHeaderName()] = ContextUtil.currentTraceDepth() + 1;
    } else {
      ErrorRatchet.throwFormattedErr('Cannot add headers to null/undefined input');
    }
  }

  public static addTraceToProxyResult(pr: ProxyResult): void {
    pr.headers = pr.headers || {};
    ContextUtil.addHeadersToRecord(pr.headers);
  }

  public static addTraceToHttpRequestInit(ri: RequestInit): void {
    ri.headers = ri.headers || {};
    ContextUtil.addHeadersToRecord(ri.headers);
  }

  public static setProcessLabel(processLabel: string): void {
    ContextUtil.CURRENT_PROCESS_LABEL = processLabel;
  }

  public static currentRequestId(): string {
    const ctx: Context = ContextUtil.CURRENT_CONTEXT;
    return ctx ? ctx.awsRequestId : null;
  }

  public static remainingTimeMS(): number {
    const ctx: Context = ContextUtil.CURRENT_CONTEXT;
    return ctx ? ctx.getRemainingTimeInMillis() : null;
  }

  public static currentProcessLabel(): string {
    return ContextUtil.CURRENT_PROCESS_LABEL || 'unset';
  }

  private static traceHeaderName(): string {
    const headerName: string = ContextUtil?.CURRENT_EPSILON_REFERENCE?.config?.loggerConfig?.traceHeaderName || 'x-trace-id';
    return headerName;
  }

  private static traceDepthHeaderName(): string {
    const headerName: string = ContextUtil?.CURRENT_EPSILON_REFERENCE?.config?.loggerConfig?.traceDepthHeaderName || 'x-trace-depth';
    return headerName;
  }

  public static currentTraceId(): string {
    const traceFn: LoggingTraceIdGenerator =
      ContextUtil?.CURRENT_EPSILON_REFERENCE?.config?.loggerConfig?.traceIdGenerator || BuiltInTraceIdGenerators.fullAwsRequestId;
    const traceId: string =
      ContextUtil.CURRENT_OVERRIDE_TRACE_ID ||
      ContextUtil.CURRENT_EVENT?.headers?.[ContextUtil.traceHeaderName()] ||
      traceFn(ContextUtil.CURRENT_EVENT, ContextUtil.CURRENT_CONTEXT);
    return traceId;
  }

  public static currentTraceDepth(): number {
    const caller: number =
      ContextUtil.CURRENT_OVERRIDE_TRACE_DEPTH ||
      NumberRatchet.safeNumber(ContextUtil.CURRENT_EVENT?.headers?.[ContextUtil.traceDepthHeaderName()], 1);
    return caller;
  }

  public static addLogVariable(name: string, val: string | number | boolean): void {
    ContextUtil.CURRENT_LOG_VARS[name] = val;
  }

  public static fetchLogVariable(name: string): string | number | boolean {
    return ContextUtil.CURRENT_LOG_VARS?.[name];
  }

  public static fetchLogVariables(): Record<string, string | number | boolean> {
    return Object.assign({}, ContextUtil.CURRENT_LOG_VARS || {});
  }
}
