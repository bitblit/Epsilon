# Epsilon

A tiny library to simplify serving consistent apis from Lambda with OpenAPI

You may wish to read [the changelog](CHANGELOG.md)

# TODO:

- Discuss pros/cons of single lambda for http/batch in this document
- path/query var checking against open api doc
- check compression handling

## How better than just using straight Node?

- Uses typescript instead of the Godforsaken straight javascript
- Handles route mapping (multiple ends, single lambda)
- Uses Promises and has a top level .catch to convert to 500
- Adds compression
- Adds CORS
- Adds JWT handling
- Consistent error handling
- Can serve static content as well
- Kinda-persistent objects allow for optimistic caching
- Built in support for Non-HTTP (Batch) processing via SaltMint, SNS, SQS, Email, etc

# How better than using Express?

- Doesn't have req/res architecture to fake so much easier to test
- OpenAPI first design
- Much lighter
- Support for backgrounding, CRON, Inter-API messaging, AWS Batch out of the box

# Other services

- Environmental service
- Simple redirects

# CDK Automatic Construction

## Introduction

## Prerequisites

- Any time you are doing something automated like this, I **HIGHLY RECOMMEND** setting up a billing alert first. Don't
  blame me if you skip this step and then accidentally spend $1,000 next month. (https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html)
