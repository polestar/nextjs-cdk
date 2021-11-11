import fse from 'fs-extra';
import path, { join } from 'path';
import { ImageBuildManifest, PageManifest, Manifest } from '../types';
import CoreBuilder from './core-builder';

export const DEFAULT_LAMBDA_CODE_DIR = 'default-lambda';
export const IMAGE_LAMBDA_CODE_DIR = 'image-lambda';

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

    await this.buildDefaultLambda(defaultBuildManifest);

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
  private async processAndCopyHandler(
    handlerType: 'default-handler' | 'image-handler',
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

  private async buildDefaultLambda(
    pageManifest: PageManifest,
  ): Promise<void[]> {
    const hasAPIRoutes = await fse.pathExists(
      join(this.serverlessDir, 'pages/api'),
    );

    await fse.mkdir(join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR));

    return Promise.all([
      this.processAndCopyHandler(
        'default-handler',
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR),
        !!this.buildOptions.minifyHandlers,
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(
              this.outputDir,
              DEFAULT_LAMBDA_CODE_DIR,
              this.buildOptions.handler,
            ),
          )
        : Promise.resolve(),
      fse.writeJson(
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, 'manifest.json'),
        pageManifest,
      ),
      fse.copy(
        join(this.serverlessDir, 'pages'),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, 'pages'),
        {
          filter: this.getDefaultHandlerFileFilter(hasAPIRoutes, pageManifest),
        },
      ),
      this.copyChunks(DEFAULT_LAMBDA_CODE_DIR),
      fse.copy(
        join(this.dotNextDir, 'prerender-manifest.json'),
        join(
          this.outputDir,
          DEFAULT_LAMBDA_CODE_DIR,
          'prerender-manifest.json',
        ),
      ),
      this.processAndCopyRoutesManifest(
        join(this.dotNextDir, 'routes-manifest.json'),
        join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR, 'routes-manifest.json'),
      ),
      ...this.copyWebpackFiles(join(this.outputDir, DEFAULT_LAMBDA_CODE_DIR)),
    ]);
  }

  /**
   * Build image optimization lambda (supported by Next.js 10)
   * @param imageBuildManifest
   */
  private async buildImageLambda(
    imageBuildManifest: ImageBuildManifest,
  ): Promise<void> {
    await fse.mkdir(join(this.outputDir, IMAGE_LAMBDA_CODE_DIR));

    await Promise.all([
      this.processAndCopyHandler(
        'image-handler',
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR),
        !!this.buildOptions.minifyHandlers,
      ),
      this.buildOptions?.handler
        ? fse.copy(
            join(this.nextConfigDir, this.buildOptions.handler),
            join(
              this.outputDir,
              IMAGE_LAMBDA_CODE_DIR,
              this.buildOptions.handler,
            ),
          )
        : Promise.resolve(),
      fse.writeJson(
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, 'manifest.json'),
        imageBuildManifest,
      ),
      this.processAndCopyRoutesManifest(
        join(this.dotNextDir, 'routes-manifest.json'),
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, 'routes-manifest.json'),
      ),

      // TODO: will have to suffice for now
      fse.copy(
        join(__dirname, '../..', 'dist', 'sharp_node_modules'),
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, 'node_modules'),
      ),
      fse.copy(
        join(this.dotNextDir, 'images-manifest.json'),
        join(this.outputDir, IMAGE_LAMBDA_CODE_DIR, 'images-manifest.json'),
      ),
    ]);
  }
}
