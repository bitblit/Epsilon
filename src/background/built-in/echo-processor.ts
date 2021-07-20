import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundConfig } from '../background-config';

export class EchoProcessor implements BackgroundProcessor<any, any> {
  public get typeName(): string {
    return 'BackgroundBuiltInEchoProcessor';
  }

  public async handleEvent(data: any, metaData: any, cfg?: BackgroundConfig): Promise<void> {
    Logger.info('Echo processing : %j : %j', data, metaData);
  }
}
