export * from '../../../../src/cdk';
import { NextJSAPIGateway, NextJSAtEdge } from '../../../../src/cdk';
import * as cdk from '@aws-cdk/core';

export interface NextjsCdkTestStackProps extends cdk.StackProps {
  nextjsCDKBuildOutDir: string;
}

export class NextjsCdkTestStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: NextjsCdkTestStackProps,
  ) {
    super(scope, id, props);

    new NextJSAtEdge(this, 'nextjs-edge', props);
    // const app = new NextJSAPIGateway(this, 'nextjs', {
    //   nextjsCDKBuildOutDir: props?.nextjsCDKBuildOutDir ?? './.nextjs_cdk',
    //   env: {
    //     region: process.env.CDK_DEFAULT_REGION,
    //     account: process.env.CDK_DEFAULT_ACCOUNT,
    //   },
    // });

    new cdk.CfnOutput(this, 'Status', {
      value: 'OK',
      description: 'CloudFrontDomain',
    });
  }
}
