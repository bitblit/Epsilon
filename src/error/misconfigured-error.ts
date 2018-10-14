export class MisconfiguredError extends Error {
    constructor(...messages: string[]) {
        super(messages.join(','));
        this['messages'] = messages;
        this['statusCode'] = 500;
    }
}
