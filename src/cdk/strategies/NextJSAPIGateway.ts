import * as path from 'path';

import * as cdk from '@aws-cdk/core';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3Deploy from '@aws-cdk/aws-s3-deployment';
import * as logs from '@aws-cdk/aws-logs';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import {
  Role,
  ManagedPolicy,
  ServicePrincipal,
  CompositePrincipal,
} from '@aws-cdk/aws-iam';
import { logger } from '../../common';

import { Props } from '../props';
export * from '../props';
import { LambdaHandler } from '../../common';

import {
  readAssetsDirectory,
  reduceInvalidationPaths,
  readInvalidationPathsFromManifest,
} from '../utils';
import { pathToPosix } from '../../build/lib';
import { NextJSConstruct } from './NextJSConstruct';
import { EndpointType } from '@aws-cdk/aws-apigateway';

export class NextJSAPIGateway extends NextJSConstruct {
  public restAPI: apigateway.RestApi;
  public nextStaticsCachePolicy?: cloudfront.CachePolicy;
  public nextImageCachePolicy?: cloudfront.CachePolicy;
  public nextLambdaCachePolicy?: cloudfront.CachePolicy;
  public distribution: cloudfront.Distribution;
  public edgeLambdaRole?: Role;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props);
    this.routesManifest = this.readRoutesManifest();
    this.prerenderManifest = this.readPrerenderManifest();
    this.imageManifest = this.readImageBuildManifest();
    this.defaultManifest = this.readDefaultBuildManifest();

    const hasISRPages = this.hasISRPages();
    const hasDynamicISRPages = this.hasDynamicISRPages();

    if (hasISRPages || hasDynamicISRPages) {
      this.createRegenerationQueue(`regeneration-queue-${id}`);
      this.createRegenerationLambda(`regeneration-lambda-${id}`);
    }

    this.edgeLambdaRole = new Role(this, `next-lambda-role-${id}`, {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
      ),
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(
          this,
          `next-lambda-policy-${id}`,
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    this.defaultNextLambda = new lambda.Function(this, `default-lambda-${id}`, {
      functionName: `default-lambda-${id}`,
      description: `Default Lambda for NextJS`,
      handler: 'index.handler',
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY, // destroy old versions
      },
      logRetention: logs.RetentionDays.THREE_DAYS,
      code: lambda.Code.fromAsset(
        path.join(this.props.nextjsCDKBuildOutDir, LambdaHandler.DEFAULT),
      ),
      role: this.edgeLambdaRole,
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        BUCKET_NAME: this.bucket.bucketName,
        BUCKET_REGION: this.region,
      },
    });

    this.bucket.grantReadWrite(this.defaultNextLambda);
    this.defaultNextLambda.currentVersion.addAlias('live');

    if ((hasISRPages || hasDynamicISRPages) && this.regenerationFunction) {
      this.bucket.grantReadWrite(this.regenerationFunction);
      this.regenerationQueue?.grantSendMessages(this.defaultNextLambda);
      this.regenerationFunction?.grantInvoke(this.defaultNextLambda);
    }

    this.nextImageLambda = null;

    if (this.imageManifest) {
      this.nextImageLambda = new lambda.Function(this, `iamge-lambda-${id}`, {
        functionName: `image-lambda-${id}`,
        description: `Lambda for Next Image services`,
        handler: 'index.handler',
        currentVersionOptions: {
          removalPolicy: RemovalPolicy.DESTROY, // destroy old versions
          retryAttempts: 1, // async retry attempts
        },
        logRetention: logs.RetentionDays.THREE_DAYS,
        code: lambda.Code.fromAsset(
          path.join(this.props.nextjsCDKBuildOutDir, LambdaHandler.IMAGE),
        ),
        role: this.edgeLambdaRole,
        runtime: lambda.Runtime.NODEJS_14_X,
        memorySize: 512,
        timeout: Duration.seconds(10),
      });
      this.nextImageLambda.currentVersion.addAlias('live');
    }

    this.restAPI = new apigateway.LambdaRestApi(this, `next-apigateway-${id}`, {
      handler: this.defaultNextLambda,
      proxy: true,
      binaryMediaTypes: ['*/*'],
      defaultMethodOptions: {
        methodResponses: [],
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    if (!this.isChina()) {
      this.nextStaticsCachePolicy = new cloudfront.CachePolicy(
        this,
        `next-statics-cache-${id}`,
        {
          cachePolicyName: `next-statics-cache-${id}`,
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
          headerBehavior: cloudfront.CacheHeaderBehavior.none(),
          cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          defaultTtl: Duration.days(30),
          maxTtl: Duration.days(30),
          minTtl: Duration.days(30),
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
        },
      );

      this.nextImageCachePolicy = new cloudfront.CachePolicy(
        this,
        `next-image-cache-${id}`,
        {
          cachePolicyName: `next-image-cache-${id}`,
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Accept'),
          cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          defaultTtl: Duration.days(1),
          maxTtl: Duration.days(365),
          minTtl: Duration.days(0),
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
        },
      );

      this.nextLambdaCachePolicy = new cloudfront.CachePolicy(
        this,
        `next-lambda-cache-${id}`,
        {
          cachePolicyName: `next-lambda-cache-${id}`,
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          headerBehavior: cloudfront.CacheHeaderBehavior.none(),
          cookieBehavior: {
            behavior: 'all',
          },
          defaultTtl: Duration.seconds(0),
          maxTtl: Duration.days(365),
          minTtl: Duration.seconds(0),
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
        },
      );
    }

    const tld = this.isChina() ? 'com.cn' : 'com';
    const restApiDomainName = `${this.restAPI.restApiId}.execute-api.${this.region}.amazonaws.${tld}`;

    const defaultOrigin = new origins.HttpOrigin(restApiDomainName, {
      originPath: `/${this.restAPI.deploymentStage.stageName}`,
      originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
    });

    const s3Origin = new origins.S3Origin(this.bucket);
    const s3AssetPrefix = this.defaultManifest.namespace.replace('/', '') + '/';

    logger.debug(
      `uploading assets in bucket using assetPrefix: ${s3AssetPrefix}`,
    );

    let fqdn, cert;

    if (props.domain) {
      fqdn = props.domain.fqdn;
    }

    if (props.domain?.certificateArn) {
      cert = acm.Certificate.fromCertificateArn(
        this,
        'dist-certificate',
        props.domain.certificateArn,
      );
    }

    this.distribution = new cloudfront.Distribution(
      this,
      `next-distribution-${id}`,
      {
        certificate: cert,
        domainNames: fqdn,
        defaultRootObject: '',
        enableIpv6: this.isChina() ? false : true,
        defaultBehavior: {
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: defaultOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          compress: true,
          cachePolicy: this.nextLambdaCachePolicy,
        },
        additionalBehaviors: {
          [this.pathPattern(`${s3AssetPrefix}_next/static/*`)]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: s3Origin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: this.nextStaticsCachePolicy,
          },
          [this.pathPattern(`${s3AssetPrefix}static/*`)]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: s3Origin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: this.nextStaticsCachePolicy,
          },
        },
      },
    );

    this.createHostedZone(props.domain);

    if (this.isChina()) {
      const cfnDist = this.distribution.node
        .defaultChild as cloudfront.CfnDistribution;
      cfnDist.addPropertyDeletionOverride(
        'DistributionConfig.DefaultCacheBehavior.CachePolicyId',
      );
      cfnDist.addPropertyOverride(
        'DistributionConfig.DefaultCacheBehavior.ForwardedValues',
        {
          QueryString: false,
        },
      );

      cfnDist.addPropertyDeletionOverride(
        'DistributionConfig.CacheBehaviors.0.CachePolicyId',
      );
      cfnDist.addPropertyOverride(
        'DistributionConfig.CacheBehaviors.0.ForwardedValues',
        {
          QueryString: false,
        },
      );

      cfnDist.addPropertyDeletionOverride(
        'DistributionConfig.CacheBehaviors.1.CachePolicyId',
      );

      cfnDist.addPropertyOverride(
        'DistributionConfig.CacheBehaviors.1.ForwardedValues',
        {
          QueryString: false,
        },
      );
    }

    const assetsDirectory = path.join(props.nextjsCDKBuildOutDir, 'assets');
    const assets = readAssetsDirectory({ assetsDirectory });

    // This `BucketDeployment` deploys just the BUILD_ID file. We don't actually
    // use the BUILD_ID file at runtime, however in this case we use it as a
    // file to allow us to create an invalidation of all the routes as evaluated
    // in the function `readInvalidationPathsFromManifest`.
    new s3Deploy.BucketDeployment(this, `asset-deployment-buildid-${id}`, {
      destinationBucket: this.bucket,
      sources: [
        s3Deploy.Source.asset(assetsDirectory, {
          exclude: ['**', '!BUILD_ID'],
        }),
      ],
      // This will actually cause the file to exist at BUILD_ID, we do this so
      // that the prune will only prune /BUILD_ID/*, rather than all files fromm
      // the root upwards.
      destinationKeyPrefix: '/BUILD_ID',
      distribution: this.distribution,
      distributionPaths: reduceInvalidationPaths(
        readInvalidationPathsFromManifest(this.defaultManifest),
      ),
    });

    Object.keys(assets).forEach((key) => {
      const { path: assetPath, cacheControl } = assets[key];
      const targetPath = pathToPosix(
        path.join(s3AssetPrefix, path.relative(assetsDirectory, assetPath)),
      );

      logger.debug(`will upload ${key} to : ${targetPath}`);

      new s3Deploy.BucketDeployment(this, `asset-deployment-${id}-${key}`, {
        destinationBucket: this.bucket,
        sources: [s3Deploy.Source.asset(assetPath)],
        cacheControl: [s3Deploy.CacheControl.fromString(cacheControl)],

        // The source contents will be unzipped to and loaded into the S3 bucket
        // at the root '/', we don't want this, we want to maintain the same
        // path on S3 as their local path. Note that this should be a posix path.
        destinationKeyPrefix: targetPath,

        // Source directories are uploaded with `--sync` this means that any
        // files that don't exist in the source directory, but do in the S3
        // bucket, will be removed.
        prune: true,
      });
    });
  }
}
