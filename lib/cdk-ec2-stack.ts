import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface CdkEc2StackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class CdkEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkEc2StackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // Get the hub (private isolated) subnet
    const hubSubnet = vpc.isolatedSubnets[0];

    // Create a security group for the EC2 instance
    const securityGroup = new ec2.SecurityGroup(this, "EC2SecurityGroup", {
      vpc,
      description: "Security group for EC2 instance",
      allowAllOutbound: true,
    });
    securityGroup.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Create an EC2 instance in the hub subnet
    const instance = new ec2.Instance(this, "EC2Instance", {
      vpc,
      vpcSubnets: {
        subnets: [hubSubnet],
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup,
      keyName: "my-key-pair", // Update with your key pair name if needed
    });
    instance.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    new cdk.CfnOutput(this, "InstanceId", {
      value: instance.instanceId,
      description: "EC2 Instance ID",
    });

    new cdk.CfnOutput(this, "InstancePrivateIp", {
      value: instance.instancePrivateIp,
      description: "EC2 Instance Private IP",
    });
  }
}
