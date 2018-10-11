import {ProxyResult} from 'aws-lambda';

export class ResponseUtil {

    private constructor() {} // Prevent instantiation

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

    public static coerceToProxyResult(input:any) : ProxyResult
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

    // Public so it can be used in auth-web-handler
    public static addCORSToProxyResult(input: ProxyResult, corsAllowedHeaders: string) : ProxyResult
    {
        if (!input.headers)
        {
            input.headers = {};
        }
        input.headers['Access-Control-Allow-Origin']=input.headers['Access-Control-Allow-Origin'] || '*';
        input.headers['Access-Control-Allow-Headers']=input.headers['Access-Control-Allow-Headers'] || corsAllowedHeaders;

        return input;
    }

}
