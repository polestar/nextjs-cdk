import { CompositePrincipal, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import { RemovalPolicy } from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import path from 'path';

import { NextJSConstruct } from '.';
import { Props } from '../props';
import { CustomHeaders, LambdaHandler, logger } from '../../common';

export class NextJSAtEdge extends NextJSConstruct {
  protected edgeLambdaRole?: Role;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props);

    const assetsBucket = this.createAssetsBucket(`public-assets-${id}`);
    const isISR = this.hasISRPages() || this.hasDynamicISRPages();

    if (isISR) {
      this.createRegenerationQueue(`regeneration-queue-${id}`);
      this.createRegenerationLambda(`regeneration-lambda-${id}`);
    }

    const role = this.createEdgeRole(`next-lambda-role-${id}`);
    const edgeLambda = this.createEdgeLambda(
      `default-lambda-${id}`,
      role,
      `default-lambda-${id}`,
      'handles all server-side reqs for nextjs',
    );

    assetsBucket.grantReadWrite(edgeLambda);
    edgeLambda.currentVersion.addAlias('live');

    if (isISR && this.regenerationFunction && this.regenerationQueue) {
      assetsBucket.grantReadWrite(this.regenerationFunction);
      this.regenerationQueue.grantSendMessages(edgeLambda);
      this.regenerationFunction.grantInvoke(edgeLambda);
    }

    this.createEdgeDistribution();
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

  private createEdgeDistribution() {
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

    this.distribution = new cloudfront.Distribution(
      this,
      'NextJSDistributionEdge',
      {
        defaultRootObject: '',
        defaultBehavior: {
          origin: bucketOrigin,
          edgeLambdas: [
            {
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
              functionVersion: this.defaultNextLambda.currentVersion,
            },
          ],
        },
        additionalBehaviors: {
          [this.pathPattern(`${s3AssetPrefix}_next/static/*`)]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: bucketOrigin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
          },
          [this.pathPattern(`${s3AssetPrefix}static/*`)]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: bucketOrigin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
          },
        },
      },
    );
  }
}
