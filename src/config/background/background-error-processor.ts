import { InternalBackgroundEntry } from '../../background/internal-background-entry';

export interface BackgroundErrorProcessor {
  handleError(submission: InternalBackgroundEntry<any>, error: Error): Promise<void>;
}
