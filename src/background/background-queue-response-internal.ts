import { BackgroundProcessHandling } from './background-process-handling';

export interface BackgroundQueueResponseInternal {
  processHandling: BackgroundProcessHandling;
  startProcessorRequested: boolean;
  success: boolean;
  resultId: string;
  error: string;
}
