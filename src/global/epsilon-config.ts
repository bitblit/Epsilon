import {RouterConfig} from '../api-gateway/route/router-config';
import {SaltMineConfig} from '@bitblit/saltmine/dist/salt-mine-config';
import {CronConfig} from '../batch/cron-config';
import {DynamoDbConfig} from '../batch/dynamo-db-config';
import {S3Config} from '../batch/s3-config';
import {SnsConfig} from '../batch/sns-config';
import {EpsilonDisableSwitches} from './epsilon-disable-switches';
import {SaltMine} from '@bitblit/saltmine/dist/salt-mine';

export interface EpsilonConfig {
    apiGateway: RouterConfig;

    saltMine: SaltMine;

    cron: CronConfig;
    dynamoDb: DynamoDbConfig;
    s3: S3Config;
    sns: SnsConfig;

    disabled: EpsilonDisableSwitches;
}
