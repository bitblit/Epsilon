import { JwtTokenBase, Logger, StringRatchet } from '@bitblit/ratchet/common';
import jwt from 'jsonwebtoken';
import jwks from 'jwks-rsa';
import { WebTokenManipulator } from './web-token-manipulator';

export class Auth0WebTokenManipulator implements WebTokenManipulator<JwtTokenBase> {
  private jwksClient: any;

  constructor(private clientId: string, private jwksUri: string, private issuer: string) {}

  public async extractTokenFromAuthorizationHeader<T>(authHeader: string): Promise<JwtTokenBase> {
    let tokenString: string = StringRatchet.trimToEmpty(authHeader);
    if (tokenString.toLowerCase().startsWith('bearer ')) {
      tokenString = tokenString.substring(7);
    }
    const validated: JwtTokenBase = tokenString ? await this.parseAndValidateAuth0Token(tokenString, false) : null;
    return validated;
  }

  public async parseAndValidateAuth0Token<T>(auth0Token: string, allowExpired: boolean = false): Promise<JwtTokenBase> {
    Logger.debug('Validating Auth0 token : %s', StringRatchet.obscure(auth0Token, 4));

    const fullToken: any = jwt.decode(auth0Token, { complete: true });
    const kid: string = fullToken?.header?.kid;
    const nowEpochSeconds: number = Math.floor(new Date().getTime() / 1000);

    const pubKey: string = await this.fetchSigningKey(kid as string);
    const validated: any = jwt.verify(auth0Token, pubKey, {
      audience: this.clientId,
      issuer: this.issuer,
      ignoreExpiration: allowExpired,
      clockTimestamp: nowEpochSeconds,
    });

    return validated;
  }

  private async fetchSigningKey(kid: string): Promise<string> {
    const jClient: any = await this.fetchJwksClient();

    return new Promise<string>((res, rej) => {
      jClient.getSigningKey(kid, (err, key) => {
        if (err) {
          rej(err);
        } else {
          res(key.publicKey || key.rsaPublicKey);
        }
      });
    });
  }

  private async fetchJwksClient(): Promise<any> {
    if (!this.jwksClient) {
      this.jwksClient = jwks({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 1000 * 60 * 60 * 10,
        jwksUri: this.jwksUri,
      });
    }
    return this.jwksClient;
  }
}
