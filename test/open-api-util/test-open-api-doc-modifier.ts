import {expect} from 'chai';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import * as fs from 'fs';
import * as path from 'path';
import {OpenApiDocModifications} from '../../src/open-api-util/open-api-doc-modifications';
import {OpenApiDocModifier} from '../../src/open-api-util/open-api-doc-modifier';

describe('#openApiDocModifier', function () {
    this.timeout(30000000);

    it('should exist', async () => {
        const data: string = fs.readFileSync(path.join('src','static','sample-open-api-doc.yaml')).toString();
        expect(data).to.not.be.null;
        expect(data.length).to.be.gt(0);

        const mods: OpenApiDocModifications = {
            newServerPath: 'https://api.sample.com/cw',
            removeTags: ['Neon','CORS'],
            removeEndpoints: [new RegExp('options .*')]
        } as OpenApiDocModifications;

        const result: string = new OpenApiDocModifier(mods).modifyOpenApiDoc(data);
        expect(result).to.not.be.null;
        // Logger.info('G: \n\n%s', result);

    });


});