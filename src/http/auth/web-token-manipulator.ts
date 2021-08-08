import { CommonJwtToken } from '@bitblit/ratchet/dist/common/common-jwt-token';

/**
 * Service for handling auth tokens
 */
export interface WebTokenManipulator {
  extractTokenFromAuthorizationHeader<T>(header: string): Promise<CommonJwtToken<T>>;
}
