import { normalise } from './basepath';
import { dropLocaleFromPath } from './locale';
import { matchDynamic } from '../match';
import { getRewritePath, isExternalRewrite } from './rewrite';
import {
  ApiManifest,
  ApiRoute,
  ExternalRoute,
  RoutesManifest,
  Request,
} from '../../../types';
import { logger } from '../../../common';

export const handleApiReq = (
  req: Request,
  uri: string,
  manifest: ApiManifest,
  routesManifest: RoutesManifest,
  isRewrite?: boolean,
): ExternalRoute | ApiRoute | undefined => {
  logger.debug(`handling api request`);

  const { apis } = manifest;
  const { normalisedUri, missingExpectedBasePath } = normalise(
    uri,
    routesManifest,
  );

  if (!missingExpectedBasePath) {
    // @ts-ignore: manifest is actually a PageManifest cast to an ApiManifest
    const namespace = manifest.namespace;
    const nonDynamic = apis.nonDynamic[normalisedUri.replace(namespace, '')];
    if (nonDynamic) {
      return {
        isApi: true,
        page: nonDynamic,
      };
    }
  }

  const rewrite = !isRewrite && getRewritePath(req, uri, routesManifest);
  if (rewrite) {
    // Rewrites include locales even for api routes
    const apiRewrite = dropLocaleFromPath(rewrite, routesManifest);
    const [path, querystring] = apiRewrite.split('?');
    if (isExternalRewrite(path)) {
      return {
        isExternal: true,
        path,
        querystring,
      };
    }
    const route = handleApiReq(req, path, manifest, routesManifest, true);
    if (route) {
      return {
        ...route,
        querystring,
      };
    }
    return route;
  }

  if (!missingExpectedBasePath) {
    const dynamic = matchDynamic(normalisedUri, apis.dynamic);
    if (dynamic) {
      return {
        isApi: true,
        page: dynamic,
      };
    }
  }
};
