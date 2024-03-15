/**
 * Service for handling auth tokens
 */
import { JwtTokenBase } from '@bitblit/ratchet/common';

export interface WebTokenManipulator<T extends JwtTokenBase> {
  // If you wish to display a custom message (Or use a custom error code) upon failure, throw
  // an exception extending RestfulHttpException from this function upon failure.  Otherwise,
  // anything else thrown will be wrapped in an innocuous "You must supply credentials" sort of
  // message
  extractTokenFromAuthorizationHeader(header: string): Promise<T>;
}
