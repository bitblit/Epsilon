import { Logger } from '@bitblit/ratchet/common/logger';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { program } from 'commander';

import clear from 'clear';
import { ErrorRatchet } from '@bitblit/ratchet/common';
import { EpsilonGlobalHandler } from './epsilon-global-handler';

/**
 * IMPORTANT NOTE
 * This file is part of the bootstrapper to bridge from the Epsilon Background processor
 * to the AWS Batch processing Docker setup.
 *
 * DO NOT MESS WITH IT UNLESS YOU REALLY KNOW WHAT YOU ARE DOING.
 *
 * You are likely to mess it up otherwise.
 */
export class RunBackgroundProcessFromCommandLine {
  public static async processBackgroundCliRequest(epsilon: EpsilonGlobalHandler, dryRun?: boolean): Promise<boolean> {
    let rval: boolean = false;
    // Clear screen
    clear();

    Logger.info('Bootstrapping batch processor, args : %j', process.argv);

    program
      .version('0.0.1')
      .requiredOption('-p --process <processKey>', 'Background process key')
      .option('-d --data <data>', 'Background data block, JSON encoded')
      .option('-m --metadata <metadata>', 'Background metadata block, JSON encoded')
      .parse(process.argv);
    Logger.info('Program definition : %s : %s : %s', program.opts().process, program.opts().data, program.opts().meta);

    let data: any = {};
    if (StringRatchet.trimToNull(program.opts().data)) {
      data = JSON.parse(program.opts().data);
    }
    if (dryRun) {
      Logger.info('Dry run specified - not executing');
      rval = false;
    } else {
      if (!epsilon) {
        ErrorRatchet.throwFormattedErr('Cannot run background cli because epsilon global handler is null');
      }

      rval = await epsilon.processSingleBackgroundByParts<any>(program.opts().process, data);
    }
    return rval;
  }
}
