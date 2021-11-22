import { CompositePrincipal, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import { RemovalPolicy } from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import path from 'path';

import { NextJSConstruct } from './NextJSConstruct';
import { Props } from '../props';
import { CustomHeaders, LambdaHandler } from '../../common';

export class NextJSAtEdge extends NextJSConstruct {
  protected edgeLambdaRole?: Role;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props);

    const { namespace } = props;
    const assetsBucket = this.createAssetsBucket(namespace);
    const isISR = this.hasISRPages() || this.hasDynamicISRPages();

    if (isISR) {
      this.createRegenerationSqsAndLambda(namespace);
    }

    const role = this.createEdgeRole(namespace);
    const edgeLambda = this.createEdgeLambda(namespace, role);

    assetsBucket.grantReadWrite(edgeLambda);
    edgeLambda.currentVersion.addAlias('live');

    if (isISR && this.regenerationFunction && this.regenerationQueue) {
      assetsBucket.grantReadWrite(this.regenerationFunction);
      this.regenerationQueue.grantSendMessages(edgeLambda);
      this.regenerationFunction.grantInvoke(edgeLambda);
    }

    this.createEdgeDistribution(namespace);
    this.uploadNextJSAssets();

    // cache policies (next, static, lambda)
    // DNS / domain / cloudfront + s3 origin
  }

  protected createEdgeLambda(namespace: string, role: Role) {
    const id = `${namespace}-nextjs-edge-lambda`;

    this.defaultNextLambda = new lambda.Function(this, id, {
      functionName: id,
      description: 'Handles nextjs edge requests',
      handler: 'index.handler',
      currentVersionOptions: {
        // lambdas must be manually removed after destroy, since edge versions will be dangling.
        removalPolicy: RemovalPolicy.RETAIN,
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

  private createEdgeRole(namespace: string) {
    this.edgeLambdaRole = new Role(
      this,
      `${namespace}-nextjs-edge-execution-role`,
      {
        assumedBy: new CompositePrincipal(
          new ServicePrincipal('lambda.amazonaws.com'),
          new ServicePrincipal('edgelambda.amazonaws.com'),
        ),
      },
    );

    return this.edgeLambdaRole;
  }

  private createEdgeDistribution(namespace: string) {
    if (!this.bucket || !this.defaultNextLambda) return;

    this.bucket.grantRead(
      new cloudfront.OriginAccessIdentity(this, `${namespace}-cdn-bucket-read`),
    );

    const bucketOrigin = new origins.S3Origin(this.bucket, {
      customHeaders: {
        [CustomHeaders.BUCKET_S3_HEADER]: this.bucket.bucketName,
        [CustomHeaders.REGION_HEADER]: 'us-east-1',
      },
    });

    this.distribution = new cloudfront.Distribution(
      this,
      `${namespace}-nextjs-distribution-edge`,
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
          [this.pathPattern('_next/static/*')]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: bucketOrigin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
          },
          [this.pathPattern('static/*')]: {
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
    this.distribution.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
  }
}
