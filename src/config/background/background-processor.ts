import { BackgroundManager } from '../../background-manager';

export interface BackgroundProcessor<T> {
  typeName: string; // The name for this processor

  // If set, data will be validated against this before submitted
  // Yes, if using explicitly pathed and configured routes it'll get
  // validated twice... the price I pay to support both pathed and
  // single-post background support
  dataSchemaName?: string;

  // Returns void since you can't use the result anyway
  handleEvent(data: T, mgr: BackgroundManager): Promise<void>;
}
