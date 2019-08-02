import {expect} from 'chai';
import {APIGatewayEvent, APIGatewayEventRequestContext, ProxyResult} from 'aws-lambda';
import {ResponseUtil} from '../../src/api-gateway/response-util';
import * as fs from 'fs';

describe('#responseUtil', function() {

    this.timeout(30000);
    it('should correctly combine a redirect url and query params', function() {

        const evt: APIGatewayEvent = {
            httpMethod: 'get',
            multiValueHeaders: {},
            multiValueQueryStringParameters: {},
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

    it('should leave already encoded stuff alone', async () => {

        const singlePixel: string = fs.readFileSync('test/test.png').toString('base64');

        const temp: ProxyResult = {
            body: singlePixel,
            statusCode: 200,
            isBase64Encoded: true,
            headers: {
                'content-type': 'application/zip',
                'content-disposition': 'attachment; filename="adomni_bs_'+new Date().getTime()+'.zip"'
            }
        } as ProxyResult;

        const cast: ProxyResult = ResponseUtil.coerceToProxyResult(temp);
        expect(cast.body).to.equal(temp.body);

        const gzip: ProxyResult = await ResponseUtil.applyGzipIfPossible('gzip', cast);
        expect(cast.body).to.equal(gzip.body);
    });

});