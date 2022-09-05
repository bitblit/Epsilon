import { BackgroundProcessor } from '../../config/background/background-processor';
import { BackgroundManager } from '../../background-manager';
import { Logger } from '@bitblit/ratchet/common/logger';

export class NoOpProcessor implements BackgroundProcessor<any> {
  public get typeName(): string {
    return 'EpsilonNoOp';
  }

  public async handleEvent(data: any, mgr?: BackgroundManager): Promise<void> {
    // Does nothing
    Logger.silly('Hit the no-op proc');
  }
}
