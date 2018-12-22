import {ExtendedAPIGatewayEvent} from './extended-api-gateway-event';
import {StringRatchet} from '@bitblit/ratchet/dist/common/string-ratchet';

export class SampleHandler {


    public async handle(evt: ExtendedAPIGatewayEvent, flag?: string): Promise<any> {
        const rval: any = {
            time: new Date().toLocaleString(),
            evt: evt,
            pad: StringRatchet.createRandomHexString(2000),
            flag: flag
        };

        return rval;
    };
}