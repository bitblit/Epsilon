import { Logger, PromiseRatchet } from '@bitblit/ratchet/dist/common';
import { SaltMineConfig } from '../salt-mine-config';
import { SaltMineNamedProcessor } from '../salt-mine-named-processor';

export class SampleInputValidatedProcessor
  implements SaltMineNamedProcessor<SampleInputValidatedProcessorData, SampleInputValidatedProcessorMetaData>
{
  public get typeName(): string {
    return 'SaltMineBuiltInSampleInputValidatedProcessor';
  }

  public async handleEvent(
    data: SampleInputValidatedProcessorData,
    metaData: SampleInputValidatedProcessorMetaData,
    cfg?: SaltMineConfig
  ): Promise<void> {
    Logger.info('Running SampleInputValidatedProcessor, data was : %j, meta was: %j', data, metaData);
  }

  public get dataSchema(): string {
    return 'SaltMineSampleInputValidatedProcessorData';
  }

  public validateMetaData(input: SampleInputValidatedProcessorMetaData): string[] {
    const rval: string[] = [];
    if (!input) {
      rval.push('Metadata is required');
    }
    if (!input.metaFieldString || input.metaFieldString.length < 4) {
      rval.push('metaFieldString must exist and be longer than 4 characters');
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
