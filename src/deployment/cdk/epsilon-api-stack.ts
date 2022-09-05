import { Duration, Lazy, Size, Stack } from 'aws-cdk-lib';
import {
  CfnComputeEnvironment,
  CfnComputeEnvironmentProps,
  CfnJobDefinition,
  CfnJobDefinitionProps,
  CfnJobQueue,
  CfnJobQueueProps,
} from 'aws-cdk-lib/aws-batch';
import { Construct } from 'constructs';
import { DockerImageCode, DockerImageFunction, FunctionUrl, FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { CfnInstanceProfile, ManagedPolicy, PolicyDocument, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { EpsilonStackUtil } from './epsilon-stack-util';
import { EpsilonApiStackProps } from './epsilon-api-stack-props';
import { EpsilonBuildProperties } from '../../epsilon-build-properties';

export class EpsilonApiStack extends Stack {
  private webHandler: DockerImageFunction;
  private backgroundHandler: DockerImageFunction;

  public apiDomain: string;

  constructor(scope: Construct, id: string, props?: EpsilonApiStackProps) {
    super(scope, id, props);

    // Build the docker image first
    const dockerImageAsset: DockerImageAsset = new DockerImageAsset(this, id + 'DockerImage', {
      directory: props.dockerFileFolder,
      file: props.dockerFileName,
    });
    const dockerImageCode: DockerImageCode = DockerImageCode.fromImageAsset(props.dockerFileFolder, { file: props.dockerFileName });

    const notificationTopic: Topic = new Topic(this, id + 'WorkNotificationTopic');
    const workQueue: Queue = new Queue(this, id + 'WorkQueue', {
      fifo: true,
      retentionPeriod: Duration.hours(8),
      visibilityTimeout: Duration.minutes(5),
      contentBasedDeduplication: true,
      ...props,
    });

    const interApiGenericEventTopic: Topic = new Topic(this, id + 'InterApiTopic');

    const epsilonEnv: Record<string, string> = {
      EPSILON_AWS_REGION: StringRatchet.safeString(Stack.of(this).region),
      EPSILON_AWS_AVAILABILITY_ZONES: StringRatchet.safeString(JSON.stringify(Stack.of(this).availabilityZones)),
      EPSILON_BACKGROUND_SQS_QUEUE_URL: StringRatchet.safeString(workQueue.queueUrl),
      EPSILON_BACKGROUND_SNS_TOPIC_ARN: StringRatchet.safeString(notificationTopic.topicArn),
      EPSILON_INTER_API_EVENT_TOPIC_ARN: StringRatchet.safeString(interApiGenericEventTopic.topicArn),
      EPSILON_LIB_BUILD_HASH: StringRatchet.safeString(EpsilonBuildProperties.buildHash),
      EPSILON_LIB_BUILD_TIME: StringRatchet.safeString(EpsilonBuildProperties.buildTime),
      EPSILON_LIB_BUILD_BRANCH_OR_TAG: StringRatchet.safeString(EpsilonBuildProperties.buildBranchOrTag),
      EPSILON_LIB_BUILD_VERSION: StringRatchet.safeString(EpsilonBuildProperties.buildVersion),
    };
    const env: Record<string, string> = Object.assign({}, props.extraEnvironmentalVars || {}, epsilonEnv);

    // Then build the Batch compute stuff...
    const ecsRole = new Role(this, id + 'AwsEcsRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        root: new PolicyDocument({
          statements: EpsilonStackUtil.ECS_POLICY_STATEMENTS,
        }),
      },
    });

    const ecsInstanceProfile = new CfnInstanceProfile(this, id + 'EcsInstanceProfile', {
      path: '/',
      roles: [ecsRole.roleName],
    });

    const jobRole = new Role(this, id + 'AwsBatchRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')],
      inlinePolicies: {
        root: new PolicyDocument({
          statements: EpsilonStackUtil.createDefaultPolicyStatementList(props, workQueue, notificationTopic, interApiGenericEventTopic),
        }),
      },
    });

    // Created AWSServiceBatchRole
    // https://docs.aws.amazon.com/batch/latest/userguide/service_IAM_role.html
    const compEnvProps: CfnComputeEnvironmentProps = {
      replaceComputeEnvironment: false,
      computeResources: {
        minvCpus: 0,
        maxvCpus: 16,
        instanceTypes: ['optimal'],
        instanceRole: ecsInstanceProfile.attrArn,
        ec2KeyPair: props.batchInstancesEc2KeyPairName,
        type: 'EC2',
        subnets: props.vpcSubnetIds.map((s) => 'subnet-' + s),
        securityGroupIds: props.lambdaSecurityGroupIds.map((s) => 'sg-' + s),
        allocationStrategy: 'BEST_FIT',
      },
      serviceRole: 'arn:aws:iam::' + props.env.account + ':role/AWSBatchServiceRole',
      type: 'MANAGED',
      state: 'ENABLED',
    };

    const compEnv: CfnComputeEnvironment = new CfnComputeEnvironment(this, id + 'ComputeEnv', compEnvProps);

    const batchJobQueueProps: CfnJobQueueProps = {
      state: 'ENABLED',
      priority: 1,
      computeEnvironmentOrder: [
        {
          computeEnvironment: compEnv.attrComputeEnvironmentArn,
          order: 1,
        },
      ],
      // the properties below are optional
      //jobQueueName: 'jobQueueName',
      //schedulingPolicyArn: 'schedulingPolicyArn',
      //state: 'state',
      tags: {
        tagsKey: id,
      },
    };

    const batchJobQueue = new CfnJobQueue(this, id + 'BatchJobQueue', batchJobQueueProps);

    const batchEnvVars: any[] = EpsilonStackUtil.toEnvironmentVariables([
      env,
      props.extraEnvironmentalVars || {},
      {
        EPSILON_RUNNING_IN_AWS_BATCH: true,
      },
    ]);
    const jobProps: CfnJobDefinitionProps = {
      type: 'container',
      platformCapabilities: ['EC2'],
      containerProperties: {
        mountPoints: [],
        volumes: [],
        memory: 4294,
        privileged: false,
        jobRoleArn: jobRole.roleArn,
        readonlyRootFilesystem: false,
        vcpus: 1,
        image: dockerImageAsset.imageUri,
        command: ['Ref::taskName', 'Ref::taskData', 'Ref::traceId', 'Ref::traceDepth'], // Bootstrap to the Lambda handler
        environment: batchEnvVars,
      },
    };

    const jobDef: CfnJobDefinition = new CfnJobDefinition(this, id + 'JobDefinition', jobProps);

    const lambdaRole = new Role(this, 'customRole', {
      roleName: id + 'LambdaCustomRole',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')],
      inlinePolicies: {
        root: new PolicyDocument({
          statements: EpsilonStackUtil.createDefaultPolicyStatementList(props, workQueue, notificationTopic, interApiGenericEventTopic),
        }),
      },
    });

    // Add AWS batch vars to the environment
    env['EPSILON_AWS_BATCH_JOB_DEFINITION_ARN'] = jobDef.ref;
    env['EPSILON_AWS_BATCH_JOB_QUEUE_ARN'] = batchJobQueue.ref;

    this.webHandler = new DockerImageFunction(this, id + 'Web', {
      //reservedConcurrentExecutions: 1,
      retryAttempts: 2,
      //allowAllOutbound: true, // Needs a VPC
      memorySize: props.webMemorySizeMb || 128,
      ephemeralStorageSize: Size.mebibytes(512),
      timeout: Duration.seconds(props.webTimeoutSeconds || 20),
      code: dockerImageCode,
      role: lambdaRole,
      environment: env,
    });

    if (props?.webLambdaPingMinutes && props.webLambdaPingMinutes > 0) {
      // Wire up the cron handler
      const rule = new Rule(this, id + 'WebKeepaliveRule', {
        schedule: Schedule.rate(Duration.minutes(Math.ceil(props.webLambdaPingMinutes))),
      });
      rule.addTarget(new LambdaFunction(this.webHandler));
    }

    const fnUrl: FunctionUrl = this.webHandler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        allowedMethods: [HttpMethod.ALL],
        allowCredentials: true,
      },
    });

    this.backgroundHandler = new DockerImageFunction(this, id + 'Background', {
      //reservedConcurrentExecutions: 1,
      retryAttempts: 2,
      // allowAllOutbound: true,
      memorySize: props.backgroundMemorySizeMb || 3000,
      ephemeralStorageSize: Size.mebibytes(512),
      timeout: Duration.seconds(props.backgroundTimeoutSeconds || 900),
      code: dockerImageCode,
      role: lambdaRole,
      environment: env,
    });

    notificationTopic.addSubscription(new LambdaSubscription(this.backgroundHandler));
    interApiGenericEventTopic.addSubscription(new LambdaSubscription(this.backgroundHandler));

    // Wire up the cron handler
    const rule = new Rule(this, id + 'CronRule', {
      schedule: Schedule.rate(Duration.minutes(1)),
    });
    rule.addTarget(new LambdaFunction(this.backgroundHandler));

    this.apiDomain = Lazy.uncachedString({
      produce: (context) => {
        const resolved = context.resolve(fnUrl.url);
        return { 'Fn::Select': [2, { 'Fn::Split': ['/', resolved] }] } as any;
      },
    });
  }
}
