import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundManager } from '../background-manager';

export class SampleInputValidatedProcessor implements BackgroundProcessor<SampleInputValidatedProcessorData> {
  public get typeName(): string {
    return 'BackgroundBuiltInSampleInputValidatedProcessor';
  }

  public async handleEvent(data: SampleInputValidatedProcessorData, mgr?: BackgroundManager): Promise<void> {
    Logger.info('Running SampleInputValidatedProcessor, data was : %j, meta was: %j', data);
  }

  public get dataSchema(): string {
    return 'BackgroundSampleInputValidatedProcessorData';
  }
}

export interface SampleInputValidatedProcessorData {
  nameParam: string;
  numberParam: number;
}