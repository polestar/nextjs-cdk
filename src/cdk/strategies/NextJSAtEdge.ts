import path from 'path';

import { CompositePrincipal, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import { RemovalPolicy } from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';

import { NextJSConstruct } from './NextJSConstruct';
import { Props, Domain } from '../props';
import { CustomHeaders, LambdaHandler, logger } from '../../common';

export class NextJSAtEdge extends NextJSConstruct {
  public edgeLambdaRole?: Role;
  public nextStaticsCachePolicy?: cloudfront.CachePolicy;
  public nextImageCachePolicy?: cloudfront.CachePolicy;
  public nextLambdaCachePolicy?: cloudfront.CachePolicy;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props);

    this.fqdn = props.domain?.fqdn;

    const isISR = this.hasISRPages() || this.hasDynamicISRPages();

    if (isISR) {
      this.createRegenerationQueue(`regeneration-edge-queue-${id}`);
      this.createRegenerationLambda(`regeneration-edge-lambda-${id}`);
    }

    const role = this.createEdgeRole(`next-lambda-role-${id}`);
    const edgeLambda = this.createEdgeLambda(
      `default-edge-lambda-${id}`,
      role,
      `default-edge-lambda-${id}`,
      'handles all server-side reqs for nextjs',
    );

    this.bucket.grantReadWrite(edgeLambda);
    edgeLambda.currentVersion.addAlias('live');

    if (isISR && this.regenerationFunction && this.regenerationQueue) {
      this.bucket.grantReadWrite(this.regenerationFunction);
      this.regenerationQueue.grantSendMessages(edgeLambda);
      this.regenerationFunction.grantInvoke(edgeLambda);
    }

    this.createCert(id, props.domain);
    this.createEdgeDistribution(id, props.domain);
    this.createHostedZone(id, props.domain);
    this.uploadNextAssets();

    // cache policies (next, static, lambda)
    // DNS / domain / cloudfront + s3 origin
    // Cloudfront dist and match patterns
  }

  protected createEdgeLambda(
    id: string,
    role: Role,
    functionName = 'DefaultLambda',
    description = 'Default Lambda edge for NextJS',
  ) {
    this.defaultNextLambda = new lambda.Function(this, id, {
      functionName,
      description,
      handler: 'index.handler',
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      logRetention: logs.RetentionDays.THREE_DAYS,
      code: lambda.Code.fromAsset(
        path.join(this.props.nextjsCDKBuildOutDir, LambdaHandler.EDGE),
      ),
      role,
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
    });

    return this.defaultNextLambda;
  }

  private createEdgeRole(id: string) {
    this.edgeLambdaRole = new Role(this, id, {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
        new ServicePrincipal('edgelambda.amazonaws.com'),
      ),
    });

    return this.edgeLambdaRole;
  }

  private createEdgeDistribution(id: string, domain?: Domain) {
    if (!this.bucket || !this.defaultNextLambda) return;

    this.bucket.grantRead(
      new cloudfront.OriginAccessIdentity(this, 'cdn-bucket-read'),
    );

    const s3AssetPrefix = path.join(this.getNamespace(), '/');
    const bucketOrigin = new origins.S3Origin(this.bucket, {
      customHeaders: {
        [CustomHeaders.BUCKET_S3_HEADER]: this.bucket.bucketName,
        [CustomHeaders.REGION_HEADER]: 'us-east-1',
      },
    });

    logger.debug(
      `uploading assets in bucket using assetPrefix: ${s3AssetPrefix}`,
    );

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

    this.distribution = new cloudfront.Distribution(
      this,
      `next-distribution-${id}`,
      {
        certificate: this.cert,
        domainNames: this.fqdn,
        defaultRootObject: '',
        defaultBehavior: {
          origin: bucketOrigin,
          edgeLambdas: [
            {
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
              functionVersion: this.defaultNextLambda.currentVersion,
            },
          ],
          compress: true,
          cachePolicy: this.nextLambdaCachePolicy,
        },
        additionalBehaviors: {
          [this.pathPattern(`${s3AssetPrefix}_next/static/*`)]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: bucketOrigin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: this.nextStaticsCachePolicy,
          },
          [this.pathPattern(`${s3AssetPrefix}static/*`)]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: bucketOrigin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: this.nextStaticsCachePolicy,
          },
        },
      },
    );
  }
}
