import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CdkS3Stack } from '../lib/cdk-s3-stack';

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

# test/cdk-test1-stack.test.ts contains unit tests for the CdkS3Stack. It uses the AWS CDK assertions library to verify that the stack creates an S3 bucket with the expected properties, such as versioning enabled, public access blocking, S3-managed encryption, and SSL enforcement. The tests also check that exactly one S3 bucket is created in the stack.  

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
