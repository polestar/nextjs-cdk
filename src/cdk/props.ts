import { StackProps } from '@aws-cdk/core';

export interface Props extends StackProps {
  /**
   * The directory that holds the output from the builder.
   *
   * i.e. `nextjsCDKBuildOutDir: new Builder(entry, outDir, {...}).outputDir`
   */
  nextjsCDKBuildOutDir: string;
  domain?: Domain;
  customHeaders?: string[];
}

export interface Domain {
  // example: "demo.my-domain.com"
  fqdn: string[];

  // Certificate that supports given fqdn (*.my-domain.com)
  certificateArn?: string;

  zone?: HostedZone;
}

export interface HostedZone {
  hostedZoneId: string;

  // example: "demo"
  subDomain: string;

  // example: my-domain.com
  zoneName: string;
}
