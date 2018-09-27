import * as jwt from 'jsonwebtoken';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {CommonJwtToken} from '@bitblit/ratchet/dist/common/common-jwt-token';

/**
 * Service for handling jwt tokens
 */
export class WebTokenManipulator {

    private encryptionKey: string;
    private issuer: string;

    constructor(encryptionKey: string, issuer: string) {
        this.encryptionKey = encryptionKey;
        this.issuer = issuer;
    }

    public refreshJWTString<T>(tokenString: string, expirationSeconds: number): string {

        const now = new Date().getTime();
        let payload: CommonJwtToken<T> = this.parseAndValidateJWTString(tokenString, now);
        let time = (payload['exp'] - payload['iat']);
        time = expirationSeconds || time;
        const expires = now + time;
        payload['exp'] = expires;
        payload['iat'] = now;
        Logger.info('Signing new payload : %j', payload);
        const token = jwt.sign(payload, this.encryptionKey) // , algorithm = 'HS256')
        return token;
    }

    public parseAndValidateJWTString<T>(tokenString: string, now: number = new Date().getTime()): CommonJwtToken<T> {
        let payload: CommonJwtToken<T> = this.parseJWTString(tokenString);

        if (payload['exp'] != null && now < payload['exp']) {
            return payload;
        } else {
            const age: number = now - payload['exp'];
            throw new Error('Failing JWT token read/validate - token expired on ' + payload['exp'] + ', ' + age + ' ms ago');
        }
    }

    public parseJWTString<T>(tokenString: string): CommonJwtToken<T> {
        const payload = jwt.verify(tokenString, this.encryptionKey);

        if (payload) {
            Logger.debug('Got Payload : %j', payload);
            return payload;
        } else {
            throw new Error('Unable to parse a token from this string');
        }
    }


    public createJWTString<T>(principal: string, userObject: T, roles: string[] = ['USER'], expirationSeconds: number = 3600, proxyUser: T = null): string {
        Logger.info('Creating JWT token for %s  that expires in %s', principal, expirationSeconds);
        const now = new Date().getTime();
        const expires = now + (expirationSeconds * 1000);

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

}
