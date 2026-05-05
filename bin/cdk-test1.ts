#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkS3Stack } from '../lib/cdk-s3-stack';
import { CdkVpc1Stack } from '../lib/cdk-vpc1-stack';

const app = new cdk.App();

new CdkS3Stack(app, 'CdkS3Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ca-central-1' },
});

new CdkVpc1Stack(app, 'CdkVpc1Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ca-central-1' },
});
# bin/ folder contains the entry point for the CDK application. It imports necessary modules and defines the stacks to be deployed. In this case, it creates an S3 stack and a VPC stack, both targeting the 'ca-central-1' region. The environment variables for the AWS account are also set using `CDK_DEFAULT_ACCOUNT`. 