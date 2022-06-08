import { ErrorRatchet } from '@bitblit/ratchet/dist/common';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { CliRatchet } from '@bitblit/ratchet/dist/node-only';
import { RunBackgroundProcessFromCommandLine } from './run-background-process-from-command-line';
import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { EpsilonConstants } from './epsilon-constants';

/**
 * IMPORTANT NOTE
 * This file is part of the bootstrapper to bridge from the Epsilon Background processor
 * to the AWS Batch processing Docker setup.
 *
 * DO NOT MESS WITH IT UNLESS YOU REALLY KNOW WHAT YOU ARE DOING.
 *
 * You are likely to mess it up otherwise.
 */

export class AwsBatchCore {
  public static start(): void {
    if (CliRatchet.isCalledFromCLI('aws-batch-cli')) {
      this.bootstrapRun(EpsilonConstants.findGloballyAvailableEpsilonGlobalHandler())
        .then(() => {
          Logger.info('Complete');
          process.exit(0);
        })
        .catch((err) => {
          Logger.error('Outer error of batch processor: %s', err, err);
          process.exit(1);
        });
    } else {
      // Do nothing - running unit tests, etc
    }
  }

  private static async bootstrapRun(handlerProducer: Promise<EpsilonGlobalHandler>): Promise<void> {
    try {
      const handler: EpsilonGlobalHandler = await handlerProducer;
      if (!handler) {
        ErrorRatchet.throwFormattedErr('Cannot run background cli because no global handler found');
      }

      const res: boolean = await RunBackgroundProcessFromCommandLine.processBackgroundCliRequest(handler);
      Logger.info('Process completed with %j', res);
    } catch (err) {
      Logger.error('Inner error of batch processor : %s', err, err);
      process.exit(1);
    }
  }
}
