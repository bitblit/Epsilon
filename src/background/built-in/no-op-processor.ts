import { BackgroundProcessor } from '../background-processor';
import { BackgroundManager } from '../background-manager';

export class NoOpProcessor implements BackgroundProcessor<any> {
  public get typeName(): string {
    return 'EpsilonNoOp';
  }

  public async handleEvent(data: any, mgr?: BackgroundManager): Promise<void> {
    // Does nothing
  }
}
