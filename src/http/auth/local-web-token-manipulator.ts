import * as jwt from 'jsonwebtoken';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { APIGatewayEvent } from 'aws-lambda';
import { WebTokenManipulator } from './web-token-manipulator';
import { WebTokenManipulatorUtil } from './web-token-manipulator-util';
import { UnauthorizedError } from '../error/unauthorized-error';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { ErrorRatchet } from '@bitblit/ratchet/dist/common/error-ratchet';

/**
 * Service for handling jwt tokens
 */
export class LocalWebTokenManipulator implements WebTokenManipulator {
  constructor(private encryptionKey: string, private issuer: string, private parseFailureLogLevel: string = 'debug') {}

  public refreshJWTString<T>(tokenString: string, expirationSeconds: number): string {
    const now = new Date().getTime();
    const payload: CommonJwtToken<T> = this.parseAndValidateJWTString(tokenString, now);
    let time = payload['exp'] - payload['iat'];
    time = expirationSeconds || time;
    const expires = now + time;
    payload['exp'] = expires;
    payload['iat'] = now;
    Logger.debug('Signing new payload : %j', payload);
    const token = jwt.sign(payload, this.encryptionKey); // , algorithm = 'HS256')
    return token;
  }

  public parseAndValidateJWTString<T>(tokenString: string, now: number = new Date().getTime()): CommonJwtToken<T> {
    const payload: CommonJwtToken<T> = this.parseJWTString(tokenString);

    if (payload['exp'] != null && now < payload['exp']) {
      return payload;
    } else {
      const age: number = now - payload['exp'];
      throw new UnauthorizedError('Failing JWT token read/validate - token expired on ' + payload['exp'] + ', ' + age + ' ms ago');
    }
  }

  public parseJWTString<T>(tokenString: string): CommonJwtToken<T> {
    let payload: CommonJwtToken<T> = null;
    try {
      payload = jwt.verify(tokenString, this.encryptionKey);
    } catch (err) {
      if (this.parseFailureLogLevel) {
        Logger.logByLevel(
          this.parseFailureLogLevel,
          'Failed to parse JWT token : %s : %s',
          ErrorRatchet.safeStringifyErr(err),
          tokenString
        );
      }
      payload = null;
    }

    if (!payload) {
      throw new UnauthorizedError('Unable to parse a token from this string');
    }

    Logger.debug('Got Payload : %j', payload);
    return payload;
  }

  public createJWTString<T>(
    principal: string,
    userObject: T,
    roles: string[] = ['USER'],
    expirationSeconds: number = 3600,
    proxyUser: T = null
  ): string {
    Logger.info('Creating JWT token for %s  that expires in %s', principal, expirationSeconds);
    const now = new Date().getTime();
    const expires = now + expirationSeconds * 1000;

    // Build token data and add claims
    const tokenData: CommonJwtToken<T> = {
      exp: expires,
      iss: this.issuer,
      sub: principal,
      iat: now,

      user: userObject,
      proxy: proxyUser,
      roles: roles,
    } as CommonJwtToken<T>;

    const token = jwt.sign(tokenData, this.encryptionKey); // , algorithm = 'HS256')
    return token;
  }

  public async extractTokenFromStandardEvent<T>(event: APIGatewayEvent): Promise<CommonJwtToken<T>> {
    const tokenString: string = WebTokenManipulatorUtil.extractTokenStringFromStandardEvent(event);
    return tokenString ? this.parseAndValidateJWTString(tokenString) : null;
  }
}
