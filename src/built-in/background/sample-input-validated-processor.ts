import { Logger } from '@bitblit/ratchet/common';
import { BackgroundProcessor } from '../../config/background/background-processor';
import { SampleInputValidatedProcessorData } from './sample-input-validated-processor-data';
import { BackgroundManagerLike } from '../../background/manager/background-manager-like';

export class SampleInputValidatedProcessor implements BackgroundProcessor<SampleInputValidatedProcessorData> {
  public get typeName(): string {
    return 'EpsilonSampleInputValidated';
  }

  public async handleEvent(data: SampleInputValidatedProcessorData, mgr?: BackgroundManagerLike): Promise<void> {
    Logger.info('Running SampleInputValidatedProcessor, data was : %j', data);
  }

  public get dataSchemaName(): string {
    return 'BackgroundSampleInputValidatedProcessorData';
  }
}
