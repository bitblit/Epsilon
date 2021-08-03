import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundManager } from '../background-manager';

export class EchoProcessor implements BackgroundProcessor<any> {
  public static TYPE_NAME: string = 'EpsilonEcho';
  public get typeName(): string {
    return EchoProcessor.TYPE_NAME;
  }

  public async handleEvent(data: any, mgr?: BackgroundManager): Promise<void> {
    Logger.info('Echo processing : %j', data);
  }
}
