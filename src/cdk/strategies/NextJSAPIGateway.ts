import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaEventSources from '@aws-cdk/aws-lambda-event-sources';
import * as s3 from '@aws-cdk/aws-s3';
import * as s3Deploy from '@aws-cdk/aws-s3-deployment';
import * as sqs from '@aws-cdk/aws-sqs';
import * as logs from '@aws-cdk/aws-logs';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  Role,
  ManagedPolicy,
  ServicePrincipal,
  CompositePrincipal,
} from '@aws-cdk/aws-iam';

import {
  PreRenderedManifest,
  ImageBuildManifest,
  BuildManifest,
  RoutesManifest,
} from '../../types';
import { Props } from '../props';
export * from '../props';

import {
  readAssetsDirectory,
  reduceInvalidationPaths,
  readInvalidationPathsFromManifest,
} from '../utils';
import { pathToPosix } from '../../build/lib';
import { LambdaHandler } from '../../common';

export class NextJSAPIGateway extends cdk.Construct {
  private defaultManifest: BuildManifest;
  private prerenderManifest: PreRenderedManifest;
  private imageManifest: ImageBuildManifest | null;
  private routesManifest: RoutesManifest | null;

  public bucket: s3.Bucket;
  public regenerationQueue?: sqs.Queue;
  public regenerationFunction?: lambda.Function;
  public defaultNextLambda: lambda.Function;
  public nextImageLambda: lambda.Function | null;
  public edgeLambdaRole: Role;
  public restAPI: apigateway.RestApi;
  public nextStaticsCachePolicy: cloudfront.CachePolicy;
  public nextImageCachePolicy: cloudfront.CachePolicy;
  public nextLambdaCachePolicy: cloudfront.CachePolicy;
  public distribution: cloudfront.Distribution;

