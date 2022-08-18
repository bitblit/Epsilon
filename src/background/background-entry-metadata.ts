export interface BackgroundEntryMetadata {
  traceId: string;
  traceDepth: number;
  userMeta?: Record<string, string | number | boolean>;
}
