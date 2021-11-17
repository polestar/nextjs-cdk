import { PageManifest, Manifest } from '../types';
import { LambdaBuilder } from './lambda-builder';
import { LambdaHandlerTypes } from '../common';

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

    await this.buildNextJsLambda(
      defaultBuildManifest,
      LambdaHandlerTypes.DEFAULT,
    );
    await this.buildNextJsLambda(defaultBuildManifest, LambdaHandlerTypes.EDGE);

    this.buildImageOptimizer(imageBuildManifest);
  }
}
