import { Logger } from '@bitblit/ratchet/common/logger';
import { WebTokenManipulator } from './web-token-manipulator';
import { UnauthorizedError } from '../error/unauthorized-error';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { RequireRatchet } from '@bitblit/ratchet/common/require-ratchet';
import { ExpiredJwtHandling, JwtRatchet, JwtTokenBase, LoggerLevelName } from '@bitblit/ratchet/common';
import { CommonJwtToken } from '@bitblit/ratchet/common/common-jwt-token';

/**
 * Service for handling jwt tokens
 */
export class LocalWebTokenManipulator<T extends JwtTokenBase> implements WebTokenManipulator<T> {
  private _ratchet: JwtRatchet;

  constructor(private encryptionKeys: string[], private issuer: string) {
    RequireRatchet.notNullOrUndefined(encryptionKeys, 'encryptionKeys');
    RequireRatchet.noNullOrUndefinedValuesInArray(encryptionKeys, encryptionKeys.length);
    this._ratchet = new JwtRatchet(Promise.resolve(encryptionKeys));
  }

  public withExtraDecryptionKeys(keys: string[]): LocalWebTokenManipulator<T> {
    RequireRatchet.notNullOrUndefined(keys, 'keys');
    RequireRatchet.noNullOrUndefinedValuesInArray(keys, keys.length);
    this._ratchet = new JwtRatchet(
      this._ratchet.encryptionKeyPromise,
      Promise.resolve(keys),
      this._ratchet.jtiGenerator,
      this._ratchet.decryptOnlyKeyUseLogLevel,
      this._ratchet.parseFailureLogLevel
    );
    return this;
  }

  public withParseFailureLogLevel(logLevel: LoggerLevelName): LocalWebTokenManipulator<T> {
    this._ratchet = new JwtRatchet(
      this._ratchet.encryptionKeyPromise,
      this._ratchet.decryptKeysPromise,
      this._ratchet.jtiGenerator,
      this._ratchet.decryptOnlyKeyUseLogLevel,
      logLevel
    );
    return this;
  }

  public withOldKeyUseLogLevel(logLevel: LoggerLevelName): LocalWebTokenManipulator<T> {
    this._ratchet = new JwtRatchet(
      this._ratchet.encryptionKeyPromise,
      this._ratchet.decryptKeysPromise,
      this._ratchet.jtiGenerator,
      logLevel,
      this._ratchet.parseFailureLogLevel
    );
    return this;
  }

  public get jwtRatchet(): JwtRatchet {
    return this._ratchet;
  }

  public get selectRandomEncryptionKey(): Promise<string> {
    return this._ratchet.selectRandomEncryptionKey();
  }

  public createRefreshedJWTString(tokenString: string, expirationSeconds: number, allowExpired?: boolean): Promise<string> {
    return this._ratchet.refreshJWTString(tokenString, allowExpired || false, expirationSeconds);
  }

  public async parseAndValidateJWTStringAsync<T extends JwtTokenBase>(tokenString: string): Promise<T> {
    const payload: T = await this._ratchet.decodeToken(tokenString, ExpiredJwtHandling.ADD_FLAG);

    if (JwtRatchet.hasExpiredFlag(payload)) {
      throw new UnauthorizedError('Failing JWT token read/validate - token expired on ' + payload.exp);
    } else {
      return payload;
    }
  }

  public async createJWTStringAsync<T>(
    principal: string,
    userObject: T,
    roles: string[] = ['USER'],
    expirationSeconds: number = 3600,
    proxyUser: T = null
  ): Promise<string> {
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
    };

    const token: string = await this._ratchet.createTokenString(tokenData, expirationSeconds);
    return token;
  }

  public async extractTokenFromAuthorizationHeader<T extends JwtTokenBase>(header: string): Promise<T> {
    let tokenString: string = StringRatchet.trimToEmpty(header);
    if (tokenString.toLowerCase().startsWith('bearer ')) {
      tokenString = tokenString.substring(7);
    }
    const validated: T = !!tokenString ? await this.parseAndValidateJWTStringAsync(tokenString) : null;
    return validated;
  }
}
