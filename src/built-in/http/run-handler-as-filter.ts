import { Logger } from '@bitblit/ratchet/common/logger';
import { Context } from 'aws-lambda';
import { ExtendedAPIGatewayEvent } from '../../config/http/extended-api-gateway-event';
import { PromiseRatchet } from '@bitblit/ratchet/common/promise-ratchet';
import { TimeoutToken } from '@bitblit/ratchet/common/timeout-token';
import { RequestTimeoutError } from '../../http/error/request-timeout-error';
import { ResponseUtil } from '../../http/response-util';
import { NotFoundError } from '../../http/error/not-found-error';
import { RouteAndParse } from '../../http/web-handler';
import { NullReturnedObjectHandling } from '../../config/http/null-returned-object-handling';
import { FilterFunction } from '../../config/http/filter-function';
import { FilterChainContext } from '../../config/http/filter-chain-context';
import { RestfulApiHttpError } from '@bitblit/ratchet/common';

export class RunHandlerAsFilter {
  public static async runHandler(fCtx: FilterChainContext, rm: RouteAndParse): Promise<boolean> {
    // Check for continue
    // Run the controller
    const handler: Promise<any> = RunHandlerAsFilter.findHandler(rm, fCtx.event, fCtx.context);
    Logger.debug('Processing event with epsilon: %j', fCtx.event);
    let tmp: any = await handler;
    if (TimeoutToken.isTimeoutToken(tmp)) {
      (tmp as TimeoutToken).writeToLog();
      throw new RequestTimeoutError('Timed out');
    }
    Logger.debug('Initial return value : %j', tmp);
    tmp = RunHandlerAsFilter.applyNullReturnedObjectHandling(tmp, rm.mapping.metaProcessingConfig.nullReturnedObjectHandling);
    fCtx.rawResult = tmp;
    fCtx.result = ResponseUtil.coerceToProxyResult(tmp);

    return true;
  }

  public static applyNullReturnedObjectHandling(result: any, handling: NullReturnedObjectHandling): any {
    let rval: any = result;
    if (result === null || result === undefined) {
      if (handling === NullReturnedObjectHandling.Error) {
        Logger.error('Null object returned and Error specified, throwing 500');
        throw new RestfulApiHttpError('Null object').withHttpStatusCode(500);
      } else if (handling === NullReturnedObjectHandling.Return404NotFoundResponse) {
        throw new NotFoundError('Resource not found');
      } else if (handling === NullReturnedObjectHandling.ConvertToEmptyString) {
        Logger.warn('Null object returned from handler and convert not specified, converting to empty string');
        rval = '';
      } else {
        throw new RestfulApiHttpError('Cant happen - failed enum check').withHttpStatusCode(500);
      }
    }
    return rval;
  }

  public static async findHandler(
    rm: RouteAndParse,
    event: ExtendedAPIGatewayEvent,
    context: Context,
    add404OnMissing: boolean = true,
  ): Promise<any> {
    let rval: Promise<any> = null;
    // Execute
    if (rm) {
      // We extend with the parsed params here in case we are using the AWS any proxy
      event.pathParameters = Object.assign({}, event.pathParameters, rm.parsed);

      rval = PromiseRatchet.timeout(
        rm.mapping.function(event, context),
        'Timed out after ' + rm.mapping.metaProcessingConfig.timeoutMS + ' ms.  Request was ' + JSON.stringify(event),
        rm.mapping.metaProcessingConfig.timeoutMS,
      );
    } else if (add404OnMissing) {
      throw new NotFoundError('No such endpoint');
    }
    return rval;
  }

  public static addRunHandlerAsFilterToList(filters: FilterFunction[], rm: RouteAndParse): void {
    if (filters) {
      filters.push((fCtx) => RunHandlerAsFilter.runHandler(fCtx, rm));
    }
  }
}
