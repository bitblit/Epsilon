import {expect} from 'chai';
import {RouterConfig} from '../../src/api-gateway/route/router-config';
import {RouterUtil} from '../../src/api-gateway/route/router-util';
import {WebHandler} from '../../src/api-gateway/web-handler';
import {APIGatewayEvent, APIGatewayEventRequestContext} from 'aws-lambda';
import {EventUtil} from '../../src/api-gateway/event-util';
import {createSampleRouterConfig} from '../../src/local-server';

describe('#eventUtil', function() {

    it('should extract pieces', function() {
        const evt: APIGatewayEvent = {
            httpMethod: 'GET',
            path: '/cw/meta/server',
            body: null,
            headers: {},
            isBase64Encoded: false,
            pathParameters: null,
            queryStringParameters: null,
            stageVariables: null,
            resource: '/{proxy+}',
            requestContext: {
                httpMethod: 'GET',
                accountId: '1234',
                apiId: '7890',
                stage: 'v0',
                path: '/cw/meta/server',
                domainName: 'api.test.com',
                identity: null,
                requestId: 'asdf1234',
                requestTimeEpoch: 1234,
                resourceId: '1234',
                resourcePath: '/{proxy+}'

            } as APIGatewayEventRequestContext
        } as APIGatewayEvent;

        expect(EventUtil.extractStage(evt)).to.equal('cw');
        expect(EventUtil.extractApiGatewayStage(evt)).to.equal('v0');
        expect(EventUtil.extractFullPrefix(evt)).to.equal('https://api.test.com/cw');
        expect(EventUtil.extractFullPath(evt)).to.equal('https://api.test.com/cw/meta/server');
    });

});