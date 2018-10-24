import {S3Event} from 'aws-lambda';

export interface S3CreateHandlerFunction {
    (event: S3Event): Promise<Promise<any>>
}
