import rimraf from 'rimraf';
import { LambdaBuilder } from '../../../../src/build/lambda-builder';
import { NextjsCdkTestStack } from '../cdk/index';
import * as cdk from '@aws-cdk/core';

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

    new NextjsCdkTestStack(app, 'next-app-stack', { nextjsCDKBuildOutDir });
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
