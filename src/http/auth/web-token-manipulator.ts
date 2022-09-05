import { CommonJwtToken } from '@bitblit/ratchet/common/common-jwt-token';

/**
 * Service for handling auth tokens
 */
export interface WebTokenManipulator {
  extractTokenFromAuthorizationHeader<T>(header: string): Promise<CommonJwtToken<T>>;
}
