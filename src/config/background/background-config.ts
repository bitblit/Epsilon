import { BackgroundProcessor } from './background-processor';
import { BackgroundErrorProcessor } from './background-error-processor';
import { BackgroundExecutionListener } from '../../background/background-execution-listener';
import { BackgroundTransactionLogger } from './background-transaction-logger';

export interface BackgroundConfig {
  transactionLogger?: BackgroundTransactionLogger;
  errorProcessor?: BackgroundErrorProcessor;
  httpStatusEndpoint?: string;
  httpMetaEndpoint?: string;
  httpSubmissionPath: string;
  implyTypeFromPathSuffix: boolean;
  processors: BackgroundProcessor<any>[];
  executionListeners?: BackgroundExecutionListener<any>[];
}
