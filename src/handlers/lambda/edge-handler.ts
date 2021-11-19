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
import { AwsPlatformClient, CustomHeaders } from '../../common';

const manifest: BuildManifest = Manifest;
const prerenderManifest: PrerenderManifestType = PrerenderManifest;
const routesManifest: RoutesManifest = RoutesManifestJson;

export { AwsPlatformClient };

export const handler: CloudFrontRequestHandler = async (event) => {
  try {
    const cloudFrontEvent = event.Records[0].cf;
    const customHeaders = cloudFrontEvent.request.origin?.s3?.customHeaders;

    if (!customHeaders) {
      throw new Error("can't find custom headers on request.origin.s3");
    }

    const bucketHeader = customHeaders[CustomHeaders.BUCKET_S3_HEADER][0];
    const regionHeader = customHeaders[CustomHeaders.REGION_HEADER][0];
    const { req, res, responsePromise } = cloudFrontAdapter(cloudFrontEvent);
    const serverResponse = res as unknown as ServerResponse;

    await defaultHandler({
      req,
      res: serverResponse,
      responsePromise,
      manifest,
      prerenderManifest,
      routesManifest,
      options: { logExecutionTimes: false },
      platformClient: new AwsPlatformClient(
        bucketHeader.value,
        regionHeader.value,
        manifest.queueName,
        manifest.queueRegion,
      ),
    });

    return await responsePromise;
  } catch (err) {
    const cloudFrontResult: CloudFrontRequestResult = {
      status: '500',
      body: 'failed to execute lambda@edge ' + err,
    };

    return cloudFrontResult;
  }
};
