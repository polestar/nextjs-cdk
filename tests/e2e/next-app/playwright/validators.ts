import { expect, Response, APIResponse } from '@playwright/test';
import { Response as FetchResponse } from 'node-fetch';
function verifyHeaderCacheStatus(
  headers: { [key: string]: string },
  shouldBeCached: boolean,
) {
  if (shouldBeCached) {
    expect(headers?.['x-cache']).toEqual('Hit from cloudfront');
  } else {
    expect([
      'Miss from cloudfront',
      'LambdaGeneratedResponse from cloudfront',
    ]).toContain(headers?.['x-cache']);
  }
}

export async function verifyResponseCacheStatus(
  response: Response,
  shouldBeCached: boolean,
) {
  const headers = await response?.allHeaders();
  verifyHeaderCacheStatus(headers, shouldBeCached);
}

export function verifyResponseCacheStatusAPI(
  response: APIResponse,
  shouldBeCached: boolean,
) {
  verifyHeaderCacheStatus(response.headers(), shouldBeCached);
}

export function verifyResponseIsCompressed(response: APIResponse) {
  expect(response.headers()['content-encoding']).toMatch(/gzip|br/);
}

export function verifyResponseIsRedirect(
  response: FetchResponse,
  redirectedPath: string,
  fullRedirectedPath: string,
  redirectStatusCode: number,
) {
  expect(response.status).toEqual(redirectStatusCode);
  expect(response.headers.get('location')).toEqual(fullRedirectedPath);
  if (redirectStatusCode === 308) {
    // IE11 compatibility
    expect(response.headers.get('refresh')).toEqual(`0;url=${redirectedPath}`);
  } else {
    expect(response.headers.get('refresh')).toBeNull();
  }
  expect(response.headers.get('cache-control')).toEqual('s-maxage=0');
}
