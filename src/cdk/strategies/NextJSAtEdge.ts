import { CompositePrincipal, Role, ServicePrincipal } from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';

import { NextJSConstruct } from '.';
import { Props } from '../props';

export class NextJSAtEdge extends NextJSConstruct {
  protected edgeLambdaRole?: Role;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props);

    const assetsBucket = this.createAssetsBucket('demo-edge-bucket');
    const isISR = this.hasISRPages() || this.hasDynamicISRPages();

    if (isISR) {
      console.log('isISR -> creating regeneration-queue');
      this.createRegenerationSqsAndLambda('regeneration-queue');
    }

    const role = this.createEdgeRole();
    const defaultLambda = this.createDefaultLambda(
      'default-lambda-demo',
      assetsBucket,
      role,
      'default-lambda-joel-edge-demo',
      'handles all server-side reqs for nextjs',
    );

    assetsBucket.grantReadWrite(defaultLambda);
    defaultLambda.currentVersion.addAlias('live');

    if (isISR && this.regenerationFunction && this.regenerationQueue) {
      console.log('adding rights for regeneration queue');
      assetsBucket.grantReadWrite(this.regenerationFunction);
      this.regenerationQueue.grantSendMessages(defaultLambda);
      this.regenerationFunction.grantInvoke(defaultLambda);
    }

    // at edge entry point
    this.createEdgeDistribution();
    // cache policies (next, static, lambda)
    // DNS / domain / cloudfront + s3 origin
    // Cloudfront dist and match patterns
    // upload assets to bucket
    this.uploadNextAssets();
  }

  private createEdgeRole() {
    this.edgeLambdaRole = new Role(this, 'next-edge-lambda-role', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
        new ServicePrincipal('edgelambda.amazonaws.com'),
      ),
    });

    return this.edgeLambdaRole;
  }

  private createEdgeDistribution() {
    if (!this.bucket || !this.defaultNextLambda) return;

    const myCdnOai = new cloudfront.OriginAccessIdentity(
      this,
      'cdn-bucket-read',
    );
    this.bucket.grantRead(myCdnOai);

    const c = new origins.S3Origin(this.bucket);

    this.distribution = new cloudfront.Distribution(
      this,
      'NextJSDistributionEdge',
      {
        defaultRootObject: '',
        defaultBehavior: {
          origin: c,
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
            origin: c,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
          },
          [this.pathPattern('static/*')]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: c,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
          },
        },
      },
    );
  }
}
