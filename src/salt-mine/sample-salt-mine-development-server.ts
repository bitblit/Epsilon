/**
 * This is an example of how to setup a local server for testing.  Replace the createRouterConfig function
 * with your own.
 */
import { Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineDevelopmentServer } from './salt-mine-development-server';
import { SaltMineNamedProcessor } from './salt-mine-named-processor';
import { EchoProcessor } from './built-in/echo-processor';
import { SampleDelayProcessor } from './built-in/sample-delay-processor';

Logger.setLevelByName('debug');

const processors: SaltMineNamedProcessor<any, any>[] = [new EchoProcessor(), new SampleDelayProcessor()];

const testServer: SaltMineDevelopmentServer = new SaltMineDevelopmentServer(processors);

testServer
  .runServer()
  .then((res) => {
    Logger.info('Got res server');
    process.exit(0);
  })
  .catch((err) => {
    Logger.error('Error: %s', err, err);
    process.exit(1);
  });
