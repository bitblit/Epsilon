import { APIGatewayEvent } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import * as jwt from 'jsonwebtoken';
import * as jwks from 'jwks-rsa';
import { WebTokenManipulator } from './web-token-manipulator';
import { WebTokenManipulatorUtil } from './web-token-manipulator-util';
import { UnauthorizedError } from '../error/unauthorized-error';
import * as fetch from 'portable-fetch';

export class GoogleWebTokenManipulator implements WebTokenManipulator {
  private static readonly GOOGLE_DISCOVERY_DOCUMENT: string = 'https://accounts.google.com/.well-known/openid-configuration';
  private cacheGoogleDiscoveryDocument: any;
  private jwksClient: any;

  constructor(private clientId: string) {}

  public async extractTokenFromStandardEvent<T>(event: APIGatewayEvent): Promise<CommonJwtToken<T>> {
    try {
      const tokenString: string = WebTokenManipulatorUtil.extractTokenStringFromStandardEvent(event);
      const validated: any = !!tokenString ? await this.parseAndValidateGoogleToken(tokenString, false) : null;
      return validated as CommonJwtToken<T>;
    } catch (err) {
      Logger.warn('Authentication of token failed : %s', err, err);
      throw new UnauthorizedError('Failed to extract google token : ' + String(err));
    }
  }

  public async parseAndValidateGoogleToken<T>(googleToken: string, allowExpired: boolean = false): Promise<CommonJwtToken<T>> {
    Logger.debug('Auth : %s', StringRatchet.obscure(googleToken, 4));

    // First decode so we can get the keys
    const fullToken: any = jwt.decode(googleToken, { complete: true });
    const kid: string = fullToken.header.kid;
    const nowEpochSeconds: number = Math.floor(new Date().getTime() / 1000);

    const pubKey: string = await this.fetchSigningKey(kid);
    const validated: any = jwt.verify(googleToken, pubKey, {
      audience: this.clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      ignoreExpiration: allowExpired,
      clockTimestamp: nowEpochSeconds
    });

    return validated as CommonJwtToken<T>;
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
      const discDoc: any = await this.fetchGoogleDiscoveryDocument();
      const client: any = jwks({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 1000 * 60 * 60 * 10,
        jwksUri: discDoc.jwks_uri
      });
      this.jwksClient = client;
    }
    return this.jwksClient;
  }

  private async fetchGoogleDiscoveryDocument(): Promise<any> {
    if (!this.cacheGoogleDiscoveryDocument) {
      const resp: Response = await fetch(GoogleWebTokenManipulator.GOOGLE_DISCOVERY_DOCUMENT);
      const doc: any = await resp.json();
      this.cacheGoogleDiscoveryDocument = doc;
    }
    return this.cacheGoogleDiscoveryDocument;
  }
}
