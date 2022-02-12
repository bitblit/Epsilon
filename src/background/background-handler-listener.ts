import { BackgroundProcessor } from '../config/background/background-processor';

export interface BackgroundHandlerListener {
  onDataValidationError(processorInput: BackgroundProcessor<any>, dataValidationErrors: string[]): Promise<void>;
  onExecutionComplete(processorInput: BackgroundProcessor<any>, result: any): Promise<void>;
  onExecutionError(type: string, err): Promise<void>;
  onExecutionStarted(type: string, data: any): Promise<void>;
}
