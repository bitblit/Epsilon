import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { APIGatewayEvent } from 'aws-lambda';
import { WebTokenManipulator } from './web-token-manipulator';
import { Logger } from '@bitblit/ratchet/dist/common';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';

/**
 * Example token manipulator - just logs, does not even parse
 * DO NOT USE THIS FOR ANY PRODUCTION USE!
 */
export class BypassWebTokenManipulator implements WebTokenManipulator {
  public async extractTokenFromStandardEvent<T>(event: APIGatewayEvent): Promise<CommonJwtToken<T>> {
    Logger.info('Called BypassWebTokenManipulator for %s', event.path);

    const now: number = new Date().getTime();

    const rval: CommonJwtToken<any> = {
      exp: now + 1000 * 60 * 5,
      iat: now,
      iss: 'BypassToken',
      sub: 'TestSubject',
      aud: 'TestAudience',
      jti: StringRatchet.createType4Guid(),

      user: { name: 'TestUser' },
      proxy: null,

      roles: ['BASIC'],
    };
    return rval;
  }
}
