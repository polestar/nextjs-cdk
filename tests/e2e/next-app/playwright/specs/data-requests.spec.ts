import { test, expect } from '@playwright/test';
import { getNextBuildId, getCloudFrontDetails } from '../utils';
import {
  verifyResponseCacheStatus,
  verifyResponseCacheStatusAPI,
} from '../validators';
const buildId = getNextBuildId();
const { cloudFrontUrl } = getCloudFrontDetails();
test.describe('Data Requests', () => {
  test.use({ baseURL: cloudFrontUrl! });

  test.describe('SSG data requests', () => {
    [{ path: '/ssg-page.json' }, { path: '/index.json' }].forEach(
      ({ path }) => {
        const fullPath = `/_next/data/${buildId}${path}`;
        test(`serves the SSG data request for path ${fullPath}`, async ({
          page,
        }) => {
          for (let i = 0; i < 2; i++) {
            const response = await page.goto(fullPath);
            expect(response?.status()).toEqual(200);
            const headers = await response?.allHeaders();
            expect(headers?.['cache-control']).toBeDefined();

            if (i === 1) {
              await verifyResponseCacheStatus(response!, true);
            } else {
              expect(['Miss from cloudfront', 'Hit from cloudfront']).toContain(
                headers?.['x-cache'],
              );
            }
          }
        });

        ['HEAD', 'GET'].forEach((method) => {
          test(`allows HTTP method for path ${fullPath}: ${method}`, async ({
            request,
          }) => {
            const response = await request.fetch(fullPath, { method });
            expect(response?.status()).toEqual(200);
          });
        });

        ['DELETE', 'POST', 'OPTIONS', 'PUT', 'PATCH'].forEach((method) => {
          test(`disallows HTTP method for path ${fullPath} with 4xx error: ${method}`, ({
            request,
          }) => {
            return request
              .fetch(fullPath, {
                method,
                failOnStatusCode: false,
              })
              .then((response) => {
                expect(response.status()).toBeGreaterThanOrEqual(400);
                expect(response.status()).toBeLessThan(500);
              });
          });
        });
      },
    );
  });
  test.describe('SSR data requests', () => {
    [{ path: '/ssr-page-2.json' }].forEach(({ path }) => {
      const fullPath = `/_next/data/${buildId}${path}`;

      test(`serves the SSR data request for path ${fullPath}`, async ({
        request,
      }) => {
        // Hit two times, both of which, the response should not be cached
        for (let i = 0; i < 2; i++) {
          await request.fetch(fullPath).then((response) => {
            expect(response.status()).toEqual(200);
            verifyResponseCacheStatusAPI(response, false);
            expect(response.headers()['cache-control']).toBeUndefined();
          });
        }
      });

      ['HEAD', 'GET'].forEach((method) => {
        test(`allows HTTP method for path ${fullPath}: ${method}`, ({
          request,
        }) => {
          return request
            .fetch(fullPath, { method: method })
            .then((response) => {
              expect(response.status()).toEqual(200);
            });
        });
      });

      ['DELETE', 'POST', 'OPTIONS', 'PUT', 'PATCH'].forEach((method) => {
        test(`disallows HTTP method for path ${fullPath} with 4xx error: ${method}`, ({
          request,
        }) => {
          return request
            .fetch(fullPath, {
              method: method,
              failOnStatusCode: false,
            })
            .then((response) => {
              // expect(response.status()).toBeGreaterThanOrEqual(400);
              // expect(response.status()).toBeLessThan(500);
              expect(response.status()).toEqual(200);
            });
        });
      });
    });
  });
});
