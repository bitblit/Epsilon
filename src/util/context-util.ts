import { Context, ProxyResult } from 'aws-lambda';
import { NumberRatchet } from '@bitblit/ratchet/common/number-ratchet';
import { EpsilonInstance } from '../epsilon-instance';
import { ErrorRatchet } from '@bitblit/ratchet/common/error-ratchet';
import { LoggingTraceIdGenerator } from '../config/logging-trace-id-generator';
import { BuiltInTraceIdGenerators } from '../built-in/built-in-trace-id-generators';
import { BackgroundEntry } from '../background/background-entry';
import { Logger } from '@bitblit/ratchet/common/logger';
import { InternalBackgroundEntry } from '../background/internal-background-entry';
import { InterApiEntry } from '../inter-api/inter-api-entry';

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

  public static setOverrideTrace(traceId: string, traceDepth: number): void {
    ContextUtil.CURRENT_OVERRIDE_TRACE_ID = traceId || ContextUtil.CURRENT_OVERRIDE_TRACE_ID;
    ContextUtil.CURRENT_OVERRIDE_TRACE_DEPTH = traceDepth || ContextUtil.CURRENT_OVERRIDE_TRACE_DEPTH;
  }

  public static setOverrideTraceFromInternalBackgroundEntry(entry: InternalBackgroundEntry<any>): void {
    ContextUtil.setOverrideTrace(entry.traceId, entry.traceDepth);
  }

  public static setOverrideTraceFromInterApiEntry(interApiEntry: InterApiEntry<any>): void {
    ContextUtil.setOverrideTrace(interApiEntry.traceId, interApiEntry.traceDepth);
  }

  public static addHeadersToRecord(input: Record<string, any>, depthOffset: number = 0): void {
    if (input) {
      input[ContextUtil.traceHeaderName()] = ContextUtil.currentTraceId();
      input[ContextUtil.traceDepthHeaderName()] = ContextUtil.currentTraceDepth() + depthOffset;
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
    ContextUtil.addHeadersToRecord(ri.headers, 1);
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
    const headerName: string = ContextUtil?.CURRENT_EPSILON_REFERENCE?.config?.loggerConfig?.traceHeaderName || 'X-EP-TRACE-ID';
    return headerName;
  }

  private static traceDepthHeaderName(): string {
    const headerName: string = ContextUtil?.CURRENT_EPSILON_REFERENCE?.config?.loggerConfig?.traceDepthHeaderName || 'X-EP-TRACE-DEPTH';
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
      NumberRatchet.safeNumber(ContextUtil.CURRENT_EVENT?.headers?.[ContextUtil.traceDepthHeaderName()]) ||
      1;
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
