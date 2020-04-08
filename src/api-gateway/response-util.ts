import {APIGatewayEvent, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import {MapRatchet} from '@bitblit/ratchet/dist/common/map-ratchet';
import * as zlib from "zlib";
import {RouterConfig} from './route/router-config';
import {StringRatchet} from '@bitblit/ratchet/dist/common/string-ratchet';
import {CorsRequestData} from './cors-request-data';
import {EpsilonConstants} from '../epsilon-constants';

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
                if (input.statusCode && input.body !== undefined) {
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

    public static buildCorsRequestData(event: APIGatewayEvent): CorsRequestData {
        const rval: CorsRequestData = {
            accessControlRequestMethod: MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Access-Control-Request-Method'),
            accessControlRequestHeaders: MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Access-Control-Request-Headers'),
            origin: MapRatchet.caseInsensitiveAccess<string>(event.headers, 'Origin'),
            method: (!!event.httpMethod) ? event.httpMethod.toUpperCase() : null
        };
        return rval;
    }

    // Public so it can be used in auth-web-handler
    public static addCORSToProxyResult(input: ProxyResult, cfg: RouterConfig, requestData: CorsRequestData): ProxyResult {
        if (!input.headers) {
            input.headers = {};
        }

        // Matching the request is mainly here to support old safari browsers
        const allowedOrigins: string = ResponseUtil.calculateHeaderWithMatchAndOverride(cfg.corsAllowedOrigins,
            StringRatchet.safeString(requestData.origin), '*');
        const allowedMethods: string = ResponseUtil.calculateHeaderWithMatchAndOverride(cfg.corsAllowedMethods,
            StringRatchet.safeString(requestData.accessControlRequestMethod), '*');
        const allowedHeaders: string = ResponseUtil.calculateHeaderWithMatchAndOverride(cfg.corsAllowedHeaders,
            StringRatchet.safeString(requestData.accessControlRequestHeaders), '*');

        input.headers['Access-Control-Allow-Origin'] = input.headers['Access-Control-Allow-Origin'] || allowedOrigins;
        input.headers['Access-Control-Allow-Methods'] = input.headers['Access-Control-Allow-Methods'] || allowedMethods;
        input.headers['Access-Control-Allow-Headers'] = input.headers['Access-Control-Allow-Headers'] || allowedHeaders;

        return input;
    }

    private static calculateHeaderWithMatchAndOverride(overrideValue: string, matchValue: string, defaultValue: string): string {
        let rval: string = defaultValue;

        if (!!overrideValue) {
            if (overrideValue === EpsilonConstants.CORS_MATCH_REQUEST_FLAG) {
                if (!!matchValue) {
                    rval = matchValue;
                } else {
                    Logger.silly('Asked for match but no value provided, using default');
                }
            } else {
                rval = overrideValue;
            }
        }

        return rval;
    }

    public static async applyGzipIfPossible(encodingHeader: string, proxyResult: ProxyResult): Promise<ProxyResult> {
        let rval: ProxyResult = proxyResult;
        if (encodingHeader && encodingHeader.toLowerCase().indexOf('gzip') > -1) {
            const bigEnough: boolean = proxyResult.body.length>1400; // MTU packet is 1400 bytes
            let contentType: string = MapRatchet.extractValueFromMapIgnoreCase(proxyResult.headers, 'content-type') || '';
            contentType = contentType.toLowerCase();
            const exemptContent:boolean = (contentType === 'application/pdf' || contentType === 'application/zip' || contentType.startsWith('image/'));
            if (bigEnough && !exemptContent) {
                const asBuffer: Buffer = (proxyResult.isBase64Encoded)? Buffer.from(proxyResult.body, 'base64') : Buffer.from(proxyResult.body);
                const zipped: Buffer = await this.gzip(asBuffer);
                Logger.silly('Comp from %d to %d bytes', asBuffer.length, zipped.length);
                const zipped64: string =  zipped.toString('base64');

                rval.body = zipped64;
                rval.isBase64Encoded = true;
                rval.headers = rval.headers || {};
                rval.headers['Content-Encoding'] = 'gzip';
            } else {
                Logger.silly('Not gzipping, too small or exempt content');
            }
        } else {
            Logger.silly('Not gzipping, not an accepted encoding');
        }

        return rval;
    }

    public static gzip(input: Buffer): Promise<Buffer> {
        var promise = new Promise<Buffer>(function (resolve, reject) {
            zlib.gzip(input, function (error, result) {
                if (!error) resolve(result); else reject(error);
            });
        });
        return promise;
    };


}
