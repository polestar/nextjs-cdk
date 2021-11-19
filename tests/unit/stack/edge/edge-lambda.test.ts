import path from 'path';

import { Construct, Stack } from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';

import { NextJSAtEdge } from '../../../../src/cdk';
import { Props } from '../../../../src/cdk/props';

test('Lambda@Edge Stack', () => {
  const stack = new Stack();

  new NextjsCdkTestStack(stack, 'test-edge-stack', {
    nextjsCDKBuildOutDir: path.join(__dirname, 'edge-fixtures'),
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

export class NextjsCdkTestStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    new NextJSAtEdge(scope, 'test-edge-construct', props);
  }
}
