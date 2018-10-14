import {ProxyResult} from 'aws-lambda';

export class EpsilonConstants {
    public static readonly DEFAULT_HANDLER_FUNCTION_NAME: string = 'handler';
    public static readonly DEFAULT_CORS_ALLOWED_HEADERS: string = 'Authorization, Origin, X-Requested-With, Content-Type, Range';  // Since safari hates *
    public static readonly DEFAULT_CORS_RESPONSE: ProxyResult = {
        statusCode: 200, body: '{"cors":true}',
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': EpsilonConstants.DEFAULT_CORS_ALLOWED_HEADERS
        }
    } as ProxyResult;
    public static readonly AUTH_HEADER_PREFIX: string = 'Bearer ';
    public static readonly AUTH_HEADER_NAME: string = 'Authorization';
    public static readonly AUTH_HEADER_NAME_LOWERCASE: string = 'authorization'; // Since this can vary


    // Prevent instantiation
    private constructor() {
    }
}
