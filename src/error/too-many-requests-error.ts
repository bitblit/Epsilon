
export class TooManyRequestsError extends Error{
    constructor(...messages:string[])
    {
        super(messages.join(','));
        this['messages']=messages;
        this['statusCode']=429;
    }
}
