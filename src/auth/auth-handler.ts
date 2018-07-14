import {APIGatewayEvent, Callback, Context, Handler, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {EpsilonAuthProvider} from './epsilon-auth-provider';
import {EventUtil} from '../event-util';
import {WebTokenManipulator} from './web-token-manipulator';
import {EpsilonJwtToken} from './epsilon-jwt-token';

export class AuthHandler {
    public static readonly AUTH_HEADER_PREFIX:string = 'Bearer ';
    private authorizer: EpsilonAuthProvider;
    private webTokenManipulator: WebTokenManipulator;

    constructor(authorizer: EpsilonAuthProvider, issuer:string, encryptionKey:string)
    {
        this.authorizer = authorizer;
        this.webTokenManipulator = new WebTokenManipulator(encryptionKey, issuer);
    }

    private createPolicy(methodArn: string, srcString: string, userOb: any): any
    {
        // If we reached here, create a policy document
        // parse the ARN from the incoming event
        const tmp = methodArn.split(':'); // event.methodArn;
        const apiGatewayArnTmp = tmp[5].split('/');
        const awsAccountId = tmp[4];
        const region = tmp[3];
        const stage = apiGatewayArnTmp[1];
        const restApiId = apiGatewayArnTmp[0];

        const response = {
            principalId: 'user',
            policyDocument: {
                Version: '2012-10-17',
                'Statement': [
                    {
                        Action: 'execute-api:Invoke',
                        Effect: 'Allow',
                        Resource: [
                            'arn:aws:execute-api:' + region + ':' + awsAccountId + ':' + restApiId + '/' + stage + '/*/*'
                        ]
                    }
                ]
            },
            context: {
                userJSON: JSON.stringify(userOb),
                srcData: srcString  // Put this in in-case we are doing a token update
            }
        };

        return response;
    };

    /**
     * This is the default authorizer - parses the incoming JWT token and sticks it
     * into context (or blocks if none/invalid found)
     * @param event
     * @param {Context} context
     * @param {Callback} callback
     */
    public lamdaHandler(event: APIGatewayEvent, context: Context, callback: Callback) : void {
        Logger.info('Got event : %j', event);

        let token: string = EventUtil.extractTokenSrc(event);

        if (token && token.startsWith(AuthHandler.AUTH_HEADER_PREFIX)) {
            const srcString = token.substring(7); // Strip "Bearer "
            const methodArn = 'XX'; //TODO: Fix event.methodArn;

            let parsed:EpsilonJwtToken<any> = this.webTokenManipulator.parseAndValidateJWTString(srcString);

            if (parsed) {
                callback(null, this.createPolicy(methodArn, srcString, parsed));
            } else {
                Logger.info('Invalid bearer token');
                callback(new Error('Unauthorized')); // Required by Lambda
            }

        } else {
            Logger.info('Token not supplied');
            callback(new Error('Unauthorized')); // Required by Lambda
        }
    }

}
