// @ts-ignore
import PrerenderManifest from './prerender-manifest.json';
// @ts-ignore
import Manifest from './manifest.json';
// @ts-ignore
import RoutesManifestJson from './routes-manifest.json';
import { defaultHandler, regenerationHandler } from '../core';
import { AwsPlatformClient } from '../../common';
import {
  BuildManifest,
  PreRenderedManifest as PrerenderManifestType,
  RoutesManifest,
  RegenerationEvent,
  RegenerationEventRequest,
} from '../../types';
import { httpCompat } from './compat';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SQSEvent,
} from 'aws-lambda';
import Stream from 'stream';
import http from 'http';

/**
 * Lambda handler that wraps the platform-agnostic default handler
 * for REST API
 * @param event
 */
export const handleRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const manifest: BuildManifest = Manifest;
  const prerenderManifest: PrerenderManifestType = PrerenderManifest;
  const routesManifest: RoutesManifest = RoutesManifestJson;

  // Compatibility layer required to convert from Node.js req/res <-> API Gateway
  const { req, res, responsePromise } = httpCompat(event);

  // Initialize AWS platform specific client
  // Defaulting to environment variables since it might be run in API Gateway
  const bucketName = manifest.bucketName ?? process.env.BUCKET_NAME;
  const bucketRegion = manifest.bucketRegion ?? process.env.BUCKET_REGION;
  const regenerationQueueRegion = manifest.queueRegion;
  const regenerationQueueName = manifest.queueName;
  const awsPlatformClient = new AwsPlatformClient(
    bucketName,
    bucketRegion,
    regenerationQueueName,
    regenerationQueueRegion,
  );

  // Handle request with platform-agnostic handler
  await defaultHandler({
    req,
    res,
    responsePromise,
    manifest,
    prerenderManifest,
    routesManifest,
    options: {
      logExecutionTimes: manifest.logLambdaExecutionTimes ?? false,
    },
    platformClient: awsPlatformClient,
  });

  // Convert to API Gateway compatible response
  return await responsePromise;
};

/**
 * Lambda handler that wraps the platform-agnostic regeneration handler.
 * @param event
 */
export const handleRegeneration = async (event: SQSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      const regenerationEvent: RegenerationEvent = JSON.parse(record.body);
      const manifest: BuildManifest = Manifest;

      // This is needed to build the original req/res Node.js objects to be passed into pages.
      const originalRequest: RegenerationEventRequest =
        regenerationEvent.request;
      const req = Object.assign(
        new Stream.Readable(),
        http.IncomingMessage.prototype,
      );
      req.url = originalRequest.url; // this already includes query parameters
      req.headers = originalRequest.headers;
      const res = Object.assign(
        new Stream.Readable(),
        http.ServerResponse.prototype,
      );

      // TODO: In the future we may want to have bucket details in a manifest instead of the regen event.
      //  Though it will have to be updated at deploy time since we do not know randomly generated names until deployed unless user set a custom one.
      const awsPlatformClient = new AwsPlatformClient(
        manifest.bucketName,
        manifest.bucketRegion,
        manifest.queueName, // we don't need to call the SQS queue as of now, but passing this for future uses
        manifest.queueRegion,
      );

      await regenerationHandler({
        req,
        res,
        regenerationEvent,
        manifest,
        platformClient: awsPlatformClient,
      });
    }),
  );
};

/**
 * Entry point for Lambda handling - either a request event or SQS event (for regeneration).
 * @param event
 */
export const handler = async (
  event: SQSEvent | APIGatewayProxyEvent,
): Promise<void | APIGatewayProxyResult> => {
  if ((event as SQSEvent).Records) {
    await handleRegeneration(event as SQSEvent);
  } else {
    return await handleRequest(event as APIGatewayProxyEvent);
  }
};
