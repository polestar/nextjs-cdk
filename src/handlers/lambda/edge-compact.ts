import {
  CloudFrontEvent,
  CloudFrontHeaders,
  CloudFrontRequest,
  CloudFrontRequestResult,
} from 'aws-lambda';
import Stream from 'stream';
import zlib from 'zlib';
import http from 'http';

const specialNodeHeaders = [
  'age',
  'authorization',
  'content-length',
  'content-type',
  'etag',
  'expires',
  'from',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'max-forwards',
  'proxy-authorization',
  'referer',
  'retry-after',
  'user-agent',
];

const readOnlyCloudFrontHeaders = {
  'accept-encoding': true,
  'content-length': true,
  'if-modified-since': true,
  'if-none-match': true,
  'if-range': true,
  'if-unmodified-since': true,
  'transfer-encoding': true,
  'via': true,
};

const HttpStatusCodes = {
  202: 'Accepted',
  502: 'Bad Gateway',
  400: 'Bad Request',
  409: 'Conflict',
  100: 'Continue',
  201: 'Created',
  417: 'Expectation Failed',
  424: 'Failed Dependency',
  403: 'Forbidden',
  504: 'Gateway Timeout',
  410: 'Gone',
  505: 'HTTP Version Not Supported',
  418: "I'm a teapot",
  419: 'Insufficient Space on Resource',
  507: 'Insufficient Storage',
  500: 'Server Error',
  411: 'Length Required',
  423: 'Locked',
  420: 'Method Failure',
  405: 'Method Not Allowed',
  301: 'Moved Permanently',
  302: 'Moved Temporarily',
  207: 'Multi-Status',
  300: 'Multiple Choices',
  511: 'Network Authentication Required',
  204: 'No Content',
  203: 'Non Authoritative Information',
  406: 'Not Acceptable',
  404: 'Not Found',
  501: 'Not Implemented',
  304: 'Not Modified',
  200: 'OK',
  206: 'Partial Content',
  402: 'Payment Required',
  308: 'Permanent Redirect',
  412: 'Precondition Failed',
  428: 'Precondition Required',
  102: 'Processing',
  407: 'Proxy Authentication Required',
  431: 'Request Header Fields Too Large',
  408: 'Request Timeout',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Long',
  416: 'Requested Range Not Satisfiable',
  205: 'Reset Content',
  303: 'See Other',
  503: 'Service Unavailable',
  101: 'Switching Protocols',
  307: 'Temporary Redirect',
  429: 'Too Many Requests',
  401: 'Unauthorized',
  422: 'Unprocessable Entity',
  415: 'Unsupported Media Type',
  305: 'Use Proxy',
};

type CFHeader = {
  key?: string | undefined;
  value: string;
}[];

const toCloudFrontHeaders = (headers: Record<string, string | string[]>) => {
  const result: Record<string, CFHeader> = {};

  Object.entries(headers).forEach(([headerName, headerValue]) => {
    const headerKey = headerName.toLowerCase();

    // @ts-ignore
    if (readOnlyCloudFrontHeaders[headerKey]) {
      return;
    }

    if (headerValue) {
      result[headerKey] = [];

      if (headerValue instanceof Array) {
        headerValue.forEach((val) => {
          if (val) {
            result[headerKey].push({
              key: headerName,
              value: val.toString(),
            });
          }
        });
      } else {
        if (headerValue) {
          result[headerKey].push({
            key: headerName,
            value: headerValue.toString(),
          });
        }
      }
    }
  });

  return result;
};

const isGzipSupported = (headers: CloudFrontHeaders) => {
  let gz = false;

  const ae = headers['accept-encoding'];

  if (ae) {
    for (let i = 0; i < ae.length; i++) {
      const { value } = ae[i];
      const bits = value.split(',').map((x) => x.split(';')[0].trim());

      if (bits.indexOf('gzip') !== -1) {
        gz = true;
      }
    }
  }

  return gz;
};

const defaultOptions = {
  enableHTTPCompression: false,
  rewrittenUri: '',
};
type CloudFrontEventRequest = CloudFrontEvent & {
  request: CloudFrontRequest;
};

