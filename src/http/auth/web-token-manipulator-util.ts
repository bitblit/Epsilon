import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { APIGatewayEvent, CustomAuthorizerEvent } from 'aws-lambda';
import { EpsilonConstants } from '../../epsilon-constants';

/**
 * Util for common jwt handling
 */
export class WebTokenManipulatorUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static extractTokenStringFromAuthorizerEvent(event: CustomAuthorizerEvent): string {
    Logger.silly('Extracting token from event : %j', event);
    let rval: string = null;
    if (event && event.authorizationToken) {
      const token: string = event.authorizationToken;
      if (token && token.startsWith(EpsilonConstants.AUTH_HEADER_PREFIX)) {
        rval = token.substring(EpsilonConstants.AUTH_HEADER_PREFIX.length); // Strip "Bearer "
      }
    }
    return rval;
  }

  public static extractTokenStringFromStandardEvent(event: APIGatewayEvent): string {
    Logger.silly('Extracting token from event : %j', event);
    let rval: string = null;
    if (event && event.headers) {
      Object.keys(event.headers).forEach((k) => {
        if (k && k.toLowerCase().trim() === EpsilonConstants.AUTH_HEADER_NAME_LOWERCASE) {
          const v: string = event.headers[k];
          if (v && v.startsWith(EpsilonConstants.AUTH_HEADER_PREFIX)) {
            rval = v.substring(EpsilonConstants.AUTH_HEADER_PREFIX.length);
          }
        }
      });
    }
    return rval;
  }
}
