import {S3HandlerFunction} from './s3-handler-function';

export interface S3Config {
    // S3 events mapped by bucket name
    handlers: Map<string, S3HandlerFunction>;
}
