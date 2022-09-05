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
import { EpsilonWebsiteStackProps, EpsilonWebsiteStackPropsRoute53Handling } from './epsilon-website-stack-props';
import { StringRatchet } from '@bitblit/ratchet/common/string-ratchet';
import { ErrorRatchet } from '@bitblit/ratchet/common/error-ratchet';

export class EpsilonWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: EpsilonWebsiteStackProps) {
    super(scope, id, props);

    const originAccessId: OriginAccessIdentity = new OriginAccessIdentity(this, id + 'OriginAccessId');

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

    const extraBucketAndSource: BucketAndSourceConfiguration[] = (props.simpleAdditionalMappings || []).map((eb) => {
      const nextBucket = new Bucket(this, eb.bucketName + 'DeployBucket', {
        bucketName: eb.bucketName,
        //removalPolicy: RemovalPolicy.DESTROY,
        //autoDeleteObjects: true,
        versioned: false,
        publicReadAccess: false,
        encryption: BucketEncryption.S3_MANAGED,
      });

      const nextBS: BucketAndSourceConfiguration = {
        bucket: nextBucket,
        sourceConfig: {
          s3OriginSource: {
            s3BucketSource: nextBucket,
            originAccessIdentity: originAccessId,
          },
          behaviors: [
            {
              pathPattern: eb.pathPattern,
              isDefaultBehavior: false,
              compress: true,
              defaultTtl: Duration.seconds(1), //  Duration.days(100),
              minTtl: Duration.seconds(1), //Duration.days(90),
              maxTtl: Duration.seconds(1), //Duration.days(110),
              forwardedValues: {
                queryString: false,
              },
            },
          ],
        },
      };
      return nextBS;
    });

    //websiteBucket.grantReadWrite(webHandler);
    //websiteBucket.grantReadWrite(bgHandler);

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
      originConfigs: [assetSource, apiSource, ...extraBucketAndSource.map((s) => s.sourceConfig)],
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

    // Have to be able to skip this since SOME people don't do DNS in Route53
    if (props?.route53Handling === EpsilonWebsiteStackPropsRoute53Handling.Update) {
      if (props?.cloudFrontDomainNames?.length) {
        for (let i = 0; i < props.cloudFrontDomainNames.length; i++) {
          const domain = new RecordSet(this, id + 'DomainName-' + props.cloudFrontDomainNames[i], {
            recordType: RecordType.A,
            recordName: props.cloudFrontDomainNames[i],
            target: {
              aliasTarget: new CloudFrontTarget(cloudfrontDistro),
            },
            zone: HostedZone.fromLookup(this, id, { domainName: EpsilonWebsiteStack.extractApexDomain(props.cloudFrontDomainNames[i]) }),
          });
        }
      }
    }

    //  [Source.asset(path.resolve('../website/dist'))],
    new BucketDeployment(this, id + 'SiteDeploy', {
      sources: props.pathsToAssets.map((inPath) => Source.asset(path.resolve(inPath))),
      destinationBucket: websiteBucket,
      distribution: cloudfrontDistro,
      distributionPaths: ['/*'], //'/locales/*', '/index.html', '/manifest.webmanifest', '/service-worker.js']
    });
  }

  public static extractApexDomain(domainName: string): string {
    const pieces: string[] = StringRatchet.trimToEmpty(domainName).split('.');
    if (pieces.length < 2) {
      ErrorRatchet.throwFormattedErr('Not a valid domain name : %s', domainName);
    }
    return pieces[pieces.length - 2] + '.' + pieces[pieces.length - 1];
  }
}

export interface BucketAndSourceConfiguration {
  bucket: Bucket;
  sourceConfig: SourceConfiguration;
}
