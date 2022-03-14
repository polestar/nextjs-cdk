import { test, expect } from '@playwright/test';
import { getCloudFrontDetails } from '../utils';
import {
  verifyResponseCacheStatus,
  verifyResponseIsCompressed,
} from '../validators';
const { cloudFrontUrl } = getCloudFrontDetails();

test.describe('Pages Tests', () => {
  test.use({ baseURL: cloudFrontUrl! });

  test.describe('SSR pages (getInitialProps)', () => {
    test.beforeEach(({ page }) => {
      page.on('response', (response) => {
        if (response.status() >= 400) {
          throw new Error(
            `Response has errored with status ${response.status()}`,
          );
        }
      });
    });
    [{ path: '/ssr-page' }].forEach(({ path }) => {
      test(`serves but does not cache page ${path}`, async ({ page }) => {
        const response = await page.goto(path);

        expect(response?.status()).toEqual(200);
        expect(response?.headers()['cache-control']).toBeUndefined();
        expect(page.url()).toMatch(new RegExp(`${path}$`));
      });

      // 'HEAD'
      ['DELETE', 'POST', 'GET', 'OPTIONS', 'PUT', 'PATCH'].forEach((method) => {
        test(`allows HTTP method for path ${path}: ${method}`, ({
          request,
        }) => {
          return request
            .fetch(path, { method: method, failOnStatusCode: false })
            .then((response) => {
              verifyResponseIsCompressed(response);
              expect(response?.headers()['cache-control']).toBeUndefined();
              expect(response.status()).toEqual(200);
            });
        });
      });
    });
  });

  test.describe('SSR pages (getServerSideProps)', () => {
    [{ path: '/ssr-page-2' }].forEach(({ path }) => {
      test(`serves but does not cache page ${path}`, async ({ page }) => {
        await page.route('**', async (route) => {
          const response = await page.request.fetch(route.request());

          if (
            route
              .request()
              .url()
              .match(/^((?!\.js|\.jpeg|\.png|\.jpg).)*$/)
          ) {
            expect(response?.status()).toEqual(200);
            expect(response?.headers()['x-cache']).not.toEqual(
              'Hit from cloudfront',
            );
          }
          route.fulfill({
            response,
          });
        });

        const response = await page.goto(path);

        expect(response?.status()).toEqual(200);
        expect(page.url()).toMatch(new RegExp(`${path}$`));
      });

      ['DELETE', 'POST', 'GET', 'OPTIONS', 'PUT', 'PATCH'].forEach((method) => {
        test(`allows HTTP method for path ${path}: ${method}`, ({
          request,
        }) => {
          return request.fetch(path, { method: method }).then((response) => {
            if (method !== 'HEAD') {
              verifyResponseIsCompressed(response);
            }
            expect(response.status()).toEqual(200);
          });
        });
      });
    });
  });

  test.describe('SSG pages', () => {
    [{ path: '/ssg-page' }, { path: '/' }].forEach(({ path }) => {
      test(`serves and caches page ${path}`, async ({ page }) => {
        await page.goto(path);

        expect(page.url()).toMatch(new RegExp(`${path}$`));

        const response = await page.goto(path);
        expect(response?.headers()['x-cache']).toEqual('Hit from cloudfront');
      });

      // TODO: This test only works in the lambda@edge version
      test.skip(`supports preview mode ${path}`, async ({ context, page }) => {
        await page.goto('/api/preview/enabled');

        // FIXME: Should set two cookies
        // expect(context.cookies.length).toEqual(2);

        await page.goto(path);

        expect(page.url()).toMatch(new RegExp(`${path}$`));
        expect(page.locator('[data-cy=preview-mode]')).toHaveText('true');

        await page.goto('/api/preview/disabled');
        // FIXME: Should delete two cookies
        // expect(context.cookies.length).toEqual(0);

        const response = await page.goto(path);
        expect(page.url()).toMatch(new RegExp(`${path}$`));
        expect(page.locator('[data-cy=preview-mode]')).toHaveText('false');
        expect(response?.headers()['x-cache']).toEqual('Hit from cloudfront');
      });

      // 'HEAD' seems to be broken in playwright
      ['GET'].forEach((method) => {
        test(`allows HTTP method for path ${path}: ${method}`, ({
          request,
        }) => {
          return request.fetch(path, { method: method }).then((response) => {
            expect(response.status()).toEqual(200);
          });
        });
      });

      ['DELETE', 'POST', 'OPTIONS', 'PUT', 'PATCH'].forEach((method) => {
        test(`disallows HTTP method for path ${path} with 4xx error: ${method}`, ({
          request,
        }) => {
          return request
            .fetch(path, {
              method: method,
              failOnStatusCode: false,
            })
            .then((response) => {
              expect(response.status()).toBeGreaterThanOrEqual(400);
              expect(response.status()).toBeLessThan(500);
            });
        });
      });
    });
  });

  test.describe('404 pages', () => {
    [{ path: '/unmatched' }, { path: '/unmatched/nested' }].forEach(
      ({ path }) => {
        test(`serves 404 page ${path}`, async ({ page }) => {
          const response = await page.goto(path);
          expect(response?.status()).toEqual(404);
          await expect(page.locator('body')).toHaveText(/Custom 404/i);
        });
      },
    );
  });

  test.describe('Error pages', () => {
    [{ path: '/errored-page' }, { path: '/errored-page-new-ssr' }].forEach(
      ({ path }) => {
        test(`serves static 500 page ${path}`, async ({ page }) => {
          const firstResponse = await page.goto(path);
          expect(firstResponse?.status()).toEqual(500);

          // Custom static error page
          await expect(page.locator('body')).toHaveText(/Custom 500/i);

          // Check that it is not cached
          const secondResponse = await page.goto(path);
          expect(secondResponse?.headers()['x-cache']).toEqual(
            'Error from cloudfront',
          );
        });
      },
    );
  });
});
