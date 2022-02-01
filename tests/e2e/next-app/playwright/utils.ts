import fs from 'fs';

export function getNextBuildId(): string | null {
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
export function getCloudFrontDetails(): {
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
