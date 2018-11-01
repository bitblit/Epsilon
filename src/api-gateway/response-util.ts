import {APIGatewayEvent, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';

export class ResponseUtil {

    private constructor() {
    } // Prevent instantiation

    public static errorResponse(errorMessages: string[], statusCode: number): ProxyResult {
        let body: any = {
            errors: errorMessages,
            httpStatusCode: statusCode
        };

        let errorResponse: ProxyResult =
            {
                statusCode: statusCode,
                isBase64Encoded: false,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            };

        return errorResponse;
    }

    public static redirect(target: string, code: number = 301, queryParams:any = null): ProxyResult {
        if (code!==301 && code!==302) {
            throw new Error('Code must be 301 or 302 for a redirect');
        }

        let redirectTarget:string = target;
        if (queryParams) {
            const keys:string[] = Object.keys(queryParams);
            if (keys.length > 0) {
                Logger.silly('Applying params to input target : %j', queryParams);
                redirectTarget += (redirectTarget.indexOf('?') === -1) ? '?' : '&';
                for (let i=0; i < keys.length ; i++) {
                    const k: string = keys[i];
                    // TODO: make sure not double encoding
                    redirectTarget += k + '=' + encodeURIComponent(queryParams[k]);
                    if (i < keys.length -1 ) {
                        redirectTarget += '&';
                    }
                }
            }
        }

        return {
            statusCode: code,
            body: '{"redirect-target":"' + redirectTarget + '}',
            headers: {
                'Content-Type': 'application/json',
                'Location': redirectTarget
            }
        } as ProxyResult;
    }

    public static buildHttpError(errorMessage: string, statusCode: number): Error {
        let rval: Error = new Error(errorMessage);
        rval['statusCode'] = statusCode;

        return rval
    }

    public static errorToProxyResult(error: Error): ProxyResult {
        let code = error['statusCode'] || 500;
        let errorMessages: string[] = (error['messages'] && error['messages'].length > 0) ? error['messages'] : null;
        errorMessages = (errorMessages) ? errorMessages : [(error.message || JSON.stringify(error))];

        return ResponseUtil.errorResponse(errorMessages, code);
    }

    public static coerceToProxyResult(input: any): ProxyResult {
        let rval: ProxyResult = null;

        if (input != null) {
            if (typeof input === 'object') {
                if (input.statusCode && input.body) {
                    rval = Object.assign({}, input) as ProxyResult;
                    if (typeof input.body === 'string') {
                        // Do Nothing
                    }
                    else if (Buffer.isBuffer(input.body)) {
                        rval.body = input.body.toString('base64');
                        rval.headers = input.headers || {};
                        rval.headers['Content-Type'] = input.body.contentType; // TODO: Does this work?
                        rval.isBase64Encoded = true;
                    }
                }
                else {
                    // Its a generic object
                    let headers: any = input.headers || {};
                    headers['Content-Type'] = 'application/json';
                    rval = ResponseUtil.coerceToProxyResult({
                        statusCode: 200,
                        body: JSON.stringify(input),
                        headers: headers,
                        isBase64Encoded: false
                    });
                }
            } else if (typeof input === 'string' || Buffer.isBuffer(input)) {
                rval = ResponseUtil.coerceToProxyResult({statusCode: 200, body: input});
            } else { // boolean , number, etc - other top level types
                // See : https://stackoverflow.com/questions/18419428/what-is-the-minimum-valid-json
                let headers: any = input.headers || {};
                headers['Content-Type'] = 'application/json';
                rval = ResponseUtil.coerceToProxyResult({
                    statusCode: 200,
                    body: JSON.stringify(input),
                    headers: headers,
                    isBase64Encoded: false
                });
            }

        }

        return rval;
    }

    // Public so it can be used in auth-web-handler
    public static addCORSToProxyResult(input: ProxyResult, corsAllowedHeaders: string): ProxyResult {
        if (!input.headers) {
            input.headers = {};
        }
        input.headers['Access-Control-Allow-Origin'] = input.headers['Access-Control-Allow-Origin'] || '*';
        input.headers['Access-Control-Allow-Methods'] = input.headers['Access-Control-Allow-Methods'] || '*';
        input.headers['Access-Control-Allow-Headers'] = input.headers['Access-Control-Allow-Headers'] || corsAllowedHeaders;

        return input;
    }

}
