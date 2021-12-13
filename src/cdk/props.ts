import { StackProps } from '@aws-cdk/core';

export interface Props extends StackProps {
  /**
   * The directory that holds the output from the builder.
   *
   * i.e. `nextjsCDKBuildOutDir: new Builder(entry, outDir, {...}).outputDir`
   */
  nextjsCDKBuildOutDir: string;
  domain?: Domain;
}

export interface Domain {
  // example: "demo.example.com"
  fqdn: string[];

  // Certificate that supports given fqdn (*.example.com)
  certificateArn?: string;

  zone?: HostedZone;
}

export interface HostedZone {
  hostedZoneId: string;

  // example: "demo"
  subDomain: string;

  // example-domain.com
  zoneName: string;
}
