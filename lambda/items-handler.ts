import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

const toItem = (obj: Record<string, unknown>) => {
  const item: Record<string, { S: string }> = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value === null || value === undefined) continue;
    item[key] = { S: String(value) };
  }
  return item;
};

const fromItem = (item: Record<string, any>) => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (value?.S !== undefined) out[key] = value.S;
    else if (value?.N !== undefined) out[key] = Number(value.N);
    else if (value?.BOOL !== undefined) out[key] = value.BOOL;
  }
  return out;
};

export const handler = async (event: any) => {
  try {
    const table = process.env.TABLE_NAME;
    const method = event.httpMethod;
    const id = event.pathParameters?.id;

    if (!table) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "TABLE_NAME is not configured" }),
      };
    }

    if (method === "GET" && id) {
      const result = await client.send(
        new GetItemCommand({
          TableName: table,
          Key: { id: { S: String(id) } },
        })
      );
      return {
        statusCode: 200,
        body: JSON.stringify(result.Item ? fromItem(result.Item as Record<string, any>) : {}),
      };
    }

    if (method === "GET") {
      const result = await client.send(new ScanCommand({ TableName: table }));
      return {
        statusCode: 200,
        body: JSON.stringify((result.Items || []).map((x) => fromItem(x as Record<string, any>))),
      };
    }

    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      if (!body.id) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "Body must include id" }),
        };
      }

      await client.send(
        new PutItemCommand({
          TableName: table,
          Item: toItem(body),
        })
      );

      return { statusCode: 201, body: JSON.stringify(body) };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal server error",
        error: error?.message ?? String(error),
      }),
    };
  }
};
