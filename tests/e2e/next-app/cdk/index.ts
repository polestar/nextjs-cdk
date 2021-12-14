import { NextJSAPIGateway } from '../../../../src/cdk';
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

    const app = new NextJSAPIGateway(this, 'nextjs', {
      nextjsCDKBuildOutDir: props?.nextjsCDKBuildOutDir ?? './.nextjs_cdk',
      env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
      },
      // domain: {
      //   fqdn: ['sub.example.com'],
      //   zone: {
      //     subDomain: 'sub',
      //     zoneName: 'example.com',
      //     hostedZoneId: '<id>',
      //   },
      //   certificateArn:
      //     'arn:aws:acm:us-east:certificate/example',
    });

    new cdk.CfnOutput(this, 'Domain', {
      value: app.distribution.domainName,
      description: 'CloudFrontDomain',
    });
    new cdk.CfnOutput(this, 'ID', {
      value: app.distribution?.distributionId,
      description: 'DistributionID',
    });
    new cdk.CfnOutput(this, 'url', {
      value: app.fqdn?.join('\n') || 'n/a',
      description: 'url',
    });
  }
}
