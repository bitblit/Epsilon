import fs from 'fs';
import path from 'path';
import { OpenApiDocModifications } from './open-api-doc-modifications';
import { OpenApiDocModifier } from './open-api-doc-modifier';

describe('#openApiDocModifier', function () {
  it('should exist', async () => {
    const data: string = fs.readFileSync(path.join('src', 'static', 'sample-open-api-doc.yaml')).toString();
    expect(data).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);

    const mods: OpenApiDocModifications = {
      newServerPath: 'https://api.sample.com/cw',
      removeTags: ['Neon', 'CORS'],
      removeEndpoints: [new RegExp('options .*')],
    } as OpenApiDocModifications;

    const result: string = new OpenApiDocModifier(mods).modifyOpenApiDoc(data);
    expect(result).toBeTruthy();
    // Logger.info('G: \n\n%s', result);
  }, 30000);
});
