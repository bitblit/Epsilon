import {RouterConfig} from './route/router-config';
import {APIGatewayEvent, Callback, Context, ProxyResult} from 'aws-lambda';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import * as zlib from 'zlib';
import * as Route from 'route-parser';

export class WebHandler {
    private routerConfig: RouterConfig;
    private corsResponse: ProxyResult = {statusCode:200, body: '{"cors":true}', headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'}} as ProxyResult;

    constructor(routing: RouterConfig)
    {
        this.routerConfig = routing;
    }

    public lamdaHandler (event: APIGatewayEvent, context: Context, callback: Callback) : void {
        try {
            if (!this.routerConfig)
            {
                throw new Error('Router config not found');
            }

            let handler: Promise<any> = this.findHandler(event);

            Logger.info('Processing event : %j', event);

            handler.then(result=>{
                Logger.debug('Returning : %j', result);
                let proxyResult: ProxyResult = this.coerceToProxyResult(result);
                callback(null, proxyResult);
                // TODO: Reenable : this.zipAndReturn(JSON.stringify(result), 'application/json', callback);
            }).catch(err=>{
                Logger.warn('Unhandled error (in promise catch) : %s',err);
                callback(null,WebHandler.errorToProxyResult(err));
            });


        }
        catch (err)
        {
            Logger.warn('Unhandled error (in wrapping catch) : %s',err);
            callback(null,WebHandler.errorToProxyResult(err));
        }
    };

    private cleanPath(event: APIGatewayEvent) : string
    {
        let rval : string = event.path;
        // First, strip any leading /
        while (rval.startsWith('/'))
        {
            rval = rval.substring(1);
        }
        // Next, if there is a stage, remove it
        let stage : string = event.requestContext.stage;
        if (stage && rval.startsWith(stage))
        {
            rval = rval.substring(stage.length);
        }
        // Finally, strip any more leading /
        while (rval.startsWith('/'))
        {
            rval = rval.substring(1);
        }

        return rval;
    }

    public static errorResponse(errorMessages:string[], statusCode:number) : ProxyResult
    {
        let body: any = {
            errors:errorMessages,
            httpStatusCode:statusCode
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

    public static redirect(target:string) : ProxyResult
    {
        return {
            statusCode: 301,
            body: '{"redirect-target":"'+target+'}',
            headers: {
                'Content-Type' : 'application/json',
                'Location': target
            }
        } as ProxyResult;
    }

    public static buildHttpError(errorMessage:string, statusCode:number) : Error {
        let rval : Error = new Error(errorMessage);
        rval['statusCode']=statusCode;

        return rval
    }

    public static errorToProxyResult(error:Error) : ProxyResult
    {
        let code = error['statusCode'] || 500;
        let errorMessages: string[] = (error['messages'] && error['messages'].length>0)?error['messages']:null;
        errorMessages = (errorMessages)?errorMessages:[(error.message || JSON.stringify(error))];

        return this.errorResponse(errorMessages,code);
    }

    private coerceToProxyResult(input:any) : ProxyResult
    {
        let rval: ProxyResult = null;

        if (input!=null)
        {
            if (typeof input === 'object')
            {
                if (input.statusCode && input.body)
                {
                    rval = Object.assign({}, input) as ProxyResult;
                    if (typeof input.body==='string')
                    {
                        // Do Nothing
                    }
                    else if (Buffer.isBuffer(input.body))
                    {
                        rval.body = input.body.toString('base64');
                        rval.headers = input.headers || {};
                        rval.headers['Content-Type']=input.body.contentType; // TODO: Does this work?
                        rval.isBase64Encoded = true;
                    }
                }
                else
                {
                    // Its a generic object
                    let headers : any = input.headers || {};
                    headers['Content-Type']='application/json';
                    rval = this.coerceToProxyResult({statusCode:200, body:JSON.stringify(input),headers:headers});
                }
            }
            else if (typeof input === 'string' || Buffer.isBuffer(input))
            {
                rval = this.coerceToProxyResult({statusCode:200, body:input});
            }

        }

        return rval;
    }

    private findHandler(event: APIGatewayEvent): Promise<any>
    {
        let rval: Promise<any> = null;

        if (event.httpMethod=='OPTIONS' && !this.routerConfig.disableCORS)
        {
            Logger.debug('Options call, returning CORS');
            rval = Promise.resolve(this.corsResponse);
        } else {
            // See: https://www.npmjs.com/package/route-parser
            let cleanPath:string = this.cleanPath(event);
            this.routerConfig.routes.forEach(rm=>{
                if (!rval) // TODO: Short circuit would be better
                {
                    if (rm.method && rm.method.toLowerCase()===event.httpMethod.toLowerCase())
                    {
                        let routeParser: Route = new Route(rm.path);
                        if (routeParser.match(cleanPath))
                        {
                            rval = rm.handlerOb[rm.handlerName](event);
                        }
                    }
                }
            });
        }

        if (!rval)
        {
            Logger.debug('Failed to find handler for %s',event.path);
            rval = Promise.resolve(WebHandler.errorResponse(['No such endpoint'],404));
        }
        return rval;

    }

    private zipAndReturn(content:any, contentType:string, callback:Callback) : void
    {
        if (this.shouldGzip(content.length,contentType)) {
            this.gzip(content).then((compressed) => {
                let contents64 = compressed.toString('base64');

                let response = {
                    statusCode: 200,
                    isBase64Encoded: true,
                    headers: {
                        'Content-Type': contentType,
                        'content-encoding': 'gzip'
                    },
                    body: contents64
                };

                Logger.debug("Sending response with gzip body, length is %d", contents64.length);
                callback(null, response);
            });
        }
        else
        {
            let contents64 = content.toString('base64');

            let response = {
                statusCode: 200,
                isBase64Encoded: true,
                headers: {
                    'Content-Type': contentType,
                },
                body: contents64
            };

            Logger.debug("Sending response with gzip body, length is %d", contents64.length);
            callback(null, response);

        }
    }


    private shouldGzip(fileSize: number, contentType:string) : boolean {
        /*

        let rval : boolean = (fileSize>2048); // MTU packet is 1400 bytes
        if (rval && contentType) {
          let test : string = contentType.toLowerCase();
          if (test.startsWith("image/") && test.indexOf('svg')==-1)
          {
            rval = false;
          }
          else if (test=='application/pdf')
          {
            rval = false;
          }
        }

        return rval;
        */
        // May put this back in later
        return true;
    }


    private gzip(input, options={}) : Promise<Buffer>{
        var promise = new Promise<Buffer>(function (resolve, reject) {
            zlib.gzip(input, options, function (error, result) {
                if (!error) resolve(result);else reject(error);
            });
        });
        return promise;
    };

}
