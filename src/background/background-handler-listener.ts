import { BackgroundProcessor } from '../config/background/background-processor';
import { InternalBackgroundEntry } from './internal-background-entry';

export interface BackgroundHandlerListener {
  processDataValidationError(processorInput: BackgroundProcessor<any>, dataValidationErrors: string[]): Promise<void>;
  executionComplete(processorInput: BackgroundProcessor<any>, result: any): Promise<void>;
  executionError(e: InternalBackgroundEntry<any>, err): Promise<void>;
}
