import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class CdkVpc1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.CfnVPC(this, 'VpcServices', {
      cidrBlock: '10.0.0.0/16',
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: [{ key: 'Name', value: 'vpc-services' }],
    });

    new ec2.CfnSubnet(this, 'HubSubnet', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.1.0/24',
      mapPublicIpOnLaunch: false,
      tags: [{ key: 'Name', value: 'hub' }],
    });

    new ec2.CfnSubnet(this, 'SpokeSubnet', {
      vpcId: vpc.ref,
      cidrBlock: '10.0.2.0/24',
      mapPublicIpOnLaunch: true,
      tags: [{ key: 'Name', value: 'spoke' }],
    });
  }
}