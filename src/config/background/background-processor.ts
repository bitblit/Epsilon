import { BackgroundManagerLike } from '../../background/manager/background-manager-like';

export interface BackgroundProcessor<T> {
  typeName: string; // The name for this processor

  // If set, data will be validated against this before submitted
  // Yes, if using explicitly pathed and configured routes it'll get
  // validated twice... the price I pay to support both pathed and
  // single-post background support
  dataSchemaName?: string;

  // Allowed to return since it may be logged
  handleEvent(data: T, mgr: BackgroundManagerLike): Promise<any>;
}
