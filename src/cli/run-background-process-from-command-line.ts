import {BooleanRatchet, Logger} from '@bitblit/ratchet/common';
import {EpsilonGlobalHandler} from '../epsilon-global-handler.js';

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
  public static async runFromCliArgs(args: string[]): Promise<void> {
    if (args.length > 1) {
      const procName: string = args[0];
      const dryRun: boolean = args.length > 1 && BooleanRatchet.parseBool(args[1]);
      const data: any = args.length > 2 ? JSON.parse(args[2]) : null;
      const meta: any = args.length > 3 ? JSON.parse(args[3]) : null;
      const epsilon: EpsilonGlobalHandler = null; // TODO: How to pass this in?

      if (dryRun) {
        Logger.info('Dry-Run, would have sent : %s %j %j', procName, data, meta);
      } else {
        await epsilon.processSingleBackgroundByParts(procName, data, meta);
      }
    } else {
      console.log('Usage : run-background-process {processName} {dryRun true/false} {dataJson} {metaJson}');
    }
  }
}
