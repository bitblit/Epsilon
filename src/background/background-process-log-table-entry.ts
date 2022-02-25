export interface BackgroundProcessLogTableEntry {
  env: string;
  backgroundQueueName: string;
  requestId: string;
  guid: string;
  processTypeName: string;
  state: string;
  timestampEpochMs: number;
  error?: string;
  params?: any;
}
