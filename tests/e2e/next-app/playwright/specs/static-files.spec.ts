import { test, expect } from '@playwright/test';
import { getCloudFrontDetails } from '../utils';
import { verifyResponseCacheStatusAPI } from '../validators';

const { cloudFrontUrl } = getCloudFrontDetails();

test.describe('Static Files Tests', () => {
  test.use({ baseURL: cloudFrontUrl! });

  test.beforeEach(({ page }) => {
    page.on('response', (response) => {
      if (response.status() >= 400) {
        throw new Error(
          `Response has errored with status ${response.status()}`,
        );
      }
    });
  });

  test.describe('all static file requests for a page are cached', () => {
    [{ path: '/' }].forEach(({ path }) => {
      test(`serves and caches all static files for page ${path}`, async ({
        page,
      }) => {
        // Visit page once to ensure files are cached in CloudFront
        await page.goto(path);
        await page.goto(path);

        // TODO: figure out how to grab all static files from page
        // and verify they are cached, since Cypress route intercepting does not
        // seem to work on static file requests after page visit.
      });
    });
  });

  test.describe('public files', () => {
    [
      {
        path: '/app-store-badge.png',
        contentType: 'image/png',
        cacheable: true,
      },
      // { path: '/example.html', contentType: 'text/html', cacheable: false },
      // {
      //   path: '/.well-known/test.txt',
      //   contentType: 'text/plain',
      //   cacheable: false,
      // },
    ].forEach(({ path, contentType, cacheable }) => {
      test(`serves file ${path} for content type ${contentType} and cacheable: ${cacheable}`, async ({
        request,
      }) => {
        // Request once to ensure cached
        await request.fetch(path);
        const response = await request.fetch(path);
        expect(response.headers()['content-type']).toEqual(contentType);
        expect(response.status()).toEqual(200);
        verifyResponseCacheStatusAPI(response, cacheable);
      });

      ['HEAD', 'GET'].forEach((method) => {
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

    [
      {
        path: '/ignored.txt',
      },
    ].forEach(({ path }) => {
      // TODO: serverless is not used
      test.skip(`ignored file in serverless.yml returns 404 status code: ${path}`, ({
        request,
      }) => {
        return request
          .fetch(path, { method: 'GET', failOnStatusCode: false })
          .then((response) => {
            expect(response.status()).toEqual(404);
          });
      });
    });
  });
});
