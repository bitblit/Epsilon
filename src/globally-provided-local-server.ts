import 'reflect-metadata';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { EpsilonConstants } from './epsilon-constants';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';
import { EpsilonGlobalHandler } from './epsilon-global-handler';
import { LocalServer } from './local-server';

Logger.setLevelByName('debug');
Logger.debug('Fetching handler from global');
const producer: Promise<EpsilonGlobalHandler> = EpsilonConstants.findDynamicImportEpsilonGlobalHandlerProvider();

if (producer) {
  producer
    .then((globalHandler: EpsilonGlobalHandler) => {
      //globalHandler.epsilon.backgroundManager.localMode = true;
      Logger.info('Starting local server with : %s', globalHandler);
      const testServer: LocalServer = new LocalServer(globalHandler);
      testServer
        .runServer()
        .then((svrRes) => {
          Logger.info('Finishing up');
          process.exit(0);
        })
        .catch((err) => {
          Logger.error('Server crashed: %s', err, err);
          process.exit(1);
        });
    })
    .catch((err) => {
      Logger.error('Failed to start server : %s', err);
    });
} else {
  ErrorRatchet.throwFormattedErr('Cannot continue - no producer found.');
}
