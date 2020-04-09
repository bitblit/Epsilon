import {expect} from 'chai';
import {APIGatewayEvent, ProxyResult} from 'aws-lambda';
import * as fs from 'fs';
import {ResponseUtil} from '../../src/api-gateway/response-util';
import {RouterConfig} from '../../src/api-gateway/route/router-config';
import {EpsilonConstants} from '../../src/epsilon-constants';

describe('#responseUtil', function() {

    it('should add cors to proxy result MATCH', async () => {
        const evt: APIGatewayEvent = JSON.parse(fs.readFileSync('test/sample-json/sample-request-1.json').toString());
        const proxy: ProxyResult = {} as ProxyResult;
        const config: RouterConfig = {
            corsAllowedOrigins : EpsilonConstants.CORS_MATCH_REQUEST_FLAG,
            corsAllowedMethods : EpsilonConstants.CORS_MATCH_REQUEST_FLAG,
            corsAllowedHeaders : EpsilonConstants.CORS_MATCH_REQUEST_FLAG
        } as RouterConfig;

        ResponseUtil.addCORSToProxyResult(proxy, config, evt);

        expect(proxy.headers).to.not.be.null;
    });

});
