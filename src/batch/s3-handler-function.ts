import {S3CreateEvent} from 'aws-lambda';

export interface S3HandlerFunction {
    (event: S3CreateEvent): Promise<Promise<any>>
}
