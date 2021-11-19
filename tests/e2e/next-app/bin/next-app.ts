import rimraf from 'rimraf';
import * as cdk from '@aws-cdk/core';

import { LambdaBuilder } from '../../../../src/build/lambda-builder';
import { NextjsCdkTestStack } from '../cdk/index';

const nextjsCDKBuildOutDir = './.nextjs_cdk';

const builder = new LambdaBuilder('.', nextjsCDKBuildOutDir);

rimraf(nextjsCDKBuildOutDir, {}, (err) => {
  if (err) {
    throw err;
  }
});

builder
  .build()
  .then(() => {
    const app = new cdk.App();

    new NextjsCdkTestStack(app, 'next-app-gw-stack', { nextjsCDKBuildOutDir });
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
