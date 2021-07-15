import { SaltMineNamedProcessor } from '../salt-mine-named-processor';
import { SaltMineConfig } from '../salt-mine-config';

export class NoOpProcessor implements SaltMineNamedProcessor<any, any> {
  public get typeName(): string {
    return 'NoOpProcessor';
  }

  public async handleEvent(data: any, metaData: any, cfg?: SaltMineConfig): Promise<void> {
    // Does nothing
  }
}
