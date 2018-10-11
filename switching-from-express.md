# Switching from Express

In my previous projects I have used the Express starter from AWS.  This doc keeps track of what I had to change to
switch over to Epsilon and Inversion of control

As usual, my requirements include using an OpenAPI doc (it was 2.0 when I started).  I was also using an API Gateway
authorizer function when I started but I am going to collapse that into using Epsilon for that too.


## package.json

Add:

```
    "@bitbit/epsilon": "0.0.27",

```

Remove:

```
    "aws-serverless-express": "^3.0.0",
    "body-parser": "^1.17.1",
    "compression": "^1.6.2",
    "cors": "^2.8.3",
    "express": "^4.15.2",


```

Remove (Dev dep)

```
    "@types/aws-serverless-express": "^3.0.1",
    "@types/body-parser": "0.0.33",
    "@types/express": "^4.0.33",
```

### Change Scripts
Were:

```
  "scripts": {
    "start": "cd dist && node app.local.js",
    "config": "node ./scripts/configure.js",
    "deconfig": "node ./scripts/deconfigure.js",
    "local": "node scripts/local",
    "lint": "tslint --project .",
    "tsc": "tsc",
    "test": "mocha -r ts-node/register test/**/*.ts",
    "create-prod-swagger": "node scripts/createSwaggerDoc.js api-swagger-definition-template.yaml packaged-api-swagger-definition.yaml swagger-mods-prod.json",
    "create-dev-swagger": "node scripts/createSwaggerDoc.js api-swagger-definition-template.yaml packaged-api-swagger-definition.yaml swagger-mods-dev.json",
    "remove-packaged-swagger": "rm packaged-api-swagger-definition.yaml",
    "invoke-lambda": "aws lambda invoke --function-name $npm_package_config_functionName --region $npm_package_config_region --payload file://api-gateway-event.json lambda-invoke-response.json && cat lambda-invoke-response.json",
    "create-bucket": "aws s3 mb s3://$npm_package_config_s3BucketName --region $npm_package_config_region",
    "delete-bucket": "aws s3 rb s3://$npm_package_config_s3BucketName --region $npm_package_config_region",
    "run-gulp": "gulp createLambdaPackage",
    "package": "yarn run run-gulp && aws cloudformation package --template ./cloudformation.yaml --s3-bucket $npm_package_config_s3BucketName --output-template packaged-sam.yaml --region $npm_package_config_region && gulp cleanLambdaPackage",
    "package-batch": "yarn run run-gulp && aws cloudformation package --template ./cloudformation-batch.yaml --s3-bucket $npm_package_config_s3BucketName --output-template packaged-sam.yaml --region $npm_package_config_region && gulp cleanLambdaPackage",
    "deploy-dev": "aws cloudformation deploy --template-file packaged-sam.yaml --stack-name NeonDev --capabilities CAPABILITY_IAM --region $npm_package_config_region --parameter-overrides Stage=dev",
    "deploy-prod": "aws cloudformation deploy --template-file packaged-sam.yaml --stack-name NeonProd --capabilities CAPABILITY_IAM --region $npm_package_config_region --parameter-overrides Stage=v0",
    "deploy-batch": "aws cloudformation deploy --template-file packaged-sam.yaml --stack-name NeonBatch --capabilities CAPABILITY_IAM --region $npm_package_config_region --parameter-overrides Stage=batch",
    "package-deploy-dev": "yarn run create-dev-swagger && yarn run package && yarn run deploy-dev",
    "package-deploy-prod": "yarn run create-prod-swagger && yarn run package && yarn run deploy-prod",
    "package-deploy-batch": "yarn run package-batch && yarn run deploy-batch",
    "delete-stack-dev": "aws cloudformation delete-stack --stack-name $npm_package_config_cloudFormationStackName --region $npm_package_config_region",
    "delete-stack-prod": "aws cloudformation delete-stack --stack-name $npm_package_config_cloudFormationStackName --region $npm_package_config_region",
    "setup": "yarn install && (aws s3api get-bucket-location --bucket $npm_package_config_s3BucketName --region $npm_package_config_region || yarn run create-bucket) && yarn run package-deploy-dev"
  },
```

to 

```
  "scripts": {
    "compile": "yarn run clean && tsc && npm run copy-static-files",
    "watch": "tsc -w .",
    "clean": "rm -Rf dist",
    "test": "mocha -r ts-node/register test/**/*.ts",
    "lint": "tslint --project .",
    "copy-static-files": "cd src && find . -type f -not -name \"*.ts\" -exec cp '{}' '../dist/{}' ';'",
    "prepare-lambda": "rm -Rf dist && webpack && rm -Rf dist/dist && yarn run copy-static-files",
    "package": "yarn run prepare-lambda && aws cloudformation package --template ./cloudformation.yaml --s3-bucket erigir-cloudformation-upload --output-template packaged-sam.yaml --region us-east-1",
    "package-batch": "yarn run prepare-lambda && aws cloudformation package --template ./cloudformation-batch.yaml --s3-bucket erigir-cloudformation-upload --output-template packaged-sam.yaml --region us-east-1",
    "deploy-prod": "aws cloudformation deploy --template-file packaged-sam.yaml --stack-name ParatradeProd --capabilities CAPABILITY_IAM --region us-east-1 --parameter-overrides Stage=v0",
    "deploy-dev": "aws cloudformation deploy --template-file packaged-sam.yaml --stack-name ParatradeDev --capabilities CAPABILITY_IAM --region us-east-1 --parameter-overrides Stage=dev",
    "deploy-batch": "aws cloudformation deploy --template-file packaged-sam.yaml --stack-name ParatradeBatch --capabilities CAPABILITY_IAM --region us-east-1 --parameter-overrides Stage=batch",
    "package-deploy-dev": "yarn run package && yarn run deploy-dev",
    "package-deploy-prod": "yarn run package && yarn run deploy-prod",
    "package-deploy-batch": "yarn run package-batch  && yarn run deploy-batch",
    "update-website-api-lib": "node scripts/createClientLibraries https://api.para.trade/v0/meta/open-api-document && unzip typescript-fetch-client-generated.zip && cp typescript-fetch-client/api.ts ../website/src/app/api-client && rm -Rf typescript-fetch-client*",
    "cw": "yarn run package-deploy-prod && yarn run update-website-api-lib",
    "pdb": "yarn run package-deploy-batch"
  },
  "license": "UNLICENSED",

```


## Move from gulp build to webpack


At the same time I am also removing Gulp: 

```
    "gulp": "^3.9.1",
    "gulp-npm-files": "^0.1.3",
    "gulp-tslint": "^8.1.3",
    "gulp-typescript": "^4.0.1",
    "gulp-zip": "^4.1.0",
```

And adding webpack to the dev dependencies(which I will use to create the lambda)

```
    "uglifyjs-webpack-plugin": "^1.3.0",
    "webpack": "^4.17.2",
    "webpack-cli": "3.1.0"

```

* Copied in webpack.config.js from my Paratrade project

# Add switches to tsconfig.json

```
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,

```

# Switch to the Epsilon wrapper lambda

* Removed my lambda.ts and replaced with the lambda.ts from my Paratrade project (not rewiring batch handling until later)

# Create an IOC container class we can add to over time

* I created neon-container

# Add IOC to all services

Add to the top of every service class
```
import {Injectable} from 'injection-js';
import 'reflect-metadata';


@Injectable()

```

Also, if anything is a singleton, remove that

# Convert all "routers" to "handlers"

* Replace req/res with event
* Make all return a Promise<T>
* Convert all routes to entries in the route mapping object
