import { APIGatewayEvent, ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';
import * as zlib from 'zlib';
import { RouterConfig } from './route/router-config';
import { EpsilonConstants } from '../epsilon-constants';
import { StringRatchet } from '@bitblit/ratchet/dist/common/string-ratchet';
import { NumberRatchet } from '@bitblit/ratchet/dist/common/number-ratchet';

export class ResponseUtil {
  private constructor() {} // Prevent instantiation

  public static errorResponse(errorMessages: string[], statusCode: number, reqId: string): ProxyResult {
    let body: any = {
      errors: errorMessages,
      httpStatusCode: statusCode,
      requestId: reqId || 'MISSING',
    };

    let errorResponse: ProxyResult = {
      statusCode: statusCode,
      isBase64Encoded: false,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };

    return errorResponse;
  }

  public static redirect(target: string, code: number = 301, queryParams: any = null): ProxyResult {
    if (code !== 301 && code !== 302) {
      throw new Error('Code must be 301 or 302 for a redirect');
    }

    let redirectTarget: string = target;
    if (queryParams) {
      const keys: string[] = Object.keys(queryParams);
      if (keys.length > 0) {
        Logger.silly('Applying params to input target : %j', queryParams);
        redirectTarget += redirectTarget.indexOf('?') === -1 ? '?' : '&';
        for (let i = 0; i < keys.length; i++) {
          const k: string = keys[i];
          // TODO: make sure not double encoding
          redirectTarget += k + '=' + encodeURIComponent(queryParams[k]);
          if (i < keys.length - 1) {
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
        Location: redirectTarget,
      },
    } as ProxyResult;
  }

  public static errorIsX0x(err: Error, xClass: number): boolean {
    let rval: boolean = false;
    if (!!err && !!err['statusCode']) {
      const val: number = NumberRatchet.safeNumber(err['statusCode']);
      const bot: number = xClass * 100;
      const top: number = bot + 99;
      rval = val >= bot && val <= top;
    }
    return rval;
  }

  public static errorIs40x(err: Error): boolean {
    return ResponseUtil.errorIsX0x(err, 4);
  }

  public static errorIs50x(err: Error): boolean {
    return ResponseUtil.errorIsX0x(err, 5);
  }

  public static buildHttpError(errorMessage: string, statusCode: number): Error {
    let rval: Error = new Error(errorMessage);
    rval['statusCode'] = statusCode;

    return rval;
  }

  public static errorToProxyResult(error: Error, reqId: string, defaultErrorMessage: string = null): ProxyResult {
    let code = error['statusCode'] || 500;
    let errorMessages: string[] = null;
    if (!!StringRatchet.trimToNull(defaultErrorMessage) && code === 500) {
      // Basically the 'Internal Server Error' info hiding use case
      errorMessages = [defaultErrorMessage];
    } else {
      errorMessages = error['messages'] && error['messages'].length > 0 ? error['messages'] : null;
      errorMessages = errorMessages ? errorMessages : [error.message || JSON.stringify(error)];
    }

    return ResponseUtil.errorResponse(errorMessages, code, reqId);
  }

  public static coerceToProxyResult(input: any): ProxyResult {
    let rval: ProxyResult = null;

    if (input != null) {
      if (typeof input === 'object') {
        if (input.statusCode && input.body !== undefined) {
          rval = Object.assign({}, input) as ProxyResult;
          if (typeof input.body === 'string') {
            // Do Nothing
          } else if (Buffer.isBuffer(input.body)) {
            rval.body = input.body.toString('base64');
            rval.headers = input.headers || {};
            rval.headers['Content-Type'] = input.body.contentType; // TODO: Does this work?
            rval.isBase64Encoded = true;
          }
        } else {
          // Its a generic object
          let headers: any = input.headers || {};
          headers['Content-Type'] = 'application/json';
          rval = ResponseUtil.coerceToProxyResult({
            statusCode: 200,
            body: JSON.stringify(input),
            headers: headers,
            isBase64Encoded: false,
          });
        }
      } else if (typeof input === 'string' || Buffer.isBuffer(input)) {
        rval = ResponseUtil.coerceToProxyResult({ statusCode: 200, body: input });
      } else {
        // boolean , number, etc - other top level types
        // See : https://stackoverflow.com/questions/18419428/what-is-the-minimum-valid-json
        let headers: any = input.headers || {};
        headers['Content-Type'] = 'application/json';
        rval = ResponseUtil.coerceToProxyResult({
          statusCode: 200,
          body: JSON.stringify(input),
          headers: headers,
          isBase64Encoded: false,
        });
      }
    }

    return rval;
  }

  // Public so it can be used in auth-web-handler
  public static addCORSToProxyResult(input: ProxyResult, cfg: RouterConfig, srcEvent: APIGatewayEvent): ProxyResult {
    input.headers = input.headers || {};
    srcEvent.headers = srcEvent.headers || {};

    // Matching the request is mainly here to support old safari browsers
    const targetOrigin: string =
      cfg.corsAllowedOrigins !== EpsilonConstants.CORS_MATCH_REQUEST_FLAG
        ? cfg.corsAllowedOrigins
        : ResponseUtil.buildReflectCorsAllowOrigin(srcEvent, '*');
    const targetHeaders: string =
      cfg.corsAllowedHeaders !== EpsilonConstants.CORS_MATCH_REQUEST_FLAG
        ? cfg.corsAllowedHeaders
        : ResponseUtil.buildReflectCorsAllowHeaders(srcEvent, '*');
    const targetMethod: string =
      cfg.corsAllowedMethods !== EpsilonConstants.CORS_MATCH_REQUEST_FLAG
        ? cfg.corsAllowedMethods
        : ResponseUtil.buildReflectCorsAllowMethods(srcEvent, '*');

    Logger.silly('Adding CORS to proxy result tOrigin: %s tHeaders: %s tMethod: %s', targetOrigin, targetHeaders, targetMethod);

    if (StringRatchet.trimToNull(StringRatchet.safeString(input.headers['Access-Control-Allow-Origin'])) === null && !!targetOrigin) {
      input.headers['Access-Control-Allow-Origin'] = targetOrigin;
    }
    if (StringRatchet.trimToNull(StringRatchet.safeString(input.headers['Access-Control-Allow-Methods'])) === null && !!targetMethod) {
      input.headers['Access-Control-Allow-Methods'] = targetMethod;
    }
    if (StringRatchet.trimToNull(StringRatchet.safeString(input.headers['Access-Control-Allow-Headers'])) === null && !!targetHeaders) {
      input.headers['Access-Control-Allow-Headers'] = targetHeaders;
    }

    return input;
  }

  public static buildReflectCorsAllowOrigin(srcEvent: APIGatewayEvent, defaultValue: string = '*'): string {
    const rval: string = MapRatchet.caseInsensitiveAccess<string>(srcEvent.headers, 'Origin') || defaultValue;
    return rval;
  }

  public static buildReflectCorsAllowHeaders(srcEvent: APIGatewayEvent, defaultValue: string = '*'): string {
    const rval: string =
      MapRatchet.caseInsensitiveAccess<string>(srcEvent.headers, 'Access-Control-Request-Headers') ||
      Object.keys(srcEvent.headers).join(', ') ||
      '*';
    return rval;
  }

  public static buildReflectCorsAllowMethods(srcEvent: APIGatewayEvent, defaultValue: string = '*'): string {
    const rval: string =
      MapRatchet.caseInsensitiveAccess<string>(srcEvent.headers, 'Access-Control-Request-Method') ||
      srcEvent.httpMethod.toUpperCase() ||
      '*';
    return rval;
  }

  public static async applyGzipIfPossible(encodingHeader: string, proxyResult: ProxyResult): Promise<ProxyResult> {
    let rval: ProxyResult = proxyResult;
    if (encodingHeader && encodingHeader.toLowerCase().indexOf('gzip') > -1) {
      const bigEnough: boolean = proxyResult.body.length > 1400; // MTU packet is 1400 bytes
      let contentType: string = MapRatchet.extractValueFromMapIgnoreCase(proxyResult.headers, 'content-type') || '';
      contentType = contentType.toLowerCase();
      const exemptContent: boolean =
        contentType === 'application/pdf' || contentType === 'application/zip' || contentType.startsWith('image/');
      if (bigEnough && !exemptContent) {
        const asBuffer: Buffer = proxyResult.isBase64Encoded ? Buffer.from(proxyResult.body, 'base64') : Buffer.from(proxyResult.body);
        const zipped: Buffer = await this.gzip(asBuffer);
        Logger.silly('Comp from %d to %d bytes', asBuffer.length, zipped.length);
        const zipped64: string = zipped.toString('base64');

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
        if (!error) resolve(result);
        else reject(error);
      });
    });
    return promise;
  }
}
