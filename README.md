# Epsilon
A tiny library to simplify serving consistent apis from Lambda with OpenAPI

## How better than just using straight Node?
* Uses typescript instead of the Godforsaken straight javascript
* Handles route mapping (multiple ends, single lambda)
* Uses Promises and has a top level .catch to convert to 500
* Adds compression
* Adds CORS
* Adds JWT handling
* Consistent error handling
* Can serve static content as well
* Kinda-persistent objects allow for optimistic caching

# How better than using Express?
* Doesn't have req/res architecture to fake so much easier to test
* Much lighter


# Other service
* Environmental service
* Simple redirects


# Usage

## Using WebHandler to simplify the Lambda 

You will configure a RouterConfig, and then create a WebHandler from that.  Your lambda
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

This will pass through anyone with a valid JWT token.  Note that Epsilon doesn't yet support role based
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