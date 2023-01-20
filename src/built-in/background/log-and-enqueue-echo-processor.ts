import { Logger } from '@bitblit/ratchet/common';
import { BackgroundProcessor } from '../../config/background/background-processor';
import { EchoProcessor } from './echo-processor';
import { BackgroundManagerLike } from '../../background/manager/background-manager-like';

export class LogAndEnqueueEchoProcessor implements BackgroundProcessor<any> {
  public get typeName(): string {
    return 'EpsilonLogAndEnqueueEcho';
  }

  public async handleEvent(data: any, cfg: BackgroundManagerLike): Promise<void> {
    Logger.info('LogAndEnqueueEchoProcessor : %j', data);
    await cfg.fireImmediateProcessRequestByParts(EchoProcessor.TYPE_NAME, { upstream: data });
    Logger.info('Completed : LogAndEnqueueEchoProcessor');
  }
}
