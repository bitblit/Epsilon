import {expect} from 'chai';
import {APIGatewayEvent, ProxyResult} from 'aws-lambda';
import * as fs from 'fs';
import {ResponseUtil} from '../../src/api-gateway/response-util';
import {RouterConfig} from '../../src/api-gateway/route/router-config';
import {EpsilonConstants} from '../../src/epsilon-constants';
import {RouterUtil} from '../../src/api-gateway/route/router-util';

describe('#routerUtil', function() {

    it('should build default reflective cors handler', async () => {
        const evt: APIGatewayEvent = JSON.parse(fs.readFileSync('test/sample-json/sample-request-1.json').toString());
        const proxy: ProxyResult = RouterUtil.defaultReflectiveCorsOptionsFunction(evt);

        expect(proxy.headers).to.not.be.null;
    });

});
