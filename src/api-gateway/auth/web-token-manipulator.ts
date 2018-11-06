import {CommonJwtToken} from '@bitblit/ratchet/dist/common/common-jwt-token';
import {APIGatewayEvent, CustomAuthorizerEvent} from 'aws-lambda';

/**
 * Service for handling jwt tokens
 */
export interface WebTokenManipulator {
    extractTokenFromStandardEvent<T>(event: APIGatewayEvent): Promise<CommonJwtToken<T>>;
}