  constructor(scope: cdk.Construct, id: string, private props: Props) {
    super(scope, id);
    this.routesManifest = this.readRoutesManifest();
    this.prerenderManifest = this.readPrerenderManifest();
    this.imageManifest = this.readImageBuildManifest();
    this.defaultManifest = this.readDefaultBuildManifest();

    const region = cdk.Stack.of(this).region;

    this.bucket = new s3.Bucket(this, 'PublicAssets', {
      publicReadAccess: false, // CloudFront/Lambdas are granted access so we don't want it publicly available

      // Given this resource is created internally and also should only contain
      // assets uploaded by this library we should be able to safely delete all
      // contents along with the bucket its self upon stack deletion.
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const hasISRPages = Object.keys(this.prerenderManifest.routes).some(
      (key) =>
        typeof this.prerenderManifest.routes[key].initialRevalidateSeconds ===
        'number',
    );

    const hasDynamicISRPages = Object.keys(
      this.prerenderManifest.dynamicRoutes,
    ).some(
      (key) => this.prerenderManifest.dynamicRoutes[key].fallback !== false,
    );

    if (hasISRPages || hasDynamicISRPages) {
      this.regenerationQueue = new sqs.Queue(this, 'RegenerationQueue', {
        // We call the queue the same name as the bucket so that we can easily
        // reference it from within the Lambda, given we can't use env vars
        // in a lambda
        queueName: `${this.bucket.bucketName}.fifo`,
        fifo: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      this.regenerationFunction = new lambda.Function(
        this,
        'RegenerationFunction',
        {
          handler: 'index.handler',
          runtime: lambda.Runtime.NODEJS_14_X,
          timeout: Duration.seconds(30),
          code: lambda.Code.fromAsset(
            path.join(this.props.nextjsCDKBuildOutDir, LambdaHandler.DEFAULT),
          ),
        },
      );

      this.regenerationFunction.addEventSource(
        new lambdaEventSources.SqsEventSource(this.regenerationQueue),
      );
    }

    this.edgeLambdaRole = new Role(this, 'NextEdgeLambdaRole', {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
        new ServicePrincipal('edgelambda.amazonaws.com'),
      ),
      managedPolicies: [
        ManagedPolicy.fromManagedPolicyArn(
          this,
          'NextApiLambdaPolicy',
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    this.defaultNextLambda = new lambda.Function(this, 'NextLambda', {
      functionName: 'DefaultLambda',
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
        BUCKET_REGION: region,
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
      this.nextImageLambda = new lambda.Function(this, 'NextImageLambda', {
        functionName: 'ImageLambda',
        description: `Default Lambda for Next Image services`,
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

    this.restAPI = new apigateway.LambdaRestApi(this, 'NextAPIGateway', {
      handler: this.defaultNextLambda,
      proxy: true,
      binaryMediaTypes: ['*/*'],
      defaultMethodOptions: {
        methodResponses: [],
      },
    });

    this.nextStaticsCachePolicy = new cloudfront.CachePolicy(
      this,
      'NextStaticsCache',
      {
        cachePolicyName: 'next-statics-cache',
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
      'NextImageCache',
      {
        cachePolicyName: 'next-image-cache',
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
      'NextLambdaCache',
      {
        cachePolicyName: 'next-lambda-cache',
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

    const restApiDomainName = `${this.restAPI.restApiId}.execute-api.${region}.amazonaws.com`;

    const defaultOrigin = new origins.HttpOrigin(restApiDomainName, {
      originPath: `/${this.restAPI.deploymentStage.stageName}`,
      originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
    });

    const s3Origin = new origins.S3Origin(this.bucket);

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
          cachePolicy: this.nextLambdaCachePolicy,
        },
        additionalBehaviors: {
          [this.pathPattern('_next/static/*')]: {
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            origin: s3Origin,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: this.nextStaticsCachePolicy,
          },
          [this.pathPattern('static/*')]: {
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

    const assetsDirectory = path.join(props.nextjsCDKBuildOutDir, 'assets');
    const assets = readAssetsDirectory({ assetsDirectory });

    // This `BucketDeployment` deploys just the BUILD_ID file. We don't actually
    // use the BUILD_ID file at runtime, however in this case we use it as a
    // file to allow us to create an invalidation of all the routes as evaluated
    // in the function `readInvalidationPathsFromManifest`.
    new s3Deploy.BucketDeployment(this, `AssetDeploymentBuildID`, {
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
      new s3Deploy.BucketDeployment(this, `AssetDeployment_${key}`, {
        destinationBucket: this.bucket,
        sources: [s3Deploy.Source.asset(assetPath)],
        cacheControl: [s3Deploy.CacheControl.fromString(cacheControl)],

        // The source contents will be unzipped to and loaded into the S3 bucket
        // at the root '/', we don't want this, we want to maintain the same
        // path on S3 as their local path. Note that this should be a posix path.
        destinationKeyPrefix: pathToPosix(
          path.relative(assetsDirectory, assetPath),
        ),

        // Source directories are uploaded with `--sync` this means that any
        // files that don't exist in the source directory, but do in the S3
        // bucket, will be removed.
        prune: true,
      });
    });
  }

  private pathPattern(pattern: string): string {
    const { basePath } = this.routesManifest || {};
    return basePath && basePath.length > 0
      ? `${basePath.slice(1)}/${pattern}`
      : pattern;
  }

  private readRoutesManifest(): RoutesManifest {
    return fs.readJSONSync(
      path.join(
        this.props.nextjsCDKBuildOutDir,
        LambdaHandler.DEFAULT + '/routes-manifest.json',
      ),
    );
  }

  private readPrerenderManifest(): PreRenderedManifest {
    return fs.readJSONSync(
      path.join(
        this.props.nextjsCDKBuildOutDir,
        LambdaHandler.DEFAULT + '/prerender-manifest.json',
      ),
    );
  }

  private readDefaultBuildManifest(): BuildManifest {
    return fs.readJSONSync(
      path.join(
        this.props.nextjsCDKBuildOutDir,
        LambdaHandler.DEFAULT + '/manifest.json',
      ),
    );
  }

  private readImageBuildManifest(): ImageBuildManifest | null {
    const imageLambdaPath = path.join(
      this.props.nextjsCDKBuildOutDir,
      LambdaHandler.IMAGE + '/manifest.json',
    );

    return fs.existsSync(imageLambdaPath)
      ? fs.readJSONSync(imageLambdaPath)
      : null;
  }
}
