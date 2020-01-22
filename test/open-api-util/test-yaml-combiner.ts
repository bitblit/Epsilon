import {expect} from 'chai';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import * as fs from 'fs';
import * as path from 'path';
import {OpenApiDocModifications} from '../../src/open-api-util/open-api-doc-modifications';
import {OpenApiDocModifier} from '../../src/open-api-util/open-api-doc-modifier';
import {YamlCombiner} from '../../src/open-api-util/yaml-combiner';

describe('#yamlCombiner', function () {
    this.timeout(30000000);

    it('should combine yamls', async () => {
        const files: string[] = ['test/sample-yaml/test1.yaml', 'test/sample-yaml/test2.yaml'];
        const root: string[] = ['components','schemas'];

        const result: string = YamlCombiner.combine(files, root);

        expect(result).to.not.be.null;
        expect(result.indexOf('Object1')).to.be.gt(0);
        expect(result.indexOf('Object2')).to.be.gt(0);
        expect(result.indexOf('Object3')).to.be.gt(0);
        expect(result.indexOf('Object4')).to.be.gt(0);
        expect(result.indexOf('components')).to.be.eq(0);
        expect(result.indexOf('schemas')).to.be.gt(0);
        Logger.info('G: \n\n%s', result);

    });


});
