import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundConfig } from '../background-config';
import { BackgroundManager } from '../background-manager';

export class EchoProcessor implements BackgroundProcessor<any, any> {
  public static TYPE_NAME: string = 'BackgroundBuiltInEchoProcessor';
  public get typeName(): string {
    return EchoProcessor.TYPE_NAME;
  }

  public async handleEvent(data: any, metaData: any, mgr?: BackgroundManager): Promise<void> {
    Logger.info('Echo processing : %j : %j', data, metaData);
  }
}
