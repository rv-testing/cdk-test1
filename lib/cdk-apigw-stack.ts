import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cr from "aws-cdk-lib/custom-resources";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class CdkApiGwStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // L3: DynamoDB table
    const table = new dynamodb.TableV2(this, "ItemsTable", {
      tableName: "items-table",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // L3: Lambda function (inline handler for simplicity)
    const handler = new nodejs.NodejsFunction(this, "ItemsHandler", {
      entry: path.join(__dirname, "../lambda/items-handler.ts"),
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      logRetention: logs.RetentionDays.ONE_DAY,
      logRetentionRetryOptions: { maxRetries: 3 },
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Ensure log group is deleted on stack destroy via a custom resource
    const logGroupName = `/aws/lambda/${handler.functionName}`;
    const deleteLogGroup = new cr.AwsCustomResource(this, "DeleteLogGroupOnDestroy", {
      onDelete: {
        service: "CloudWatchLogs",
        action: "deleteLogGroup",
        parameters: { logGroupName },
        physicalResourceId: cr.PhysicalResourceId.of(logGroupName),
        ignoreErrorCodesMatching: "ResourceNotFoundException",
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    deleteLogGroup.node.addDependency(handler);

    // Grant Lambda read/write access to the table
    table.grantReadWriteData(handler);

    // L3: REST API Gateway backed by Lambda
    const api = new apigw.LambdaRestApi(this, "ItemsApi", {
      handler,
      restApiName: "items-api",
      proxy: false,
      deployOptions: {
        stageName: "v1",
      },
    });

    const items = api.root.addResource("items");
    items.addMethod("GET");
    items.addMethod("POST");

    const item = items.addResource("{id}");
    item.addMethod("GET");

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
      description: "DynamoDB Table Name",
    });
  }
}
