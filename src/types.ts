export type BuildOptions = {
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  cmd?: string;
  buildId?: string;
  domainRedirects?: { [key: string]: string };
  minifyHandlers?: boolean;
  handler?: string;
  authentication?: { username: string; password: string } | undefined;
  baseDir?: string;
  cleanupDotNext?: boolean;
  assetIgnorePatterns?: string[];
  regenerationQueueName?: string;
  bucketName?: string;
  bucketRegion?: string;
  separateApiLambda?: boolean;
  disableOriginResponseHandler?: boolean;
  useV2Handler?: boolean;
};

// Incoming data
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'http';

export type Header = {
  key?: string;
  value: string;
};

export type Headers = {
  [key: string]: Header[];
};

export type Request = {
  headers: Headers;
  querystring?: string;
  uri: string;
};

// Handlers map an Event into a Result

export type Event = {
  req: IncomingMessage;
  res: ServerResponse;
  responsePromise: Promise<any>;
};

// Manifests

export type RedirectData = {
  statusCode: number;
  source: string;
  destination: string;
  internal?: boolean;
};

export type RewriteData = {
  source: string;
  destination: string;
};

export type DynamicRoute = {
  route: string;
  regex: string;
};

export type Dynamic = {
  file: string;
  regex: string;
};

export type DynamicSSG = {
  fallback: false | null | string;
};

export type NonDynamicSSG = {
  initialRevalidateSeconds: false | number;
  srcRoute: string | null;
};

export type Manifest = {
  authentication?: {
    username: string;
    password: string;
  };
  domainRedirects?: {
    [key: string]: string;
  };
  publicFiles?: {
    [key: string]: string;
  };
  trailingSlash?: boolean;
};

export type ApiManifest = Manifest & {
  apis: {
    dynamic: Dynamic[];
    nonDynamic: { [key: string]: string };
  };
};

export type PageManifest = Manifest & {
  buildId: string;
  namespace: string;
  pages: {
    dynamic: DynamicRoute[];
    html: {
      dynamic: { [key: string]: string };
      nonDynamic: { [key: string]: string };
    };
    ssg: {
      dynamic: {
        [key: string]: DynamicSSG;
      };
      nonDynamic: {
        [key: string]: NonDynamicSSG;
      };
      notFound?: {
        [key: string]: true;
      };
    };
    ssr: {
      dynamic: { [key: string]: string };
      nonDynamic: { [key: string]: string };
    };
  };
  publicFiles: {
    [key: string]: string;
  };
  trailingSlash: boolean;
  hasApiPages: boolean;
};

export type HeaderData = {
  source: string;
  headers: Header[];
};

export type DomainData = {
  domain: string;
  defaultLocale: string;
  locales?: string[];
};

export type I18nData = {
  locales: string[];
  defaultLocale: string;
  localeDetection?: boolean;
  domains?: DomainData[];
};

export type RoutesManifest = {
  basePath: string;
  redirects: RedirectData[];
  rewrites: RewriteData[];
  headers: HeaderData[];
  i18n?: I18nData;
};

export type PrerenderManifest = {
  preview: {
    previewModeId: string;
    previewModeSigningKey: string;
    previewModeEncryptionKey: string;
  };
};

// Returned routes

export interface AnyRoute {
  file?: string;
  headers?: Headers;
  querystring?: string;
  statusCode?: number;
  isApi?: boolean;
  isExternal?: boolean;
  isPublicFile?: boolean;
  isNextStaticFile?: boolean;
  isRedirect?: boolean;
  isRender?: boolean;
  isStatic?: boolean;
  isUnauthorized?: boolean;
}

export interface ApiRoute extends AnyRoute {
  isApi: true;
  page: string;
}

export interface ExternalRoute extends AnyRoute {
  isExternal: true;
  path: string;
}

export interface PublicFileRoute extends AnyRoute {
  isPublicFile: true;
  file: string;
}

export interface NextStaticFileRoute extends AnyRoute {
  isNextStaticFile: true;
  file: string;
}

export interface RedirectRoute extends AnyRoute {
  isRedirect: true;
  status: number;
  statusDescription: string;
}

// Render route, like SSR, preview etc.
export interface RenderRoute extends AnyRoute {
  isRender: true;
  isData: boolean;
  page: string;
}

