import {S3Event} from 'aws-lambda';

export interface S3RemoveHandlerFunction {
    (event: S3Event): Promise<void>
}
