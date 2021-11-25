import { logger } from '../common';

/**
 * This class should be used to read nextjs configuration files in runtime.
 */
export class SettingsFileReader {
  /**
   * Reads configured asset prefix produced from the nextjs project config.
   *
   * ```
   * // next.config.js
   * module.exports = {
   *   assetPrefix: APP_NAMESPACE,
   *   {
   *     source: `/:market/${APP_NAMESPACE}`,
   *     destination: '/',
   *   },
   *   {
   *     source: `/:market/${APP_NAMESPACE}/:path*`,
   *     destination: '/:path*',
   *   },
   * }
   * ```
   *
   * @returns string
   */
  public static getAppNamespace(): string {
    let assetPrefix = '';
    const requiredServerFiles = 'required-server-files.json';

    try {
      assetPrefix = require(requiredServerFiles).config.assetPrefix.replace(
        '/',
        '',
      );
    } catch (error) {
      logger.warn(`failed to read ${requiredServerFiles}`);
    }

    return assetPrefix;
  }
}
