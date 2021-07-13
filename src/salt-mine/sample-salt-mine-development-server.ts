/**
 * This is an example of how to setup a local server for testing.  Replace the createRouterConfig function
 * with your own.
 */
import { SaltMineProcessor } from './salt-mine-processor';
import { SaltMineEntry } from './salt-mine-entry';
import { SaltMineConfig } from './salt-mine-config';
import { PromiseRatchet, Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineDevelopmentServer } from './salt-mine-development-server';

Logger.setLevelByName('debug');

const sampleProcessor: SaltMineProcessor = async (event: SaltMineEntry, cfg: SaltMineConfig) => {
  const delayMS: number = Math.floor(Math.random() * 1500);
  Logger.info('Running sample processor for %d', delayMS);
  await PromiseRatchet.wait(delayMS);
  Logger.info('Sample processor complete');
};

const justLogProcessor: SaltMineProcessor = async (event: SaltMineEntry, cfg: SaltMineConfig) => {
  Logger.info('Ran just log processor');
};

const processorMap: Map<string, SaltMineProcessor | SaltMineProcessor[]> = new Map<string, SaltMineProcessor | SaltMineProcessor[]>();
processorMap.set('SAMPLE', (evt, cfg) => sampleProcessor(evt, cfg));
processorMap.set('JUST-LOG', (evt, cfg) => justLogProcessor(evt, cfg));
processorMap.set('COMBO', [sampleProcessor, justLogProcessor]);

const testServer: SaltMineDevelopmentServer = new SaltMineDevelopmentServer(processorMap);

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
