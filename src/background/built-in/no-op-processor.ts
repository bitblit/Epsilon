import { BackgroundProcessor } from '../background-processor';
import { BackgroundConfig } from '../background-config';
import { BackgroundManager } from '../background-manager';

export class NoOpProcessor implements BackgroundProcessor<any, any> {
  public get typeName(): string {
    return 'NoOpProcessor';
  }

  public async handleEvent(data: any, metaData: any, mgr?: BackgroundManager): Promise<void> {
    // Does nothing
  }
}
