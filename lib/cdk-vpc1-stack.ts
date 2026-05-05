import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class CdkVpc1Stack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'VpcServices', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      enableDnsSupport: true,
      enableDnsHostnames: true,
      vpcName: 'vpc-services',
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'hub',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
        {
          name: 'spoke',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // Turn on subnet-level VPC Block Public Access for internet gateways (L1 escape hatch).
    const hubCfnSubnet = this.vpc.isolatedSubnets[0].node.defaultChild as ec2.CfnSubnet;
    hubCfnSubnet.addPropertyOverride('BlockPublicAccessStates', {
      InternetGatewayBlockMode: 'block-bidirectional',
    });
  }
}