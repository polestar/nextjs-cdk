import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
import * as logs from '@aws-cdk/aws-logs';
import { Duration, RemovalPolicy } from '@aws-cdk/core';
import * as s3Deploy from '@aws-cdk/aws-s3-deployment';
import * as lambdaEventSources from '@aws-cdk/aws-lambda-event-sources';
import { Role } from '@aws-cdk/aws-iam';
import fs from 'fs-extra';
import path from 'path';

import { Props } from '.';
import {
  PreRenderedManifest,
  ImageBuildManifest,
  BuildManifest,
  RoutesManifest,
} from '../../types';
import {
  readAssetsDirectory,
  reduceInvalidationPaths,
  readInvalidationPathsFromManifest,
} from '../utils';
import { pathToPosix } from '../../build';
import { Distribution } from '@aws-cdk/aws-cloudfront';

export class NextJSConstruct extends cdk.Construct {
  protected defaultManifest: BuildManifest;
  protected prerenderManifest: PreRenderedManifest;
  protected imageManifest: ImageBuildManifest | null;
  protected routesManifest: RoutesManifest | null;
  protected regenerationQueue?: sqs.Queue;
  protected regenerationFunction?: lambda.Function;
  protected scope: cdk.Construct;
  protected bucket?: s3.Bucket;
  protected defaultNextLambda?: lambda.Function;
  protected region: string;
  public distribution?: Distribution;

  constructor(scope: cdk.Construct, id: string, protected props: Props) {
    super(scope, id);

    this.scope = scope;
    this.region = cdk.Stack.of(this).region;
    this.routesManifest = this.readRoutesManifest();
    this.prerenderManifest = this.readPrerenderManifest();
    this.imageManifest = this.readImageBuildManifest();
    this.defaultManifest = this.readDefaultBuildManifest();
  }

  protected createAssetsBucket(id: string) {
    this.bucket = new s3.Bucket(this.scope, id, {
      publicReadAccess: false, // CloudFront/Lambdas are granted access so we don't want it publicly available

      // Given this resource is created internally and also should only contain
      // assets uploaded by this library we should be able to safely delete all
      // contents along with the bucket its self upon stack deletion.
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    return this.bucket;
  }

  protected createRegenerationSqsAndLambda(id: string) {
    if (!this.bucket) {
      throw Error('a bucket must be configured before an sqs may be created');
    }

    this.regenerationQueue = new sqs.Queue(this, id, {
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
          path.join(this.props.nextjsCDKBuildOutDir, 'default-lambda'),
        ),
      },
    );

    this.regenerationFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.regenerationQueue),
    );
  }

  protected uploadNextAssets() {
    if (!this.bucket || !this.distribution) return;

    const destinationBucket = this.bucket;

    const assetsDirectory = path.join(
      this.props.nextjsCDKBuildOutDir,
      'assets',
    );
    const assets = readAssetsDirectory({ assetsDirectory });

    // This `BucketDeployment` deploys just the BUILD_ID file. We don't actually
    // use the BUILD_ID file at runtime, however in this case we use it as a
    // file to allow us to create an invalidation of all the routes as evaluated
    // in the function `readInvalidationPathsFromManifest`.
    new s3Deploy.BucketDeployment(this, `AssetDeploymentBuildID`, {
      destinationBucket,
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
        destinationBucket,
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

  protected hasISRPages() {
    return Object.keys(this.prerenderManifest.routes).some(
      (key) =>
        typeof this.prerenderManifest.routes[key].initialRevalidateSeconds ===
        'number',
    );
  }

  protected hasDynamicISRPages() {
    return Object.keys(this.prerenderManifest.dynamicRoutes).some(
      (key) => this.prerenderManifest.dynamicRoutes[key].fallback !== false,
    );
  }

  protected pathPattern(pattern: string): string {
    const { basePath } = this.routesManifest || {};

    return basePath && basePath.length > 0
      ? `${basePath.slice(1)}/${pattern}`
      : pattern;
  }

  protected readRoutesManifest(): RoutesManifest {
    return fs.readJSONSync(
      path.join(
        this.props.nextjsCDKBuildOutDir,
        'default-lambda/routes-manifest.json',
      ),
    );
  }

  protected readPrerenderManifest(): PreRenderedManifest {
    return fs.readJSONSync(
      path.join(
        this.props.nextjsCDKBuildOutDir,
        'default-lambda/prerender-manifest.json',
      ),
    );
  }

  protected readDefaultBuildManifest(): BuildManifest {
    return fs.readJSONSync(
      path.join(
        this.props.nextjsCDKBuildOutDir,
        'default-lambda/manifest.json',
      ),
    );
  }

  protected readImageBuildManifest(): ImageBuildManifest | null {
    const imageLambdaPath = path.join(
      this.props.nextjsCDKBuildOutDir,
      'image-lambda/manifest.json',
    );

    return fs.existsSync(imageLambdaPath)
      ? fs.readJSONSync(imageLambdaPath)
      : null;
  }
}
