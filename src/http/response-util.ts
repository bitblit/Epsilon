import { ProxyResult } from 'aws-lambda';
import { Logger } from '@bitblit/ratchet/dist/common/logger';
import { MapRatchet } from '@bitblit/ratchet/dist/common/map-ratchet';
import zlib from 'zlib';
import { EpsilonHttpError } from './error/epsilon-http-error';

export class ResponseUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static errorResponse<T>(err: EpsilonHttpError<T>): ProxyResult {
    const body: any = {
      errors: err.errors,
      httpStatusCode: err.httpStatusCode,
      requestId: err.requestId,
    };
    if (err.detailErrorCode) {
      body['detailErrorCode'] = err.detailErrorCode;
    }
    if (err.endUserErrors && err.endUserErrors.length > 0) {
      body['endUserErrors'] = err.endUserErrors;
    }
    if (err.details) {
      body['details'] = err.details;
    }
    if (err.wrappedError) {
      body['wrappedError'] = err.wrappedError.name + ' : ' + err.wrappedError.message;
    }

    // No wrapped error since its already copied

    const errorResponse: ProxyResult = {
      statusCode: err.httpStatusCode,
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

  // eslint-disable-next-line  @typescript-eslint/explicit-module-boundary-types
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
          const headers: any = input.headers || {};
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
        const headers: any = input.headers || {};
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

  public static async applyGzipIfPossible(encodingHeader: string, proxyResult: ProxyResult): Promise<ProxyResult> {
    const rval: ProxyResult = proxyResult;
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
    const promise = new Promise<Buffer>(function (resolve, reject) {
      zlib.gzip(input, function (error, result) {
        if (!error) resolve(result);
        else reject(error);
      });
    });
    return promise;
  }
}
