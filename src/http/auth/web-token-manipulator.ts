/**
 * Service for handling auth tokens
 */
import { JwtTokenBase } from '@bitblit/ratchet/common';

export interface WebTokenManipulator<T extends JwtTokenBase> {
  extractTokenFromAuthorizationHeader(header: string): Promise<T>;
  allowErrorMessagesInResponses?(): boolean;
}
