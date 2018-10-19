import {DynamoDBStreamEvent} from 'aws-lambda';

export interface DynamoDbHandlerFunction {
    (event: DynamoDBStreamEvent): Promise<Promise<any>>
}
