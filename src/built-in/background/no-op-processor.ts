import { BackgroundProcessor } from '../../config/background/background-processor';
import { Logger } from '@bitblit/ratchet/common/logger';
import { BackgroundManagerLike } from '../../background/manager/background-manager-like';

export class NoOpProcessor implements BackgroundProcessor<any> {
  public get typeName(): string {
    return 'EpsilonNoOp';
  }

  public async handleEvent(data: any, mgr?: BackgroundManagerLike): Promise<void> {
    // Does nothing
    Logger.silly('Hit the no-op proc');
  }
}
