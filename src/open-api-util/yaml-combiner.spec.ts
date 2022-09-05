import { Logger } from '@bitblit/ratchet/common/logger';
import path from 'path';
import { YamlCombiner } from './yaml-combiner';

describe('#yamlCombiner', function () {
  it('should combine yamls', async () => {
    const files: string[] = [
      path.join(__dirname, '../../test-data/sample-yaml/test1.yaml'),
      path.join(__dirname, '../../test-data/sample-yaml/test2.yaml'),
    ];
    const root: string[] = ['components', 'schemas'];

    const result: string = YamlCombiner.combine(files, root);

    expect(result).toBeTruthy();
    expect(result.indexOf('Object1')).toBeGreaterThan(0);
    expect(result.indexOf('Object2')).toBeGreaterThan(0);
    expect(result.indexOf('Object3')).toBeGreaterThan(0);
    expect(result.indexOf('Object4')).toBeGreaterThan(0);
    expect(result.indexOf('components')).toEqual(0);
    expect(result.indexOf('schemas')).toBeGreaterThan(0);
    Logger.info('G: \n\n%s', result);
  }, 30000);
});
