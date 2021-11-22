import rimraf from 'rimraf';
import { LambdaEdgeBuilder } from '../../../../src/build/LambdaEdgeBuilder';
import { NextjsCdkTestStack } from '../cdk/index';
import * as cdk from '@aws-cdk/core';

const nextjsCDKBuildOutDir = './.nextjs_cdk';

const builder = new LambdaEdgeBuilder('.', nextjsCDKBuildOutDir);

rimraf(nextjsCDKBuildOutDir, {}, (err) => {
  if (err) {
    throw err;
  }
});

builder
  .build()
  .then(() => {
    const app = new cdk.App();

    new NextjsCdkTestStack(app, 'next-cdk-test-stack', {
      nextjsCDKBuildOutDir,
      env: {
        region: 'us-east-1',
      },
    });
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
