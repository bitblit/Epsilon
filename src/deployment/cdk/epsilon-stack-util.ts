import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { EpsilonApiStackProps } from './epsilon-api-stack-props';

export class EpsilonStackUtil {
  // Prevent instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static toEnvironmentVariables(input: Record<string, any>[]): any[] {
    const rval: any[] = [];
    input.forEach((inval) => {
      Object.keys(inval).forEach((k) => {
        rval.push({
          name: k,
          value: StringRatchet.safeString(inval[k]),
        });
      });
    });

    return rval;
  }

  public static createDefaultPolicyStatementList(
    props: EpsilonApiStackProps,
    backgroundLambdaSqs: Queue,
    backgroundLambdaSns: Topic,
    interApiSns: Topic
  ): PolicyStatement[] {
    const rval: PolicyStatement[] = (props.additionalPolicyStatements || []).concat([
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['arn:aws:logs:*:*:*'],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['arn:aws:ses:*'],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sqs:*'],
        resources: [backgroundLambdaSqs.queueArn],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sns:*'],
        resources: [backgroundLambdaSns.topicArn, interApiSns.topicArn],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['batch:*'],
        resources: ['*'],
      }),
    ]);
    return rval;
  }

  public static readonly ALLOW_ECS: PolicyStatement = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ecs:*'],
    resources: ['*'],
  });

  public static readonly ALLOW_ECR: PolicyStatement = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer', 'ecr:GetAuthorizationToken'],
    resources: ['*'],
  });

  public static readonly ALLOW_RESTRICTED_LOGS: PolicyStatement = new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams', 'logs:CreateLogGroup'],
    resources: ['*'],
  });

  public static readonly ECS_POLICY_STATEMENTS: PolicyStatement[] = [
    EpsilonStackUtil.ALLOW_ECS,
    EpsilonStackUtil.ALLOW_ECR,
    EpsilonStackUtil.ALLOW_RESTRICTED_LOGS,
  ];
}
