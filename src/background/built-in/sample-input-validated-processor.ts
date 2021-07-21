import { Logger, PromiseRatchet } from '@bitblit/ratchet/dist/common';
import { BackgroundConfig } from '../background-config';
import { BackgroundProcessor } from '../background-processor';

export class SampleInputValidatedProcessor
  implements BackgroundProcessor<SampleInputValidatedProcessorData, SampleInputValidatedProcessorMetaData>
{
  public get typeName(): string {
    return 'BackgroundBuiltInSampleInputValidatedProcessor';
  }

  public async handleEvent(
    data: SampleInputValidatedProcessorData,
    metaData: SampleInputValidatedProcessorMetaData,
    cfg?: BackgroundConfig
  ): Promise<void> {
    Logger.info('Running SampleInputValidatedProcessor, data was : %j, meta was: %j', data, metaData);
  }

  public get dataSchema(): string {
    return 'BackgroundSampleInputValidatedProcessorData';
  }
}

export interface SampleInputValidatedProcessorData {
  nameParam: string;
  numberParam: number;
}

export interface SampleInputValidatedProcessorMetaData {
  metaFieldString: string;
  metaFieldBoolean: boolean;
}
