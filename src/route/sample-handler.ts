import {ExtendedAPIGatewayEvent} from './extended-api-gateway-event';

export class SampleHandler {
    public async handle(evt: ExtendedAPIGatewayEvent): Promise<any> {
        const rval: any = {
            time: new Date().toLocaleString(),
            evt: evt
        };
        return rval;
    };
}