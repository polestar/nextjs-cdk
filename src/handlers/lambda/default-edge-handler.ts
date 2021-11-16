import { CloudFrontRequestHandler, CloudFrontRequestResult } from 'aws-lambda';
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
  try {
    const cloudFrontEvent = event.Records[0].cf;
    const { req, res, responsePromise } = cloudFrontAdapter(cloudFrontEvent);
    const customHeaders = cloudFrontEvent.request.origin?.s3?.customHeaders;

    if (!customHeaders) {
      throw new Error("can't find custom headers on request.origin.s3");
    }

    const bucketHeader = customHeaders['x-aws-bucket'][0];
    const regionHeader = customHeaders['x-aws-region'][0];

    const bucketName = bucketHeader.value;
    const bucketRegion = regionHeader.value;

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
  } catch (err) {
    const cloudFrontResult: CloudFrontRequestResult = {
      status: '500',
      body: 'failed to exectute lambda@edge ' + JSON.stringify(err),
    };

    return cloudFrontResult;
  }
};
