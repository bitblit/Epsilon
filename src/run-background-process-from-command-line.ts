import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import program from 'commander';
import clear from 'clear';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common';
import { EpsilonGlobalHandler } from './epsilon-global-handler';

/**
 * IMPORTANT NOTE
 * This file is part of the bootstrapper to bridge from the Epsilon Background processor
 * to the AWS Batch processing Docker setup.
 *
 * DONT MESS WITH IT UNLESS YOU REALLY KNOW WHAT YOU ARE DOING.
 *
 * You are likely to mess it up otherwise.
 */
export class RunBackgroundProcessFromCommandLine {
  public static async processBackgroundCliRequest(epsilon: EpsilonGlobalHandler): Promise<boolean> {
    if (!epsilon) {
      ErrorRatchet.throwFormattedErr('Cannot run background cli because epsilon global handler is null');
    }

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
    Logger.info('Program definition : %s : %s : %s : %j', program.process, program.data, program);

    let data: any = {};
    if (StringRatchet.trimToNull(program.data)) {
      data = JSON.parse(program.data);
    }
    rval = await epsilon.processSingleBackgroundByParts<any>(program.process, data);
    return rval;
  }
}
