#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkTest1Stack } from '../lib/cdk-test1-stack';

const app = new cdk.App();
new CdkTest1Stack(app, 'CdkTest1Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ca-central-1' },
});
