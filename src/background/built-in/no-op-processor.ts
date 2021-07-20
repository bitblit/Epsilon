import { BackgroundProcessor } from '../background-processor';
import { BackgroundConfig } from '../background-config';

export class NoOpProcessor implements BackgroundProcessor<any, any> {
  public get typeName(): string {
    return 'NoOpProcessor';
  }

  public async handleEvent(data: any, metaData: any, cfg?: BackgroundConfig): Promise<void> {
    // Does nothing
  }
}
