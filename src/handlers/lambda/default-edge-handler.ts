import { CloudFrontRequestHandler } from 'aws-lambda';
import { ServerResponse } from 'http';

// @ts-ignore
import PrerenderManifest from './prerender-manifest.json';
// @ts-ignore
import Manifest from './manifest.json';
// @ts-ignore
import RoutesManifestJson from './routes-manifest.json';

import { defaultHandler } from '../core';
import { cloudFrontAdapter } from './adapters';
import {
  BuildManifest,
  PreRenderedManifest as PrerenderManifestType,
  RoutesManifest,
} from '../../types';
import { AwsPlatformClient } from '../../common';

const manifest: BuildManifest = Manifest;
const prerenderManifest: PrerenderManifestType = PrerenderManifest;
const routesManifest: RoutesManifest = RoutesManifestJson;

export const handler: CloudFrontRequestHandler = async (event) => {
  const { req, res, responsePromise } = cloudFrontAdapter(event.Records[0].cf);

  const bucketName = 'next-app-stack-demoedgebucket1ffe6a6a-1gikrma7wt7sj'; // manifest.bucketName ?? process.env.BUCKET_NAME;
  const bucketRegion = 'us-east-1'; // manifest.bucketRegion ?? process.env.BUCKET_REGION;
  const regenerationQueueRegion = manifest.queueRegion;
  const regenerationQueueName = manifest.queueName;
  const awsPlatformClient = new AwsPlatformClient(
    bucketName,
    bucketRegion,
    regenerationQueueName,
    regenerationQueueRegion,
  );
  const serverResponse = res as unknown as ServerResponse;

  await defaultHandler({
    req,
    res: serverResponse,
    responsePromise,
    manifest,
    prerenderManifest,
    routesManifest,
    options: { logExecutionTimes: false },
    platformClient: awsPlatformClient,
  });

  return await responsePromise;
};