// Static route, whether HTML or SSG (non-preview)
export interface StaticRoute extends AnyRoute {
  isStatic: true;
  isData: boolean;
  file: string;
  page?: string;
  revalidate?: false | number;
  fallback?: false | null | string;
}

export interface UnauthorizedRoute extends AnyRoute {
  isUnauthorized: true;
  status: number;
  statusDescription: string;
  body: string;
}

export type DataRoute = (RenderRoute | StaticRoute) & {
  isData: true;
};

export type PageRoute = (RenderRoute | StaticRoute) & {
  isData: false;
};

export type Route =
  | ExternalRoute
  | PublicFileRoute
  | NextStaticFileRoute
  | RedirectRoute
  | RenderRoute
  | StaticRoute
  | ApiRoute
  | UnauthorizedRoute;

export type PreRenderedManifest = {
  version: 3 | 2;
  routes: {
    [route: string]: {
      initialRevalidateSeconds: number | false;
      srcRoute: string | null;
      dataRoute: string;
    };
  };
  dynamicRoutes: {
    [route: string]: {
      routeRegex: string;
      fallback: string | false;
      dataRoute: string;
      dataRouteRegex: string;
    };
  };
  preview: {
    previewModeId: string;
    previewModeSigningKey: string;
    previewModeEncryptionKey: string;
  };
};

export type PerfLogger = {
  now: () => number | undefined;
  log: (metricDescription: string, t1?: number, t2?: number) => void;
};

export type RegenerationEventRequest = {
  url: string | undefined;
  headers: IncomingHttpHeaders;
};

export type RegenerationEvent = {
  request: RegenerationEventRequest;
  pagePath: string;
  basePath: string;
  pageKey: string;
  storeName: string;
  storeRegion: string;
};

export type ImageBuildManifest = {
  domainRedirects?: {
    [key: string]: string;
  };
};

export type NextConfig = {
  trailingSlash?: boolean;
};

export type RequiredServerFilesFiles = {
  config?: {
    assetPrefix?: string;
  };
};

export type DynamicPageKeyValue = {
  [key: string]: {
    file: string;
    regex: string;
  };
};

// Image optimization
export type ImageConfig = {
  deviceSizes: number[];
  imageSizes: number[];
  loader: 'default' | 'imgix' | 'cloudinary' | 'akamai';
  path: string;
  domains?: string[];
};

export type ImagesManifest = {
  version: number;
  images: ImageConfig;
};

export type BuildManifest = ApiManifest &
  PageManifest & {
    bucketName: string;
    enableHTTPCompression?: boolean;
    logLambdaExecutionTimes?: boolean;
    bucketRegion: string;
    queueName?: string;
    queueRegion?: string;
  };

export type ObjectResponse = {
  body: Buffer | undefined;
  headers: { [key: string]: string | undefined };
  lastModified: string | undefined;
  expires: string | undefined;
  eTag: string | undefined;
  statusCode: number;
  cacheControl: string | undefined;
  contentType: string | undefined;
};

export type StorePageOptions = {
  basePath: string;
  revalidate: number;
  html: string;
  buildId: string;
  pageData: any;
  uri: string;
};

export type TriggerStaticRegenerationOptions = {
  basePath: string;
  eTag: string | undefined;
  lastModified: string | undefined;
  pagePath: string; // path to page to require
  pageKey: string; // object store key
  req: IncomingMessage;
};

/**
 * Platforms should implement this interface which has all methods for retrieving from an object store,
 * storing a page or triggering static regeneration.
 */
export interface PlatformClient {
  /**
   * Get an object from this platform's object store.
   * This can be a page or other file.
   * @param pageKey
   */
  getObject(pageKey: string): Promise<ObjectResponse>;

  /**
   * Trigger static regeneration for this page.
   * @param options
   */
  triggerStaticRegeneration(
    options: TriggerStaticRegenerationOptions,
  ): Promise<{ throttle: boolean }>;

  /**
   * Store a page into the object store - both HTML and JSON data.
   * @param options
   */
  storePage(
    options: StorePageOptions,
  ): Promise<{ cacheControl: string | undefined; expires: Date | undefined }>;
}
