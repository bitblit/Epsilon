import { ModelValidator } from './model-validator';
import { SampleServerComponents } from '../../sample-server-components';

describe('#modelValidator', function () {
  it('should list an error', function () {
    const yamlString: string = SampleServerComponents.loadSampleOpenApiYaml();
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
