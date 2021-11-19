import { PageManifest, Manifest } from '../types';
import { LambdaBuilder } from './lambda-builder';
import { LambdaHandler } from '../common';

export class LambdaEdgeBuilder extends LambdaBuilder {
  protected async buildPlatform(
    manifests: {
      defaultBuildManifest: PageManifest;
      imageManifest: Manifest;
      pageManifest: Manifest;
    },
    debugMode?: boolean,
  ): Promise<void> {
    const { defaultBuildManifest, imageManifest } = manifests;
    const imageBuildManifest = {
      ...imageManifest,
    };

    await this.buildNextJsLambda(defaultBuildManifest, LambdaHandler.DEFAULT);
    await this.buildNextJsLambda(defaultBuildManifest, LambdaHandler.EDGE);

    this.buildImageOptimizer(imageBuildManifest);
  }
}
