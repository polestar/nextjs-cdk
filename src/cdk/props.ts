import { StackProps } from '@aws-cdk/core';

export interface Props extends StackProps {
  /**
   * The directory that holds the output from the builder.
   *
   * i.e. `nextjsCDKBuildOutDir: new Builder(entry, outDir, {...}).outputDir`
   */
  nextjsCDKBuildOutDir: string;
  domain?: {
    // example: "demo.example.com"
    fqdn: string[];

    // example: "demo"
    subDomain: string;

    // Certificate that supports given fqdn (*.example.com)
    certificateArn?: string;

    zone: {
      hostedZoneId?: string;

      // example-domain.com
      zoneName: string;
    };
  };
}
