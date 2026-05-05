#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CdkS3Stack } from "../lib/cdk-s3-stack";
import { CdkVpc1Stack } from "../lib/cdk-vpc1-stack";
import { CdkEc2Stack } from "../lib/cdk-ec2-stack";

const app = new cdk.App();

const vpcStack = new CdkVpc1Stack(app, "CdkVpc1Stack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ca-central-1" },
});

const ec2Stack = new CdkEc2Stack(app, "CdkEc2Stack", {
  vpc: vpcStack.vpc,
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ca-central-1" },
});

const s3Stack = new CdkS3Stack(app, "CdkS3Stack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "ca-central-1" },
});

ec2Stack.addDependency(vpcStack);
s3Stack.addDependency(vpcStack);
