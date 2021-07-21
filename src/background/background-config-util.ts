import { BackgroundConfig } from './background-config';
import { ErrorRatchet, Logger, StringRatchet } from '@bitblit/ratchet/dist/common';
import { BackgroundProcessor } from './background-processor';
import { ModelValidator } from '../global/model-validator';
import { BackgroundManager } from './background-manager';

export class BackgroundConfigUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static extractValidTypes(cfg: BackgroundConfig): string[] {
    return cfg && cfg.processors ? cfg.processors.map((p) => p.typeName) : null;
  }

  public static extractDataSchemaMap(cfg: BackgroundConfig): Map<string, string> {
    const rval: Map<string, string> = new Map<string, string>();
    cfg.processors.forEach((e) => {
      if (e.dataSchema) {
        rval.set(e.typeName, e.dataSchema);
      }
    });
    return rval;
  }

  public static extractMetaDataSchemaMap(cfg: BackgroundConfig): Map<string, string> {
    const rval: Map<string, string> = new Map<string, string>();
    cfg.processors.forEach((e) => {
      if (e.metaDataSchema) {
        rval.set(e.typeName, e.metaDataSchema);
      }
    });
    return rval;
  }

  public static awsConfig(cfg: BackgroundConfig): boolean {
    return !!cfg && !!cfg.aws;
  }

  public static validateAndMapProcessors(
    processorInput: BackgroundProcessor<any, any>[],
    modelValidator: ModelValidator
  ): Map<string, BackgroundProcessor<any, any>> {
    const rval: Map<string, BackgroundProcessor<any, any>> = new Map<string, BackgroundProcessor<any, any>>();
    processorInput.forEach((p, idx) => {
      if (!p) {
        ErrorRatchet.throwFormattedErr('Null processor provided at index %d', idx);
      }
      if (!StringRatchet.trimToNull(p.typeName)) {
        ErrorRatchet.throwFormattedErr('Processor at index %d defines no name', idx);
      }

      if (rval.has(p.typeName)) {
        ErrorRatchet.throwFormattedErr('More than one processor defined for type %s', p.typeName);
      }
      if (StringRatchet.trimToNull(p.dataSchema)) {
        if (!modelValidator) {
          ErrorRatchet.throwFormattedErr('%s defines a data schema but model validator not set', p.typeName);
        }
        if (!modelValidator.fetchModel(p.dataSchema)) {
          ErrorRatchet.throwFormattedErr('%s defines a data schema %s but model validator does not contain it', p.typeName, p.dataSchema);
        }
      }

      if (StringRatchet.trimToNull(p.metaDataSchema)) {
        if (!modelValidator) {
          ErrorRatchet.throwFormattedErr('%s defines a metaData schema but model validator not set', p.typeName);
        }
        if (!modelValidator.fetchModel(p.metaDataSchema)) {
          ErrorRatchet.throwFormattedErr(
            '%s defines a metaData schema %s but model validator does not contain it',
            p.typeName,
            p.metaDataSchema
          );
        }
      }

      rval.set(p.typeName, p);
    });
    return rval;
  }

  public static validateConfig(cfg: BackgroundConfig): string[] {
    const rval: string[] = [];
    if (!cfg) {
      rval.push('Null config');
    } else {
      if (!cfg.processors || cfg.processors.length === 0) {
        rval.push('No processes specified');
      }
      if (!cfg.aws) {
        rval.push('AWS config not defined');
      } else {
        if (!cfg.aws.notificationArn) {
          rval.push('AWS config missing notificationArn');
        }
        if (!cfg.aws.queueUrl) {
          rval.push('AWS config missing queueUrl');
        }
        if (!cfg.aws.sns) {
          rval.push('AWS config missing sns');
        }
        if (!cfg.aws.sqs) {
          rval.push('AWS config missing sqs');
        }
      }
    }
    return rval;
  }

  public static backgroundConfigToBackgroundManager(
    cfg: BackgroundConfig,
    validator: ModelValidator,
    localMode: boolean
  ): BackgroundManager {
    const backgroundMgr: BackgroundManager = new BackgroundManager(
      BackgroundConfigUtil.extractValidTypes(cfg),
      cfg.aws,
      validator,
      BackgroundConfigUtil.extractDataSchemaMap(cfg),
      BackgroundConfigUtil.extractMetaDataSchemaMap(cfg),
      localMode
    );
    return backgroundMgr;
  }
}
