import { Logger } from '@bitblit/ratchet/common';
import { BackgroundErrorProcessor } from '../../config/background/background-error-processor';
import { InternalBackgroundEntry } from '../../background/internal-background-entry';

// This is just here to test error processor logic (errors are logged anyway)
export class LogMessageBackgroundErrorProcessor implements BackgroundErrorProcessor {
  public async handleError(submission: InternalBackgroundEntry<any>, error: Error): Promise<void> {
    Logger.error('-------- ERROR PROCESSED : %j : %s----', submission, error);
  }
}
