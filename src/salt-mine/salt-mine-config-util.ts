import { SaltMineProcessor } from './salt-mine-processor';
import { SaltMineConfig } from './salt-mine-config';
import fs from 'fs';
import yaml from 'js-yaml';
import { ErrorRatchet, Logger, StringRatchet } from '@bitblit/ratchet/dist/common';
import util from 'util';

export class SaltMineConfigUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static async yamlStringToSaltMineConfig(yamlString: string): Promise<SaltMineConfig> {
    if (!StringRatchet.trimToNull(yamlString)) {
      ErrorRatchet.throwFormattedErr('Cannot create config missing yaml');
    }
    const doc: any = yaml.load(yamlString);

    const out: SaltMineConfig = doc;
    return out;
  }

  public static async yamlFileToSaltMineConfig(filepath: string): Promise<SaltMineConfig> {
    const contents: string = fs.readFileSync(filepath).toString();
    const rval: SaltMineConfig = await SaltMineConfigUtil.yamlStringToSaltMineConfig(contents);
    return rval;
  }

  public static processNames(cfg: SaltMineConfig): string[] {
    return cfg && cfg.processes ? Object.keys(cfg.processes) : null;
  }

  public static developmentConfig(cfg: SaltMineConfig): boolean {
    return !!cfg && !!cfg.development;
  }

  public static awsConfig(cfg: SaltMineConfig): boolean {
    return !!cfg && !!cfg.aws;
  }

  public static validateConfig(cfg: SaltMineConfig): string[] {
    const rval: string[] = [];
    if (!cfg) {
      rval.push('Null config');
    } else {
      if (!cfg.processes || cfg.processes.size === 0) {
        rval.push('No processes specified');
      }
      if (!cfg.development && !cfg.aws) {
        rval.push('Neither AWS nor development server configured');
      }
      if (cfg.aws && cfg.development) {
        rval.push('Both AWS AND development server configured');
      }
      if (cfg.aws) {
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
      if (cfg.development) {
        if (!cfg.development.url) {
          rval.push('Development config missing url');
        }
      }
    }
    return rval;
  }

  public static validateProcessorsAgainstConfig(
    cfg: SaltMineConfig,
    processors: Map<string, SaltMineProcessor | SaltMineProcessor[]>
  ): string[] {
    const rval: string[] = SaltMineConfigUtil.validateConfig(cfg);
    if (!processors || processors.size === 0) {
      rval.push('No processors supplied You must supply processors');
    } else {
      if (cfg && cfg.processes) {
        Object.keys(cfg.processes).forEach((key) => {
          if (!processors.has(key)) {
            rval.push(util.format('Config defines process %s but no matching processor found', key));
          }
        });

        Array.from(processors.keys()).forEach((key) => {
          if (!cfg.processes[key]) {
            rval.push(util.format('Processors defines %s but it is not present in the config process list', key));
          }
        });
      }
    }
    return rval;
  }
}
