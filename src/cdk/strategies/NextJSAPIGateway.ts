import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as path from 'path';
import {
  Role,
  ManagedPolicy,
  ServicePrincipal,
  CompositePrincipal,
} from '@aws-cdk/aws-iam';

import { Props } from '../props';
export * from '../props';

import { NextJSConstruct } from './NextJSConstruct';
import { LambdaHandler } from '../../common';

export class NextJSAPIGateway extends NextJSConstruct {
  public restAPI: apigateway.RestApi;
  public distribution: cloudfront.Distribution;

  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const namespace = props.namespace;
    const bucket = this.createAssetsBucket(namespace);
    const isISR = this.hasDynamicISRPages() || this.hasISRPages();

    if (isISR) {
      this.createRegenerationSqsAndLambda(namespace);
    }

    const lambdaRole = new Role(this, 'NextEdgeLambdaRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
      ),
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'NextLambdaPolicy',
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const lambdaName = `${namespace}-nextjs-apigw-lambda`;

    this.defaultNextLambda = new lambda.Function(this, lambdaName, {
      functionName: lambdaName,
      description: `Default Lambda for NextJS`,
      handler: 'index.handler',
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY, // destroy old versions
      },
      logRetention: logs.RetentionDays.THREE_DAYS,
      code: lambda.Code.fromAsset(
        path.join(this.props.nextjsCDKBuildOutDir, LambdaHandler.DEFAULT),
      ),
      role: lambdaRole,
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        BUCKET_REGION: region,
      },
    });

    bucket.grantReadWrite(this.defaultNextLambda);
    this.defaultNextLambda.currentVersion.addAlias('live');

    if (isISR && this.regenerationFunction && this.regenerationQueue) {
      bucket.grantReadWrite(this.regenerationFunction);
      this.regenerationQueue.grantSendMessages(this.defaultNextLambda);
      this.regenerationFunction.grantInvoke(this.defaultNextLambda);
    }

    if (this.imageManifest) {
      this.createImageLambda(lambdaRole);
    }

    this.restAPI = new apigateway.LambdaRestApi(this, 'NextAPIGateway', {
      handler: this.defaultNextLambda,
      proxy: true,
      binaryMediaTypes: ['*/*'],
      defaultMethodOptions: {
        methodResponses: [],
      },
    });

    const { nextLambdaCachePolicy, staticCachePolicy } =
      this.getDefaultCachePolicies(namespace);

    const restApiDomainName = `${this.restAPI.restApiId}.execute-api.${region}.amazonaws.com`;

    const defaultOrigin = new origins.HttpOrigin(restApiDomainName, {
      originPath: `/${this.restAPI.deploymentStage.stageName}`,
      originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
    });

    const s3Origin = new origins.S3Origin(bucket);

    this.distribution = new cloudfront.Distribution(
      this,
      'NextJSDistribution',
      {
        defaultRootObject: '',
        defaultBehavior: {
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          origin: defaultOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          compress: true,
          cachePolicy: nextLambdaCachePolicy,
        },
        additionalBehaviors: {
          [this.pathPattern('_next/static/*')]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: s3Origin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: staticCachePolicy,
          },
          [this.pathPattern('static/*')]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: s3Origin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: staticCachePolicy,
          },
        },
      },
    );

    this.uploadNextJSAssets();
  }
}
