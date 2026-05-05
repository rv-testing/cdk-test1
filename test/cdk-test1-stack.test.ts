import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CdkS3Stack } from '../lib/cdk-s3-stack';
import { CdkVpc1Stack } from '../lib/cdk-vpc1-stack';
import { CdkEc2Stack } from '../lib/cdk-ec2-stack';

describe('CdkS3Stack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new CdkS3Stack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  test('creates an S3 bucket with versioning enabled', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
    });
  }); 

  test('S3 bucket blocks all public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('S3 bucket uses S3-managed encryption', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
    });
  });

  test('S3 bucket enforces SSL via bucket policy', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
            Effect: 'Deny',
          }),
        ]),
      },
    });
  });

  test('stack contains exactly one S3 bucket', () => {
    template.resourceCountIs('AWS::S3::Bucket', 1);
  });
});

describe('CdkVpc1Stack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new CdkVpc1Stack(app, 'TestVpcStack');
    template = Template.fromStack(stack);
  });

  test('creates a VPC with the correct CIDR', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsSupport: true,
      EnableDnsHostnames: true,
    });
  });

  test('creates exactly one VPC', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
  });

  test('creates a private isolated hub subnet', () => {
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: '10.0.0.0/24',
      MapPublicIpOnLaunch: false,
    });
  });

  test('creates a public spoke subnet', () => {
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: '10.0.1.0/24',
      MapPublicIpOnLaunch: true,
    });
  });

  test('creates exactly two subnets', () => {
    template.resourceCountIs('AWS::EC2::Subnet', 2);
  });

  test('creates an internet gateway', () => {
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
  });

  test('no NAT gateways are created', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });
});

describe('CdkEc2Stack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const vpcStack = new CdkVpc1Stack(app, 'TestVpcStack2');
    const stack = new CdkEc2Stack(app, 'TestEc2Stack', { vpc: vpcStack.vpc });
    template = Template.fromStack(stack);
  });

  test('creates exactly one EC2 instance', () => {
    template.resourceCountIs('AWS::EC2::Instance', 1);
  });

  test('EC2 instance uses T3 Micro instance type', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      InstanceType: 't3.micro',
    });
  });

  test('EC2 instance is placed in the hub subnet', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
      SubnetId: Match.anyValue(),
    });
  });

  test('creates a security group with all outbound traffic allowed', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for EC2 instance',
      SecurityGroupEgress: Match.arrayWith([
        Match.objectLike({
          CidrIp: '0.0.0.0/0',
          IpProtocol: '-1',
        }),
      ]),
    });
  });

  test('outputs the instance ID', () => {
    template.hasOutput('InstanceId', {
      Description: 'EC2 Instance ID',
    });
  });

  test('outputs the instance private IP', () => {
    template.hasOutput('InstancePrivateIp', {
      Description: 'EC2 Instance Private IP',
    });
  });
});
