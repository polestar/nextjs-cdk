import { StackProps } from '@aws-cdk/core';

export interface Props extends StackProps {
  /**
   * The directory that holds the output from the builder.
   *
   * i.e. `nextjsCDKBuildOutDir: new Builder(entry, outDir, {...}).outputDir`
   */
  nextjsCDKBuildOutDir: string;
}