- CDK V2 must be bootstrapped in your account (https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
  -- e.g. (**npx cdk bootstrap aws://1234567890/us-east-1**)
- The user running the CDK deploy needs -LOTS- of AWS privs (I'll list them all later. For now, assume a bunch)
- Policy **arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole** must exist (this should be there by default)
- Policy **arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole** must exist (You may have to create it - see https://docs.aws.amazon.com/batch/latest/userguide/service_IAM_role.html)
- You should have a VPC that your Lambda's will deploy into, and you should know its id (e.g., **vpc-123456789**)
- That VPC should have one or more subnets, and you should know their ids (e.g., **05966bfadca940a88**)
- That VPC should have a security group, which probably should allow outbound traffic if you want your lambda to talk to the internet. You should know its id (e.g., **02a89a55b0f2cb4ae** - leave off the **sg-** prefix)

## Api Setup

- Your api layer, in addition to depending on Epsilon, will need:
  ** "aws-cdk-lib": (Peer version)
  ** "constructs": (Peer version)
  \*\* "walk": (Peer version)

## Docker setup

### .dockerignore

In general the docker file needs to be in a folder above both your api and cdk folders, but it must ignore
the cdk folder in that case or it will infinitely recurse

```
# Need this here to prevent infinite recusion of cdk folder at least
.github
.idea
.yarn
.git
modules/cdk
node_modules
```

### DockerFile

```
FROM public.ecr.aws/lambda/nodejs:14
COPY modules/api/package.json modules/api/gql-codegen.yml modules/api/tsconfig.json ${LAMBDA_TASK_ROOT}/
COPY modules/api/src ${LAMBDA_TASK_ROOT}/src
COPY lambda-bootstrap-shell.sh ${LAMBDA_TASK_ROOT}
RUN npm install -g yarn
RUN yarn install
RUN yarn clean-compile
ENTRYPOINT ["sh","/var/task/lambda-bootstrap-shell.sh"]
CMD [ "dist/lambda.handler" ]
```

### lambda-bootstrap-shell.sh

```
#!/bin/sh
# Based on the default script in public.ecr.aws/lambda/nodejs:14, which is copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# Modifications copyright Christopher Weiss, 2022

if [ -z "${EPSILON_RUNNING_IN_AWS_BATCH}" ]; then
    if [ $# -lt 1 ]; then
      echo "entrypoint requires the handler name to be the first argument" 1>&2
      exit 142
    fi
    export _HANDLER="$1"

    RUNTIME_ENTRYPOINT=/var/runtime/bootstrap
    if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
      exec /usr/local/bin/aws-lambda-rie $RUNTIME_ENTRYPOINT
    else
      exec $RUNTIME_ENTRYPOINT
    fi
  else
    echo "Running Epsilon inside AWS batch - triggering direct $1 $2"
    exec node dist/aws-batch-cli.js --process $1 --data $2
fi
```

# GraphQL Support (v0.1.x and above)

If you are just doing straight GraphQL then you don't really need to use Epsilon at all (I'd recommend just
going with straight https://www.npmjs.com/package/apollo-server-lambda). However, if you want to start messing
with GraphQL while maintaining your existing OpenAPI 3.0 endpoints, Epsilon allows you to designate a regular
expression for which all matching requests are delegated to a supplied ApolloServer, bypassing Epsilon.

To do this, you must include the following libraries (They aren't marked as dependencies of Epsilon since they
aren't required if you don't support GraphQL)

```
    "apollo-server-lambda": "2.8.1",
    "graphql": "14.4.2",
```

Then, in your router-config, you must set an ApolloServer and an Apollo Regex:

```typescript
const typeDefs = gql`
  type Query {
    hello: String
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
};

const server: ApolloServer = new ApolloServer({ typeDefs, resolvers });

// ...

const cfg: RouterConfig = RouterUtil.openApiYamlToRouterConfig(yamlString, handlers, authorizers, options);

// ...
cfg.apolloServer = server;
cfg.apolloCreateHandlerOptions = {
  origin: '*',
  credentials: true,
} as CreateHandlerOptions;
cfg.apolloRegex = new RegExp('.*graphql.*');
```

# Usage

## Using WebHandler to simplify the Lambda

You will configure a RouterConfig, and then create a WebHandler from that. Your lambda
function should look like:

```
const handler: Handler = (event: APIGatewayEvent, context: Context, callback: Callback) => {
    const routerConfig: RouterConfig = getMyRouterConfig(); // Implement this function
    const commonHandler: WebHandler = new WebHandler(routerConfig);
    commonHandler.lambdaHandler(event, context, callback);
};

export {handler};

```

## Using auth/AuthHandler to simplify a JWT token based auth

Your auth lambda should look like this (I here assume you are storing your encryption key in AWS
System Manager so you can keep it encrypted at rest, which you definitely should be doing):

```

import {AuthHandler} from '@bitblit/epsilon/dist/auth/auth-handler';
import {Callback, Context, CustomAuthorizerEvent, Handler} from 'aws-lambda';
import {EnvironmentService} from '@bitblit/ratchet/dist/aws/environment-service';
import 'reflect-metadata';

const handler: Handler = (event: CustomAuthorizerEvent, context: Context, callback: Callback) => {

    EnvironmentService.getConfig('MyConfigurationName').then(cfg => {
        const commonAuth: AuthHandler = new AuthHandler('api.mycompany.com', cfg['encryptionKey']);
        commonAuth.lambdaHandler(event, context, callback);
    });
};

export {handler};

```

This will pass through anyone with a valid JWT token. Note that Epsilon doesn't yet support role based
filtering in this version.

To create valid JWT tokens, your authentication endpoint can use the **auth/WebTokenManipulator** class like so
(after you have verified the users principal/credentials pair) :

```
  // Other authentication stuff happens up here.
  const email: string = 'user-email@test.com';
  const roles: string[] = ['USER','NOT-AN-ADMIN'];
  const userData: any = {'other': 'stuff'};
  const myConfig: any = await EnvironmentService.getConfig('MyConfigurationName'); // same as above
  const encryptionKey: string =  cfg['encryptionKey'];
  const adminUser: any = null; // Set this if the user is an admin doing run-as (this is the admin user)
  const expSec: number = 3600; // How long until this token expires in seconds

  const tokenHandler: WebTokenManipulator = new WebTokenManipulator(encryptionKey, 'api.mycompany.com');
  const token: string = tokenHandler.createJWTString(email, userData, roles, expSec, admin);

```

# Notes on adding a new gateway/stage

You'll need to auth the gateway to hit the lambda (yes, as of 2018-10-13 this is still ugly) :

```
aws lambda add-permission --function-name "arn:aws:lambda:us-east-1:{accountId}:function:{lambda-function-name}"
  --source-arn "arn:aws:execute-api:us-east-1:{account number}:{api id}/*/*/*"
    --principal apigateway.amazonaws.com
      --statement-id b57d8a0f-08e5-407c-9093-47d7e8e840bc
        --action lambda:InvokeFunction

```

And you'll need to remember to go to IAM / Keys and authorize the new stack user to use your KMS key (if you are
using KMS to encrypt your config via SystemManager, which you should be doing)
