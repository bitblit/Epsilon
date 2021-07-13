import { Logger } from '@bitblit/ratchet/dist/common';
import { SaltMineConfig } from './salt-mine-config';
import path from 'path';
import { SaltMineConfigUtil } from './salt-mine-config-util';

describe('#yamlFileToSaltMineConfig', function () {
  it('Should convert the sample yaml to a config', async () => {
    const filePath: string = path.join(__dirname, '../test-data/sample-salt-mine-config.yaml');
    const out: SaltMineConfig = await SaltMineConfigUtil.yamlFileToSaltMineConfig(filePath);
    Logger.debug('Got : %j', out);
    expect(out).not.toBeNull();
    expect(out.processes).not.toBeNull();
    expect(out.aws).not.toBeNull();
    expect(out.development).not.toBeNull();
  });
});
