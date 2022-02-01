import { test, expect } from '@playwright/test';
import { getCloudFrontDetails } from '../utils';

const { cloudFrontUrl } = getCloudFrontDetails();

test.describe('Headers Tests', () => {
  test.use({ baseURL: cloudFrontUrl! });

  test.describe('Custom headers defined in next.config.js', () => {
    [
      {
        path: '/ssr-page',
        expectedHeaders: { 'x-custom-header-ssr-page': 'custom' },
      },
      {
        path: '/ssg-page',
        expectedHeaders: { 'x-custom-header-ssg-page': 'custom' },
      },
      {
        path: '/',
        expectedHeaders: { 'x-custom-header-all': 'custom' },
      },
      {
        path: '/not-found',
        expectedHeaders: { 'x-custom-header-all': 'custom' },
      },
      {
        path: '/api/basic-api',
        expectedHeaders: { 'x-custom-header-api': 'custom' },
      },
      {
        path: '/app-store-badge.png',
        expectedHeaders: { 'x-custom-header-public-file': 'custom' },
      },
    ].forEach(({ path, expectedHeaders }) => {
      test(`add headers ${JSON.stringify(expectedHeaders)} for path ${path}`, ({
        request,
      }) => {
        return request
          .fetch(path, {
            failOnStatusCode: false,
          })
          .then((response) => {
            for (const expectedHeader in expectedHeaders) {
              expect(response.headers()[expectedHeader]).toEqual(
                // @ts-ignore
                expectedHeaders[expectedHeader],
              );
            }
          });
      });
    });
  });
});
