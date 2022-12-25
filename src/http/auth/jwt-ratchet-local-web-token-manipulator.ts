import { WebTokenManipulator } from './web-token-manipulator';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { RequireRatchet } from '@bitblit/ratchet/common/require-ratchet';
import { ExpiredJwtHandling, JwtRatchet, JwtRatchetLike, JwtTokenBase } from '@bitblit/ratchet/common';

/**
 * Service for handling jwt tokens
 */
export class JwtRatchetLocalWebTokenManipulator<T extends JwtTokenBase> implements WebTokenManipulator<T> {
  constructor(private _jwtRatchet: JwtRatchetLike, private _issuer: string) {
    RequireRatchet.notNullOrUndefined(_jwtRatchet, '_jwtRatchet');
    RequireRatchet.notNullOrUndefined(StringRatchet.trimToNull(_issuer), '_issuer');
  }

  public get jwtRatchet(): JwtRatchetLike {
    return this._jwtRatchet;
  }

  public get issuer(): string {
    return this._issuer;
  }

  public async extractTokenFromAuthorizationHeader<T>(header: string): Promise<T> {
    let tokenString: string = StringRatchet.trimToEmpty(header);
    if (tokenString.toLowerCase().startsWith('bearer ')) {
      tokenString = tokenString.substring(7);
    }
    const validated: T = !!tokenString ? await this.jwtRatchet.decodeToken(tokenString, ExpiredJwtHandling.THROW_EXCEPTION) : null;
    return validated;
  }
}
