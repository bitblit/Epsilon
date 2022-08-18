export interface InterApiEntry<T> {
  source: string;
  type: string;
  data: T;

  traceId?: string;
  traceDepth?: number;
}
