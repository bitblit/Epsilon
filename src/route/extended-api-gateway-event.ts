import {APIGatewayEvent} from 'aws-lambda';


export interface ExtendedAPIGatewayEvent extends APIGatewayEvent{
    parsedBody: any;

}
