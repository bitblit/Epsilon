import { expect } from 'chai';
import { APIGatewayEvent, ProxyResult } from 'aws-lambda';
import * as fs from 'fs';
import { RouterUtil } from '../../src/http/route/router-util';

describe('#routerUtil', function() {
  it('should build default reflective cors handler', async () => {
    const evt: APIGatewayEvent = JSON.parse(fs.readFileSync('test/sample-json/sample-request-1.json').toString());
    const proxy: ProxyResult = RouterUtil.defaultReflectiveCorsOptionsFunction(evt);

    expect(proxy.headers).to.not.be.null;
  });
});
