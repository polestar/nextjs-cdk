import { execSync } from 'child_process';
import * as fs from 'fs';

export {};

/**
 * Get the Next.js build ID from the .next build directory.
 */
function getNextBuildId(): string | null {
  let data;
  try {
    data = fs.readFileSync(`.next/BUILD_ID`);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.error('Next BUILD_ID file could not be found.');
      return null;
    } else {
      console.error('Error reading Next BUILD_ID file.');
      return null;
    }
  }
  try {
    return data.toString();
  } catch (err) {
    console.error(`Error: ${err}`);
    return null;
  }
}

/**
 * Get the CloudFront URL
 */
function getCloudFrontDetails(): {
  cloudFrontUrl: string | null;
} {
  let data;
  try {
    data = fs.readFileSync(`./cdk-outputs.json`);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.error('CDK JSON file could not be found.');
      return { cloudFrontUrl: null };
    } else {
      console.error('Error reading CDK JSON file.');
      return { cloudFrontUrl: null };
    }
  }
  try {
    const struct = JSON.parse(data.toString());
    for (const propName in struct) {
      if (struct.hasOwnProperty(propName)) {
        const topLevelKey = struct[propName];
        // do something with each element here
        if (topLevelKey.hasOwnProperty('Domain')) {
          return { cloudFrontUrl: `https://${topLevelKey.Domain}` };
        }
      }
    }
    return { cloudFrontUrl: null };
  } catch (err) {
    console.error(`Error: ${err}`);
    return { cloudFrontUrl: null };
  }
}

// eslint-disable-next-line require-await
async function runEndToEndTest(): Promise<boolean> {
  try {
    const buildId = getNextBuildId();
    if (!buildId) {
      throw new Error('Next.js build ID not found.');
    }

    console.info('Getting CloudFront URL and distribution ID.');
    const { cloudFrontUrl } = getCloudFrontDetails();

    if (!cloudFrontUrl) {
      throw new Error('CloudFront url not found.');
    }

    // Set Cypress variables to use in e2e tests
    console.info(
      `Setting CYPRESS_BASE_URL=${cloudFrontUrl} and CYPRESS_NEXT_BUILD_ID=${buildId}`,
    );

    process.env['CYPRESS_BASE_URL'] = cloudFrontUrl;
    process.env['CYPRESS_NEXT_BUILD_ID'] = buildId;

    // Now run the e2e tests
    console.info('Running e2e tests.');
    execSync('yarn e2e', { stdio: 'inherit' });

    return true;
  } catch (error) {
    console.error(`Error: ${error}`);
    return false;
  }
}

runEndToEndTest()
  .then((success) => {
    if (success) {
      console.info('End-to-end test successful.');
      process.exit(0);
    } else {
      console.error('End-to-end test failed.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
