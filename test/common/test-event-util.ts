import {expect} from 'chai';
import {APIGatewayEvent, APIGatewayEventRequestContext} from 'aws-lambda';
import {EventUtil} from '../../src/api-gateway/event-util';
import {BasicAuthToken} from '../../src/api-gateway/auth/basic-auth-token';

describe('#eventUtil', function() {

    it('should extract pieces', function() {
        const evt: APIGatewayEvent = {
            httpMethod: 'GET',
            path: '/cw/meta/server',
            body: null,
            headers: {
                'Host': 'api.test.com',
                'X-Forwarded-Proto': 'https'
            },
            multiValueHeaders:{
                'Host': ['api.test.com'],
                'X-Forwarded-Proto': ['https']
            },
            multiValueQueryStringParameters:null,
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
        expect(EventUtil.extractHostHeader(evt)).to.equal('api.test.com');
    });


    it('should fix still encoded query params', function() {
        const evt: APIGatewayEvent = {
            httpMethod: 'GET',
            path: '/cw/meta/server',
            body: null,
            headers: {
                'Host': 'api.test.com',
                'X-Forwarded-Proto': 'https'
            },
            multiValueHeaders:{
                'Host': ['api.test.com'],
                'X-Forwarded-Proto': ['https']
            },
            isBase64Encoded: false,
            pathParameters: null,
            multiValueQueryStringParameters: {
                a: ['b'],
                'amp;c': ['d']
            },
            queryStringParameters: {
                a: 'b',
                'amp;c': 'd'
            },
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

        expect(evt.queryStringParameters['a']).to.not.be.null;
        expect(evt.queryStringParameters['amp;c']).to.not.be.null;
        expect(evt.queryStringParameters['c']).to.be.undefined;

        EventUtil.fixStillEncodedQueryParams(evt);

        expect(evt.queryStringParameters['a']).to.not.be.null;
        expect(evt.queryStringParameters['amp;c']).to.be.undefined;
        expect(evt.queryStringParameters['c']).to.not.be.null;

    });



    it('should extract basic auth from headers', function() {
        const evt: APIGatewayEvent = {
            httpMethod: 'GET',
            path: '/cw/meta/server',
            body: null,
            headers: {
                'Host': 'api.test.com',
                'X-Forwarded-Proto': 'https',
                'Authorization': 'Basic dGVzdHVzZXI6dGVzdHBhc3M='
            },
            multiValueHeaders:{
                'Host': ['api.test.com'],
                'X-Forwarded-Proto': ['https'],
                'Authorization': ['Basic dGVzdHVzZXI6dGVzdHBhc3M=']
            },
            isBase64Encoded: false,
            pathParameters: null,
            multiValueQueryStringParameters: {
                a: ['b'],
                'amp;c': ['d']
            },
            queryStringParameters: {
                a: 'b',
                'amp;c': 'd'
            },
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

        const basic: BasicAuthToken = EventUtil.extractBasicAuthenticationToken(evt);
        expect(basic).to.not.be.null;
        expect(basic.username).to.not.be.null;
        expect(basic.password).to.not.be.null;
        expect(basic.username).to.eq('testuser');
        expect(basic.password).to.eq('testpass');

    });

});
