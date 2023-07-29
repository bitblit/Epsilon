import { BackgroundTransactionLog } from './background-transaction-log';

export interface BackgroundTransactionLogger {
  logTransaction(txLog: BackgroundTransactionLog): Promise<void>;
  readTransactionLog(txGuid: string): Promise<BackgroundTransactionLog>;
}
