import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
    const handler = new lambda.Function(this, "ItemsHandler", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
        const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
        const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

        exports.handler = async (event) => {
          const table = process.env.TABLE_NAME;
          const method = event.httpMethod;
          const id = event.pathParameters?.id;

          if (method === "GET" && id) {
            const result = await client.send(new GetCommand({ TableName: table, Key: { id } }));
            return { statusCode: 200, body: JSON.stringify(result.Item ?? {}) };
          }
          if (method === "GET") {
            const result = await client.send(new ScanCommand({ TableName: table }));
            return { statusCode: 200, body: JSON.stringify(result.Items ?? []) };
          }
          if (method === "POST") {
            const body = JSON.parse(event.body ?? "{}");
            await client.send(new PutCommand({ TableName: table, Item: body }));
            return { statusCode: 201, body: JSON.stringify(body) };
          }
          return { statusCode: 405, body: "Method Not Allowed" };
        };
      `),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

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
