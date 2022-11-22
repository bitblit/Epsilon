import { LocalWebTokenManipulator } from './local-web-token-manipulator';
import { Logger } from '@bitblit/ratchet/common/logger';
import { JwtTokenBase, LoggerLevelName } from '@bitblit/ratchet/common';
import { CommonJwtToken } from '@bitblit/ratchet/common/common-jwt-token';

describe('#localWebTokenManipulator', function () {
  it('should round trip a JWT token', async () => {
    const svc: LocalWebTokenManipulator<CommonJwtToken<any>> = new LocalWebTokenManipulator(['1234567890'], 'test')
      .withParseFailureLogLevel(LoggerLevelName.info)
      .withExtraDecryptionKeys(['abcdefabcdef'])
      .withOldKeyUseLogLevel(LoggerLevelName.info);

    const testUser: any = {
      data1: 'test',
      data2: 15,
    };

    const token: string = await svc.createJWTStringAsync('test123@test.com', testUser);

    Logger.info('Generated token : %s', token);

    expect(token).toBeTruthy();

    const outputUser: CommonJwtToken<any> = await svc.parseAndValidateJWTStringAsync(token);

    Logger.info('Got result : %j', outputUser);

    expect(outputUser).toBeTruthy();
    expect(outputUser.user).toBeTruthy();
    expect(outputUser.user['data1']).toEqual(testUser.data1);
    expect(outputUser.user['data2']).toEqual(testUser.data2);
  });
});
