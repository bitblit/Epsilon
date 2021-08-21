import jwt from 'jsonwebtoken';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { WebTokenManipulator } from './web-token-manipulator';
import { UnauthorizedError } from '../error/unauthorized-error';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { RequireRatchet } from '@bitblit/ratchet/dist/common/require-ratchet';

/**
 * Service for handling jwt tokens
 */
export class LocalWebTokenManipulator implements WebTokenManipulator {
  private decryptionKeys: string[];
  private oldKeyUseLogLevel: string = 'info';
  private parseFailureLogLevel: string = 'debug';

  constructor(private encryptionKeys: string[], private issuer: string) {
    RequireRatchet.notNullOrUndefined(encryptionKeys, 'encryptionKeys');
    RequireRatchet.noNullOrUndefinedValuesInArray(encryptionKeys, encryptionKeys.length);
    RequireRatchet.true(encryptionKeys.length > 0, 'Encryption keys may not be empty');
  }

  public withExtraDecryptionKeys(keys: string[]): LocalWebTokenManipulator {
    RequireRatchet.notNullOrUndefined(keys, 'keys');
    RequireRatchet.noNullOrUndefinedValuesInArray(keys, keys.length);
    this.decryptionKeys = this.encryptionKeys.concat(keys || []);
    return this;
  }

  public withParseFailureLogLevel(logLevel: string): LocalWebTokenManipulator {
    this.parseFailureLogLevel = logLevel;
    return this;
  }

  public withOldKeyUseLogLevel(logLevel: string): LocalWebTokenManipulator {
    this.oldKeyUseLogLevel = logLevel;
    return this;
  }

  public get randomEncryptionKey(): string {
    return this.encryptionKeys[Math.floor(Math.random() * this.encryptionKeys.length)];
  }

  public refreshJWTString<T>(tokenString: string, expirationSeconds: number): string {
    const now = new Date().getTime();
    const payload: CommonJwtToken<T> = this.parseAndValidateJWTString(tokenString, now);
    let time = payload['exp'] - payload['iat'];
    time = expirationSeconds || time;
    const expires = now + time;
    payload['exp'] = expires;
    payload['iat'] = now;
    Logger.debug('Signing new payload : %j', payload);
    const token = jwt.sign(payload, this.randomEncryptionKey); // , algorithm = 'HS256')
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
    payload = this.verifyJWTWithAnyToken<T>(tokenString);

    if (!payload) {
      throw new UnauthorizedError('Unable to parse a token from this string');
    }

    Logger.debug('Got Payload : %j', payload);
    return payload;
  }

  public verifyJWTWithAnyToken<T>(tokenString: string): CommonJwtToken<T> {
    let rval: CommonJwtToken<T> = null;
    for (let i = 0; i < this.decryptionKeys.length && !rval; i++) {
      try {
        const testKey: string = this.decryptionKeys[i];
        rval = jwt.verify(tokenString, testKey);
        if (rval && !this.encryptionKeys.includes(testKey) && this.oldKeyUseLogLevel) {
          Logger.logByLevel(this.oldKeyUseLogLevel, 'Used old key to decode token : %s', testKey);
        }
      } catch (err) {
        // Only Log on the last one since it might have just been an old key
        if (this.parseFailureLogLevel && i === this.decryptionKeys.length - 1) {
          Logger.logByLevel(this.parseFailureLogLevel, 'Failed to parse JWT token : %s : %s', err.message, tokenString);
        }
        rval = null;
      }
    }
    return rval;
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

    const token = jwt.sign(tokenData, this.randomEncryptionKey); // , algorithm = 'HS256')
    return token;
  }

  public async extractTokenFromAuthorizationHeader<T>(header: string): Promise<CommonJwtToken<T>> {
    let tokenString: string = StringRatchet.trimToEmpty(header);
    if (tokenString.toLowerCase().startsWith('bearer ')) {
      tokenString = tokenString.substring(7);
    }
    const validated: any = !!tokenString ? await this.parseAndValidateJWTString(tokenString) : null;
    return validated as CommonJwtToken<T>;
  }
}
