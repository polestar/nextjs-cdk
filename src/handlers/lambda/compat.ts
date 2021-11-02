import { IncomingMessage, ServerResponse } from 'http';
import Query from 'querystring';
import { Stream } from 'stream';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const httpCompat = (
  event: APIGatewayProxyEvent,
): {
  req: IncomingMessage;
  res: ServerResponse;
  responsePromise: Promise<APIGatewayProxyResult>;
} => {
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: '',
    headers: {},
  };

  const newStream = new Stream.Readable();
  const req = Object.assign(newStream, IncomingMessage.prototype) as any;

  // TODO: check if "path" replaces V2 rawPath counterpart
  const { queryStringParameters, path: rawPath } = event;
  const qs = queryStringParameters
    ? Query.stringify(queryStringParameters)
    : '';

  const hasQueryString = qs.length > 0;

  req.url = hasQueryString ? `${rawPath}?${qs}` : rawPath;

  req.method = event.requestContext.httpMethod;
  req.rawHeaders = [];
  req.headers = {};

  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      req.headers[key.toLowerCase()] = value;
    }
  }

  req.getHeader = (name: string) => {
    return req.headers[name.toLowerCase()];
  };
  req.getHeaders = () => {
    return req.headers;
  };
  req.connection = {};

  const res = new Stream() as any;
  Object.defineProperty(res, 'statusCode', {
    get() {
      return response.statusCode;
    },
    set(statusCode) {
      response.statusCode = statusCode;
    },
  });

  const headerNames: { [key: string]: string } = {};
  res.headers = {};
  res.bodyBuffer = Buffer.of();
  res.writeHead = (
    status: number,
    headers: { [key: string]: string | string[] },
  ) => {
    response.statusCode = status;
    res.headers = { ...res.headers, ...headers };
  };

  res.write = (chunk: Buffer | string) => {
    // We need to handle byte arrays
    if (Buffer.isBuffer(chunk)) {
      res.bodyBuffer = Buffer.concat([res.bodyBuffer, chunk]);
    } else {
      if (!response.body) {
        response.body = '';
      }
      response.body = response.body + chunk;
    }
  };
  res.setHeader = (name: string, value: string) => {
    headerNames[name.toLowerCase()] = name;
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

  const onResEnd =
    (resolve: (value: APIGatewayProxyResult) => void) =>
    (chunk: Buffer | string) => {
      if (chunk) {
        res.write(chunk);
      }
      if (!res.statusCode) {
        res.statusCode = 200;
      }

      if (res.bodyBuffer) {
        response.body = res.bodyBuffer.toString('base64');
        response.isBase64Encoded = true;
      } else if (response.body) {
        response.body = Buffer.from(response.body).toString('base64');
        response.isBase64Encoded = true;
      }
      res.writeHead(response.statusCode);

      response.headers = {};
      for (const [key, value] of Object.entries(res.headers) as [
        string,
        string | string[],
      ][]) {
        response.headers[headerNames[key] || key] = Array.isArray(value)
          ? value.join(',')
          : value;
      }

      resolve(response);
    };

  const responsePromise: Promise<APIGatewayProxyResult> = new Promise(
    (resolve) => {
      res.end = onResEnd(resolve);
    },
  );

  if (event.body) {
    req.push(event.body, event.isBase64Encoded ? 'base64' : undefined);
  }

  req.push(null);

  return { req, res, responsePromise };
};
