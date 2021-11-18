import path from 'path';

const BUILD_PATH = path.resolve('./.nextjs_cdk');
const DEFAULT_EVENT = require('./requests/default.json');

const getObjectMock = (body: string) => {
  return jest.fn(async () => {
    return {
      body: Buffer.from(body),
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=2678400, must-revalidate',
        'Content-Disposition': null,
        'Content-Type': 'text/html',
        'Content-Language': '',
        'Content-Length': 1755,
        'Content-Encoding': 'utf-8',
        'Content-Range': null,
        'ETag': '5e3937111ca0c96611462ae2d5965c18',
        'Accept-Ranges': 'bytes',
      },
      lastModified:
        'Mon Nov 01 2021 10:43:41 GMT+0000 (Coordinated Universal Time)',
      expires: null,
      eTag: '5e3937111ca0c96611462ae2d5965c18',
      cacheControl: 'public, max-age=0, s-maxage=2678400, must-revalidate',
      statusCode: 200,
      contentType: 'text/html',
    };
  });
};

describe('edge-lambda', () => {
  const handlerModule = require(path.join(BUILD_PATH, 'edge-lambda'));

  it('should return index content on GET /', async () => {
    const body =
      '<html><head><title>Test</title></head><body><h1>TEST!</h1></body></html>';
    handlerModule.AwsPlatformClient.prototype.getObject = getObjectMock(body);

    const response = await handlerModule.handler(DEFAULT_EVENT);

    expect(response.statusCode).toBe(200);
    expect(Buffer.from(response.body, 'base64').toString('utf-8')).toEqual(
      body,
    );
  });
});
