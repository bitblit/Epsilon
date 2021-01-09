import { AuthResponseContext } from 'aws-lambda';

export interface ExtendedAuthResponseContext extends AuthResponseContext {
  userData: any; // The parsed data in the JWT token (ALB/API gateway auth won't populate this since it only allows strings
  userDataJSON: string; // The data in the JWT token as a JSON string (for the API authorizer)
  srcData: string; // The original JWT token
}
