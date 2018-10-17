import { expect } from 'chai';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {WebHandler} from '../../src/web-handler';
import {BadRequestError} from '../../src/error/bad-request-error';
import {ResponseUtil} from '../../src/response-util';
import {EventUtil} from '../../src/event-util';
import * as fs from "fs";
import * as path from "path";
import {ModelValidator} from '../../src/route/model-validator';
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