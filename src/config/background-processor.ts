import { BackgroundManager } from '../background/background-manager';

export interface BackgroundProcessor<T> {
  typeName: string; // The name for this processor

  // Returns void since you can't use the result anyway
  handleEvent(data: T, mgr: BackgroundManager): Promise<void>;
}