const handler = (
  event: CloudFrontEventRequest,
  { enableHTTPCompression, rewrittenUri } = defaultOptions,
) => {
  const { request: cfRequest } = event;
  const response: CloudFrontRequestResult = {
    headers: {},
    status: '200',
  };
  const newStream = new Stream.Readable();
  const req = Object.assign(newStream, http.IncomingMessage.prototype);

  req.url = rewrittenUri || cfRequest.uri;
  req.method = cfRequest.method;
  req.rawHeaders = [];
  req.headers = {};
  // req.connection = {};

  if (cfRequest.querystring) {
    req.url = req.url + `?` + cfRequest.querystring;
  }

  const headers = cfRequest.headers || {};

  for (const lowercaseKey of Object.keys(headers)) {
    const headerKeyValPairs = headers[lowercaseKey];

    headerKeyValPairs.forEach((keyVal) => {
      if (!keyVal.key) return;

      req.rawHeaders.push(keyVal.key);
      req.rawHeaders.push(keyVal.value);
    });

    req.headers[lowercaseKey] = headerKeyValPairs[0].value;
  }

  // @ts-ignore
  req.getHeader = (name: string) => {
    return req.headers[name.toLowerCase()];
  };

  // @ts-ignore
  req.getHeaders = () => {
    return req.headers;
  };

  if (cfRequest.body && cfRequest.body.data) {
    req.push(
      cfRequest.body.data,
      cfRequest.body.encoding ? 'base64' : undefined,
    );
  }

  req.push(null);

  const res = createStreamableServerResponse();

  Object.defineProperty(res, 'statusCode', {
    get() {
      return response.status;
    },
    set(statusCode) {
      response.status = statusCode.toString();
      // @ts-ignore
      response.statusDescription = HttpStatusCodes[statusCode];
    },
  });

  let responseBuffer: Buffer;

  res.writeHead = (status, headers) => {
    console.log(headers);

    response.status = status.toString();
    // @ts-ignore
    response.statusDescription = HttpStatusCodes[status];

    if (headers) {
      res.headers = Object.assign(res.headers, headers);
    }
    return res;
  };

  res.write = (chunk) => {
    if (!responseBuffer) {
      responseBuffer = Buffer.from('');
    }

    responseBuffer = Buffer.concat([
      responseBuffer,
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    ]);
  };

  const shouldGzip = enableHTTPCompression && isGzipSupported(headers);

  const responsePromise = new Promise<CloudFrontRequestResult>((resolve) => {
    res.end = (text) => {
      if (res.finished === true) {
        return;
      }

      res.finished = true;

      if (text) res.write(text);

      if (!res.statusCode) {
        res.statusCode = 200;
      }

      if (responseBuffer) {
        response.bodyEncoding = 'base64';
        response.body = shouldGzip
          ? zlib.gzipSync(responseBuffer).toString('base64')
          : Buffer.from(responseBuffer).toString('base64');
      }

      response.headers = toCloudFrontHeaders(res.headers);

      if (shouldGzip) {
        response.headers['content-encoding'] = [
          { key: 'Content-Encoding', value: 'gzip' },
        ];
      }
      resolve(response);
    };
  });

  return {
    req,
    res,
    responsePromise,
  };
};

type StreamResponse = Stream & {
  headers: Record<string, string>;
  writeHead(status: number, headers: any): void;
  finished: boolean;
  write(chunk: ArrayBuffer): void;
  end(chunk: ArrayBuffer): void;
  statusCode: number;
  setHeader(name: string, value: string): void;
  getHeaders(): Record<string, string>;
  getHeader(name: string): string;
  hasHeader(name: string): boolean;
  removeHeader(name: string): void;
};

const createStreamableServerResponse = (): StreamResponse => {
  const res = new Stream() as StreamResponse;

  res.setHeader = (name: string, value: string) => {
    res.headers[name.toLowerCase()] = value;
  };

  res.removeHeader = (name: string) => {
    delete res.headers[name.toLowerCase()];
  };

  res.getHeader = (name: string) => {
    return res.headers[name.toLowerCase()];
  };

  res.getHeaders = () => {
    return res.headers;
  };

  res.hasHeader = (name: string) => {
    return !!res.getHeader(name);
  };

  res.finished = false;
  res.headers = {};

  return res;
};

export const SPECIAL_NODE_HEADERS = specialNodeHeaders;

export default handler;
