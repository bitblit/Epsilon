import { Logger } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from '../background-processor';
import { BackgroundManager } from '../background-manager';

export class SampleInputValidatedProcessor
  implements BackgroundProcessor<SampleInputValidatedProcessorData, SampleInputValidatedProcessorMetaData>
{
  public get typeName(): string {
    return 'BackgroundBuiltInSampleInputValidatedProcessor';
  }

  public async handleEvent(
    data: SampleInputValidatedProcessorData,
    metaData: SampleInputValidatedProcessorMetaData,
    mgr?: BackgroundManager
  ): Promise<void> {
    Logger.info('Running SampleInputValidatedProcessor, data was : %j, meta was: %j', data, metaData);
  }

  public get dataSchema(): string {
    return 'BackgroundSampleInputValidatedProcessorData';
  }

  validateMetaData(input: SampleInputValidatedProcessorMetaData): string[] {
    const rval: string[] = [];
    if (!input) {
      rval.push('No metadata');
    } else if (!input.metaFieldString || input.metaFieldString.length < 4) {
      rval.push('metaFieldString must be set and at least 4 characters');
    }
    return rval;
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
