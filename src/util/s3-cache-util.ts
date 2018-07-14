/*
    Common functions for interacting with S3 for cache purposes
*/


import * as AWS from 'aws-sdk';
import {Logger} from '@bitblit/ratchet/dist/common/logger';
import moment = require('moment');

export class S3CacheUtil {

    public static readCacheFileToObject<T>(s3: AWS.S3, bucket: string, key: string): Promise<T> {
        const params = {
            Bucket: bucket,
            Key: key
        };

        return s3.getObject(params).promise().then(res => {
            if (res && res.Body) {
                return JSON.parse(res.Body.toString()) as T;
            } else {
                Logger.warn('Could not find cache file : %s / %s', bucket, key);
                return null;
            }
        }).catch(err => {
            if (err && err.statusCode === 404) {
                Logger.warn('Cache file %s %s not found returning null', bucket, key);
                return null;
            } else {
                throw err;
            }

        })
    }

    // Given new board data, write it to the S3 file and set the refresh flag appropriately
    public static writeObjectToCacheFile(s3: AWS.S3, bucket: string, key: string, dataObject: any, meta: any = {},
                                         cacheControl: string = 'max-age=30', contentType: string = 'application/json'): Promise<any> {
        const json = JSON.stringify(dataObject);

        const params = {
            Bucket: bucket,
            Key: key,
            Body: json,
            CacheControl: cacheControl,
            ContentType: contentType,
            Metadata: meta,
        };

        return s3.putObject(params).promise();
    }

    public static fetchMetaForCacheFile(s3: AWS.S3, bucket: string, key: string): Promise<any> {
        return s3.headObject({Bucket: bucket, Key: key}).promise();
    }

    public static cacheFileAgeInSeconds(s3: AWS.S3, bucket: string, key: string): Promise<any> {
        return s3.headObject({Bucket: bucket, Key: key}).promise().then(res => {
            if (res && res.LastModified) {
                const mom = moment(res.LastModified);
                return moment().unix() - mom.unix();
            } else {
                Logger.warn('Cache file %s %s had no last modified returning null', bucket, key);
                return null;
            }
        }).catch(err => {
            if (err && err.statusCode === 404) {
                Logger.warn('Cache file %s %s not found returning null', bucket, key);
                return null;
            } else {
                throw err;
            }
        })
    }

}
