import {APIGatewayEvent, ProxyResult} from 'aws-lambda';

export class DefaultCORSHandler {

    public static readonly DEFAULT_CORS_ALLOWED_HEADERS: string = 'Authorization, Origin, X-Requested-With, Content-Type, Range';  // Since safari hates '*'
    public static readonly DEFAULT_CORS_RESPONSE: ProxyResult = {
        statusCode: 200, body: '{"cors":true}',
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Headers': DefaultCORSHandler.DEFAULT_CORS_ALLOWED_HEADERS
        }
    } as ProxyResult;


    constructor(private corsResponse: ProxyResult = DefaultCORSHandler.DEFAULT_CORS_RESPONSE) {
    }

    public handle(event: APIGatewayEvent): Promise<ProxyResult> {
        return Promise.resolve(this.corsResponse);
    }

}
