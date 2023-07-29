#!/usr/bin/env node

import { RunBackgroundProcessFromCommandLine } from '../run-background-process-from-command-line';
import { Logger } from '@bitblit/ratchet/common';
import { CliRatchet } from '@bitblit/ratchet/node-only';

if (
  process?.argv?.length &&
  CliRatchet.isCalledFromCLI([
    'epsilon-run-background-process-from-command-line-dry-run.js',
    'epsilon-run-background-process-from-command-line-dry-run',
  ])
) {
  RunBackgroundProcessFromCommandLine.processBackgroundCliRequest(null, true)
    .then((out) => {
      Logger.info('Result : %s', out);
    })
    .catch((err) => Logger.error('Failed : %s', err));
} else {
  // Ignore it - they weren't trying to run you
}
