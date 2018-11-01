import {expect} from 'chai';
import {RouterConfig} from '../../src/api-gateway/route/router-config';
import {RouterUtil} from '../../src/api-gateway/route/router-util';
import {WebHandler} from '../../src/api-gateway/web-handler';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {EventUtil} from '../../src/api-gateway/event-util';
import {createSampleRouterConfig} from '../../src/local-server';
import {ResponseUtil} from '../../src/api-gateway/response-util';

describe('#responseUtil', function() {

    it('should correctly combine a redirect url and query params', function() {

        const evt: APIGatewayEvent = {
            httpMethod: 'get',
            path: '/v0/meta/server',
            body: null,
            headers: null,
            isBase64Encoded: false,
            pathParameters: null,
            stageVariables: null,
            resource: null,
            queryStringParameters: {
                a : 'b',
                c : 'd'
            },
            requestContext: {
                stage: 'v0'
            } as APIGatewayEventRequestContext
        } as APIGatewayEvent;


        const out1: ProxyResult = ResponseUtil.redirect('myTarget?e=f', 301, evt.queryStringParameters);
        expect(out1).to.not.be.null;
        expect(out1.headers).to.not.be.null;
        expect(out1.headers.Location).to.equal('myTarget?e=f&a=b&c=d');

        const out2: ProxyResult = ResponseUtil.redirect('myTarget', 301, evt.queryStringParameters);
        expect(out2).to.not.be.null;
        expect(out2.headers).to.not.be.null;
        expect(out2.headers.Location).to.equal('myTarget?a=b&c=d');


    });

});