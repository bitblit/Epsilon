import { BuildInformation } from '@bitblit/ratchet/common';
import { RunBackgroundProcessFromCommandLine } from './run-background-process-from-command-line';
import { TestErrorServer } from '../sample/test-error-server';
import { LocalContainerServer } from '../local-container-server';
import { RatchetEpsilonCommonInfo } from '../build/ratchet-epsilon-common-info';
import {AbstractRatchetCliHandler} from "@bitblit/ratchet/node-only/cli/abstract-ratchet-cli-handler";
import {SampleServerComponents} from "../sample/sample-server-components";

export class RatchetCliHandler extends AbstractRatchetCliHandler {
  fetchHandlerMap(): Record<string, any> {
    return {
      'run-background-process': RunBackgroundProcessFromCommandLine.runFromCliArgs,
      'run-test-error-server': TestErrorServer.runFromCliArgs,
      'run-local-container-server': LocalContainerServer.runFromCliArgs,
      'run-sample-local-server': SampleServerComponents.runSampleLocalServerFromCliArgs,
      'run-sample-local-batch-server': SampleServerComponents.runSampleLocalServerFromCliArgs,
    };
  }

  fetchVersionInfo(): BuildInformation {
    return RatchetEpsilonCommonInfo.buildInformation();
  }
}
