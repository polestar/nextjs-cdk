import { LambdaBuilder } from '../../src/build/lambda-builder';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { BuildOptions } from '../../src/types';
import os from 'os';

describe('Builder Tests', () => {
  let builder: LambdaBuilder;
  let outputDir: string;

  const lambdaBuildOptions: BuildOptions = {
    bucketName: 'test-bucket',
    bucketRegion: 'us-east-1',
    cmd: 'true', // to skip next build,
    cleanupDotNext: false,
  };

  beforeEach(() => {
    outputDir = join(os.tmpdir(), uuidv4());
  });

  it('builds successfully from .next with default options', async () => {
    builder = new LambdaBuilder(
      join(__dirname, 'fixtures/simple-app'),
      outputDir,
      lambdaBuildOptions,
    );
    await builder.build();

    // TODO: validate generated package
  });
});
