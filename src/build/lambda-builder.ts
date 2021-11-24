import fse from 'fs-extra';
import path, { join } from 'path';

import { ImageBuildManifest, PageManifest, Manifest } from '../types';
import CoreBuilder from './core-builder';
import { LambdaHandler, logger } from '../common';

export class LambdaBuilder extends CoreBuilder {
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

    this.buildImageOptimizer(imageBuildManifest);
  }

  protected async buildImageOptimizer(imageBuildManifest: Manifest) {
    // If using Next.js 10 and images-manifest.json is present then image optimizer can be used
    const hasImagesManifest = await fse.pathExists(
      join(this.dotNextDir, 'images-manifest.json'),
    );

    // However if using a non-default loader, the lambda is not needed
    const imagesManifest = hasImagesManifest
      ? await fse.readJSON(join(this.dotNextDir, 'images-manifest.json'))
      : null;
    const imageLoader = imagesManifest?.images?.loader;
    const isDefaultLoader = !imageLoader || imageLoader === 'default';
    const hasImageOptimizer = hasImagesManifest && isDefaultLoader;

    // ...nor if the image component is not used
    const exportMarker = (await fse.pathExists(
      join(this.dotNextDir, 'export-marker.json'),
    ))
      ? await fse.readJSON(path.join(this.dotNextDir, 'export-marker.json'))
      : {};
    const isNextImageImported = exportMarker.isNextImageImported !== false;

    if (hasImageOptimizer && isNextImageImported) {
      await this.buildImageLambda(imageBuildManifest);
    }
  }

  /**
   * Process and copy handler code. This allows minifying it before copying to Lambda package.
   * @param handlerType
   * @param destination
   * @param shouldMinify
   */
  protected async processAndCopyHandler(
    handlerType: LambdaHandler,
    destination: string,
    shouldMinify: boolean,
  ): Promise<void> {
    // TODO: We're currently inside the builder path
    // This wont work after this is build
    const source = path.dirname(
      require.resolve(
        path.join(
          __dirname,
          '../../',
          `/dist/bundles/lambda/${handlerType}/${
            shouldMinify ? 'minified' : 'standard'
          }`,
        ),
      ),
    );

    await fse.copy(source, destination);
  }

  protected async buildNextJsLambda(
    pageManifest: PageManifest,
    handler: LambdaHandler,
  ): Promise<void[]> {
    logger.debug('building lambda using handler: ', handler);
    const hasAPIRoutes = await fse.pathExists(
      join(this.serverlessDir, 'pages/api'),
    );

    const targetBuildFolder = join(this.outputDir, handler);

    logger.debug('asset files will be copied to: ', targetBuildFolder);

    await fse.mkdir(join(this.outputDir, handler));

    return Promise.all([
      this.processAndCopyHandler(
        handler,
        targetBuildFolder,
        !!this.buildOptions.minifyHandlers,
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(targetBuildFolder, this.buildOptions.handler),
          )
        : Promise.resolve(),
      fse.writeJson(join(targetBuildFolder, 'manifest.json'), pageManifest),
      fse.copy(
        join(this.serverlessDir, 'pages'),
        join(targetBuildFolder, 'pages'),
        {
          filter: this.getDefaultHandlerFileFilter(hasAPIRoutes, pageManifest),
        },
      ),
      this.copyChunks(handler),
      fse.copy(
        join(this.dotNextDir, 'prerender-manifest.json'),
        join(targetBuildFolder, 'prerender-manifest.json'),
      ),
      this.processAndCopyRoutesManifest(
        join(this.dotNextDir, 'routes-manifest.json'),
        join(targetBuildFolder, 'routes-manifest.json'),
      ),
      ...this.copyWebpackFiles(targetBuildFolder),
      this.copyRequiredServerFiles(targetBuildFolder),
    ]);
  }

  /**
   * Build image optimization lambda (supported by Next.js 10)
   * @param imageBuildManifest
   */
  private async buildImageLambda(
    imageBuildManifest: ImageBuildManifest,
  ): Promise<void> {
    await fse.mkdir(join(this.outputDir, LambdaHandler.IMAGE));

    await Promise.all([
      this.processAndCopyHandler(
        LambdaHandler.IMAGE,
        join(this.outputDir, LambdaHandler.IMAGE),
        !!this.buildOptions.minifyHandlers,
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(
              this.outputDir,
              LambdaHandler.IMAGE,
              this.buildOptions.handler,
            ),
          )
        : Promise.resolve(),
      fse.writeJson(
        join(this.outputDir, LambdaHandler.IMAGE, 'manifest.json'),
        imageBuildManifest,
      ),
      this.processAndCopyRoutesManifest(
        join(this.dotNextDir, 'routes-manifest.json'),
        join(this.outputDir, LambdaHandler.IMAGE, 'routes-manifest.json'),
      ),

      // TODO: will have to suffice for now
      fse.copy(
        join(__dirname, '../..', 'dist', 'sharp_node_modules'),
        join(this.outputDir, LambdaHandler.IMAGE, 'node_modules'),
      ),
      fse.copy(
        join(this.dotNextDir, 'images-manifest.json'),
        join(this.outputDir, LambdaHandler.IMAGE, 'images-manifest.json'),
      ),
    ]);
  }
}
