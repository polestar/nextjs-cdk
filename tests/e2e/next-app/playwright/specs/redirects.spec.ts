import { test, expect } from '@playwright/test';
import { getCloudFrontDetails, getNextBuildId } from '../utils';
import { verifyResponseIsRedirect } from '../validators';
import nodeFetch from 'node-fetch';

const { cloudFrontUrl } = getCloudFrontDetails();
const buildId = getNextBuildId();

test.describe('Redirects Tests', () => {
  test.use({ baseURL: cloudFrontUrl! });

  test.describe('Pages redirect to non-trailing slash path', () => {
    [
      { path: '/ssr-page/', expectedStatus: 200 },
      { path: '/ssg-page/', expectedStatus: 200 },
      { path: '/errored-page/', expectedStatus: 500 },
      { path: '/errored-page-new-ssr/', expectedStatus: 500 },
      { path: '/unmatched/', expectedStatus: 404 },
    ].forEach(({ path, expectedStatus }) => {
      test(`redirects page ${path}`, async ({ page }) => {
        const redirectedPath = path.slice(0, -1);
        const fullRedirectPath = `${cloudFrontUrl}${redirectedPath}`;
        const response = await nodeFetch(`${cloudFrontUrl}${path}`, {
          redirect: 'manual',
        });
        verifyResponseIsRedirect(
          response,
          redirectedPath,
          fullRedirectPath,
          308,
        );

        const pageResponse = await page.goto(path);
        expect(pageResponse?.status()).toEqual(expectedStatus);
        expect(page.url()).toMatch(new RegExp(`${redirectedPath}$`));
      });
    });
  });

  test.describe('Non-redirect cases', () => {
    [
      {
        path: '//example.com/',
        expectedPath: '/example.com',
        expectedStatus: 308,
      },
    ].forEach(({ path, expectedPath, expectedStatus }) => {
      test(`does not redirect page ${path}`, async ({ page }) => {
        const fullRedirectPath = `${cloudFrontUrl}${expectedPath}`;
        const fetchResponse = await nodeFetch(`${cloudFrontUrl}${path}`, {
          redirect: 'manual',
        });
        verifyResponseIsRedirect(
          fetchResponse,
          expectedPath,
          fullRedirectPath,
          expectedStatus,
        );
        // These cases should not redirect ever due to security
        await page.goto(`${cloudFrontUrl}${path}`);
        expect(page.url()).toMatch(new RegExp(`${expectedPath}$`));
        await expect(page.locator('body')).toHaveText(/Custom 404/i);
      });
    });
  });

  test.describe(
    'Public files always redirect to non-trailing slash path',
    () => {
      [{ path: '/app-store-badge.png/' }].forEach(({ path }) => {
        test(`redirects file ${path}`, async ({ page }) => {
          const redirectedPath = path.slice(0, -1);
          const fullRedirectPath = `${cloudFrontUrl}${redirectedPath}`;
          const response = await nodeFetch(`${cloudFrontUrl}${path}`, {
            redirect: 'manual',
          });
          verifyResponseIsRedirect(
            response,
            redirectedPath,
            fullRedirectPath,
            308,
          );
          // // Verify redirect response
          const pageResponse = await page.goto(path);
          expect(pageResponse?.status()).toEqual(200);
        });
      });
    },
  );

  test.describe(
    'Data requests always redirect to non-trailing slash path',
    () => {
      [
        { path: '/' },
        { path: '/index.json/' },
        { path: '/ssg-page.json/' },
      ].forEach(({ path }) => {
        const fullPath = `/_next/data/${buildId}${path}`;

        test(`redirects data request ${fullPath}`, async ({ page }) => {
          const redirectedPath = fullPath.slice(0, -1);

          const fullRedirectPath = `${cloudFrontUrl}${redirectedPath}`;
          const response = await nodeFetch(`${cloudFrontUrl}${fullPath}`, {
            redirect: 'manual',
          });
          verifyResponseIsRedirect(
            response,
            redirectedPath,
            fullRedirectPath,
            308,
          );
          // Verify redirect response
          const pageResponse = await page.goto(fullPath);
          expect(pageResponse?.status()).toEqual(200);
        });
      });
    },
  );

  test.describe('Custom redirects defined in next.config.js', () => {
    [
      {
        path: '/permanent-redirect',
        expectedRedirect: '/ssr-page',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/permanent-redirect?a=123',
        expectedRedirect: '/ssr-page?a=123',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/temporary-redirect',
        expectedRedirect: '/ssg-page',
        expectedStatus: 200,
        expectedRedirectStatus: 307,
      },
      {
        path: '/wildcard-redirect-1/a/b/c/d',
        expectedRedirect: '/ssg-page',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/wildcard-redirect-1/a',
        expectedRedirect: '/ssg-page',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/wildcard-redirect-2/a', // Redirects but the destination serves a 404
        expectedRedirect: '/wildcard-redirect-2-dest/a',
        expectedStatus: 404,
        expectedRedirectStatus: 308,
      },
      {
        path: '/regex-redirect-1/1234',
        expectedRedirect: '/ssg-page',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/regex-redirect-1/abcd', // Not a redirect as the regex is for numbers only
        expectedRedirect: null,
        expectedStatus: null,
        expectedRedirectStatus: null,
      },
      {
        path: '/regex-redirect-2/12345', // Redirects but the destination serves a 404
        expectedRedirect: '/regex-redirect-2-dest/12345',
        expectedStatus: 404,
        expectedRedirectStatus: 308,
      },
      {
        path: '/custom-status-code-redirect',
        expectedRedirect: '/ssr-page',
        expectedStatus: 200,
        expectedRedirectStatus: 302,
      },
      // TODO: This returns 502 after redirect instead 200
      // {
      //   path: '/api/deprecated-basic-api',
      //   expectedRedirect: '/api/basic-api',
      //   expectedStatus: 200,
      //   expectedRedirectStatus: 308,
      // },
      {
        path: '/external-redirect-1',
        expectedRedirect: 'https://jsonplaceholder.typicode.com/users',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/external-redirect-2/abcd',
        expectedRedirect: 'https://jsonplaceholder.typicode.com/abcd',
        expectedStatus: 404,
        expectedRedirectStatus: 308,
      },
      {
        path: '/external-redirect-3/abcd',
        expectedRedirect: 'https://jsonplaceholder.typicode.com/abcd/',
        expectedStatus: 404,
        expectedRedirectStatus: 308,
      },
      {
        path: '/query-string-destination-redirect',
        expectedRedirect: '/ssg-page?a=1234&b=1',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
      {
        path: '/query-string-destination-redirect?foo=bar',
        expectedRedirect: '/ssg-page?foo=bar&a=1234&b=1',
        expectedStatus: 200,
        expectedRedirectStatus: 308,
      },
    ].forEach(
      ({ path, expectedRedirect, expectedStatus, expectedRedirectStatus }) => {
        test(`redirects path ${path} to ${expectedRedirect}, redirect status: ${expectedRedirectStatus}`, async ({
          page,
        }) => {
          // Verify redirect response
          if (expectedRedirect) {
            const fullRedirectPath = expectedRedirect.includes('https://')
              ? expectedRedirect
              : `${cloudFrontUrl}${expectedRedirect}`;
            const response = await nodeFetch(`${cloudFrontUrl}${path}`, {
              redirect: 'manual',
            });
            verifyResponseIsRedirect(
              response,
              expectedRedirect,
              fullRedirectPath,
              expectedRedirectStatus!,
            );
            const pageResponse = await page.goto(path);
            expect(pageResponse?.status()).toEqual(expectedStatus);
          } else {
            const response = await nodeFetch(`${cloudFrontUrl}${path}`, {
              redirect: 'manual',
            });

            expect(response.status).toEqual(404);
          }
        });
      },
    );
  });
});
