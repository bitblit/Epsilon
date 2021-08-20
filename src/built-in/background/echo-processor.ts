import { ErrorRatchet, Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../../config/background/background-processor';
import { BackgroundManager } from '../../background-manager';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';

export class EchoProcessor implements BackgroundProcessor<any> {
  public static TYPE_NAME: string = 'EpsilonEcho';
  public get typeName(): string {
    return EchoProcessor.TYPE_NAME;
  }

  public async handleEvent(data: any, mgr?: BackgroundManager): Promise<void> {
    Logger.info('Echo processing : %j', data);
    if (data && StringRatchet.trimToNull(data['error'])) {
      ErrorRatchet.throwFormattedErr('Forced error : %s', data['error']);
    }
  }
}
