import { Logger } from '@bitblit/ratchet/dist/common/logger';
import fs from 'fs';
import path from 'path';
import { OpenApiDocModifications } from './open-api-doc-modifications';
import { OpenApiDocModifier } from './open-api-doc-modifier';
import { YamlCombiner } from './yaml-combiner';

describe('#yamlCombiner', function () {
  this.timeout(30000000);

  it('should combine yamls', async () => {
    const files: string[] = ['test/sample-yaml/test1.yaml', 'test/sample-yaml/test2.yaml'];
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
  });
});
