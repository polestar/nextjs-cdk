import rimraf from 'rimraf';

import { LambdaBuilder } from '../../../src/build/lambda-builder';

const builder = new LambdaBuilder('.', './.nextjs_cdk');

(async () => {
  rimraf('./.nextjs_cdk', {}, (err) => {
    if (err) {
      throw err;
    }
  });
  await builder.build();
})();
