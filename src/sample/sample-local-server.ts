/**
 * This is an example of how to setup a local server for testing.  Replace the createRouterConfig function
 * with your own.
 */
import { Logger } from '@bitblit/ratchet/common/logger';
import { SampleServerComponents } from './sample-server-components';
import { LocalServer } from '../local-server';
import { LoggerLevelName } from '@bitblit/ratchet/common';
import { LocalWebTokenManipulator } from '../http/auth/local-web-token-manipulator';

Logger.setLevel(LoggerLevelName.debug);
const token: string = new LocalWebTokenManipulator(['abcd1234'], 'sample-server').createJWTString('asdf', {}, ['USER'], 3600);
Logger.info('Use token: %s', token);

SampleServerComponents.createSampleEpsilonGlobalHandler()
  .then((handler) => {
    const testServer: LocalServer = new LocalServer(handler);
    testServer.runServer().then((res) => {
      Logger.info('Got res server');
      process.exit(0);
    });
  })
  .catch((err) => {
    Logger.error('Error: %s', err, err);
    process.exit(1);
  });
