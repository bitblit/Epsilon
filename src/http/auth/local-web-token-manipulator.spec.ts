import { LocalWebTokenManipulator } from './local-web-token-manipulator';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { LoggerLevelName } from '@bitblit/ratchet/dist/common';

describe('#localWebTokenManipulator', function () {
  it('should round trip a JWT token', async () => {
    const svc: LocalWebTokenManipulator = new LocalWebTokenManipulator(['1234567890'], 'test')
      .withParseFailureLogLevel(LoggerLevelName.info)
      .withExtraDecryptionKeys(['abcdefabcdef'])
      .withOldKeyUseLogLevel(LoggerLevelName.info);

    const testUser: any = {
      data1: 'test',
      data2: 15,
    };

    const token: string = svc.createJWTString('test123@test.com', testUser);

    Logger.info('Generated token : %s', token);

    expect(token).toBeTruthy();

    const outputUser: CommonJwtToken<any> = svc.parseAndValidateJWTString(token);

    Logger.info('Got result : %j', outputUser);

    expect(outputUser).toBeTruthy();
    expect(outputUser.user).toBeTruthy();
    expect(outputUser.user['data1']).toEqual(testUser.data1);
    expect(outputUser.user['data2']).toEqual(testUser.data2);
  });
});
