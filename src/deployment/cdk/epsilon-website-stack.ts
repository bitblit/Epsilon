import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path from 'path';
import {
  CloudFrontAllowedCachedMethods,
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  CloudFrontWebDistributionProps,
  HttpVersion,
  OriginAccessIdentity,
  OriginProtocolPolicy,
  PriceClass,
  SourceConfiguration,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HostedZone, RecordSet, RecordType } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { EpsilonWebsiteStackProps } from './epsilon-website-stack-props';

export class EpsilonWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: EpsilonWebsiteStackProps) {
    super(scope, id, props);

    const websiteBucket = new Bucket(this, id + 'DeployBucket', {
      bucketName: props.targetBucketName,
      //removalPolicy: RemovalPolicy.DESTROY,
      //autoDeleteObjects: true,
      versioned: false,
      publicReadAccess: false,
      encryption: BucketEncryption.S3_MANAGED,
      /*
            cors: [
              {
                allowedMethods: [
                  HttpMethods.GET,
                  HttpMethods.POST,
                  HttpMethods.PUT,
                ],
                allowedOrigins: ['http://localhost:3000'],
                allowedHeaders: ['*'],
              },
            ],

            lifecycleRules: [
              {
                abortIncompleteMultipartUploadAfter: cdk.Duration.days(90),
                expiration: cdk.Duration.days(365),
                transitions: [
                  {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: cdk.Duration.days(30),
                  },
                ],
              },
            ],
                   */
    });

    //websiteBucket.grantReadWrite(webHandler);
    //websiteBucket.grantReadWrite(bgHandler);

    const originAccessId: OriginAccessIdentity = new OriginAccessIdentity(this, id + 'OriginAccessId');
    const assetSource: SourceConfiguration = {
      s3OriginSource: {
        s3BucketSource: websiteBucket,
        originAccessIdentity: originAccessId,
      },
      behaviors: [
        {
          isDefaultBehavior: true,
          compress: true,
          defaultTtl: Duration.seconds(1), //  Duration.days(100),
          minTtl: Duration.seconds(1), //Duration.days(90),
          maxTtl: Duration.seconds(1), //Duration.days(110),
          forwardedValues: {
            queryString: false,
          },
        },
      ],
    };

    //const parseUrl: URL = new URL(fnUrl.url);
    const apiSource: SourceConfiguration = {
      customOriginSource: {
        domainName: props.apiDomainName,
        originProtocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
      },
      //originPath: '/',
      behaviors: [
        {
          compress: true,
          forwardedValues: {
            queryString: true,
            cookies: {
              forward: 'whitelist',
              whitelistedNames: ['idToken'],
            },
            headers: ['Accept', 'Referer', 'Authorization', 'Content-Type'],
          },
          pathPattern: 'graphql',
          defaultTtl: Duration.seconds(0),
          maxTtl: Duration.seconds(0),
          minTtl: Duration.seconds(0),
          allowedMethods: CloudFrontAllowedMethods.ALL,
          cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD,
        },
      ],
    };

    const distributionProps: CloudFrontWebDistributionProps = {
      httpVersion: HttpVersion.HTTP2,
      defaultRootObject: 'index.html',
      originConfigs: [assetSource, apiSource],
      errorConfigurations: [
        {
          errorCode: 404,
          errorCachingMinTtl: 300,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
        {
          errorCode: 403,
          errorCachingMinTtl: 300,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
      ],
      priceClass: PriceClass.PRICE_CLASS_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      viewerCertificate: {
        aliases: props.cloudFrontDomainNames,
        props: {
          acmCertificateArn: props.cloudFrontHttpsCertificateArn,
          sslSupportMethod: 'sni-only',
        },
      },
    };

    const cloudfrontDistro: CloudFrontWebDistribution = new CloudFrontWebDistribution(this, id + 'CloudfrontDistro', distributionProps);

    if (props?.cloudFrontDomainNames?.length) {
      for (let i = 0; i < props.cloudFrontDomainNames.length; i++) {
        const domain = new RecordSet(this, id + 'DomainName-' + props.cloudFrontDomainNames[i], {
          recordType: RecordType.A,
          recordName: props.cloudFrontDomainNames[i],
          target: {
            aliasTarget: new CloudFrontTarget(cloudfrontDistro),
          },
          zone: HostedZone.fromLookup(this, id, { domainName: props.cloudFrontDomainNames[i] }),
        });
      }
    }

    new BucketDeployment(this, id + 'SiteDeploy', {
      sources: [Source.asset(path.resolve('../website/dist'))],
      destinationBucket: websiteBucket,
      distribution: cloudfrontDistro,
      distributionPaths: ['/*'], //'/locales/*', '/index.html', '/manifest.webmanifest', '/service-worker.js']
    });
  }
}
