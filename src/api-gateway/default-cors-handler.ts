import {APIGatewayEvent, ProxyResult} from 'aws-lambda';

export class DefaultCORSHandler {

    constructor(private corsResponse: ProxyResult = DefaultCORSHandler.buildCorsResponse()) {
    }

    public static buildCorsResponse(allowedOrigins: string = '*',
                                    allowedMethods: string = '*',
                                    allowedHeaders: string = '*',
                                    body: string = '{"cors":true}',
                                    statusCode: number = 200): ProxyResult {

        const rval: ProxyResult = {
            statusCode: statusCode,
            body: body,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigins || '*',
                'Access-Control-Allow-Methods': allowedMethods || '*',
                'Access-Control-Allow-Headers': allowedHeaders || '*'
            }
        };
        return rval;
    }

    public handle(event: APIGatewayEvent): Promise<ProxyResult> {
        return Promise.resolve(this.corsResponse);
    }


}

