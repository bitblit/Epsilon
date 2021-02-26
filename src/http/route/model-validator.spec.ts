import { ModelValidator } from './model-validator';
import { loadSampleOpenApiYaml } from '../../local-server';

describe('#modelValidator', function () {
  it('should list an error', function () {
    const yamlString: string = loadSampleOpenApiYaml();
    const validator: ModelValidator = ModelValidator.createFromOpenApiYaml(yamlString);

    const testOb: any = {
      password: 'xxx',
      scope: 'yyy',
      expirationSeconds: 3600,
    };

    const err: string[] = validator.validate('AccessTokenRequest', testOb, false, true);

    expect(err).toBeTruthy();
    expect(err.length).toEqual(1);
  });
});
