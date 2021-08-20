import { InternalBackgroundEntry } from '../../background/internal-background-entry';

export interface BackgroundTransactionLog {
  request: InternalBackgroundEntry<any>;
  running: boolean;
  runtimeMS?: number;
  result?: any;
  error?: any;
}
