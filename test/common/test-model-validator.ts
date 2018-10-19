import {expect} from 'chai';
import {ModelValidator} from '../../src/api-gateway/route/model-validator';
import {loadSampleOpenApiYaml} from '../../src/local-server';

describe('#modelValidator', function() {

    it('should list an error', function() {

        const yamlString: string = loadSampleOpenApiYaml();
        const validator: ModelValidator = ModelValidator.createFromOpenApiYaml(yamlString);

        const testOb: any =
            {
                "password": "xxx",
                "scope": "yyy",
                "expirationSeconds": 3600
            };


        const err: string[] = validator.validate('AccessTokenRequest', testOb, false, true);

        expect (err).to.not.be.null;
        expect (err.length).to.equal(1);

    });


});