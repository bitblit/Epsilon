import { expect } from 'chai';
import { LocalWebTokenManipulator } from '../../src/http/auth/local-web-token-manipulator';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { Logger } from '@bitblit/ratchet/dist/common/logger';

describe('#localWebTokenManipulator', function() {
  it('should round trip a JWT token', async () => {
    const svc: LocalWebTokenManipulator = new LocalWebTokenManipulator('1234567890', 'test');

    const testUser: any = {
      data1: 'test',
      data2: 15
    };

    const token: string = svc.createJWTString('test123@test.com', testUser);

    Logger.info('Generated token : %s', token);

    expect(token).to.not.be.null;

    const outputUser: CommonJwtToken<any> = svc.parseAndValidateJWTString(token);

    Logger.info('Got result : %j', outputUser);

    expect(outputUser).to.not.be.null;
    expect(outputUser.user).to.not.be.null;
    expect(outputUser.user['data1']).to.eq(testUser.data1);
    expect(outputUser.user['data2']).to.eq(testUser.data2);
  });
});
