import { Logger } from '@bitblit/ratchet/common';
import { BackgroundProcessor } from '../../config/background/background-processor';
import { BackgroundManager } from '../../background-manager';
import { SampleInputValidatedProcessorData } from './sample-input-validated-processor-data';

export class SampleInputValidatedProcessor implements BackgroundProcessor<SampleInputValidatedProcessorData> {
  public get typeName(): string {
    return 'EpsilonSampleInputValidated';
  }

  public async handleEvent(data: SampleInputValidatedProcessorData, mgr?: BackgroundManager): Promise<void> {
    Logger.info('Running SampleInputValidatedProcessor, data was : %j', data);
  }

  public get dataSchemaName(): string {
    return 'BackgroundSampleInputValidatedProcessorData';
  }
}
