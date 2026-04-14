import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({ region: "ap-south-1" });

const unmarshall = (item) => {
  const obj = {};
  for (const key in item) {
    const val = item[key];
    if (val.S !== undefined) obj[key] = val.S;
    else if (val.N !== undefined) obj[key] = Number(val.N);
    else if (val.BOOL !== undefined) obj[key] = val.BOOL;
  }
  return obj;
};

export const handler = async () => {
  try {
    let items = [];
    let ExclusiveStartKey = undefined;

    // FULL TABLE SCAN WITH PAGINATION
    do {
      const res = await ddb.send(new ScanCommand({
        TableName: process.env.DYNAMODB_EMPLOYEES_TABLE,
        ExclusiveStartKey
      }));

      items = items.concat(res.Items || []);
      ExclusiveStartKey = res.LastEvaluatedKey;

    } while (ExclusiveStartKey);

    const result = items.map(unmarshall);

    // Sort: newest first
    result.sort((a, b) =>
      new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0)
    );

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error("GET employees error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error"
      })
    };
  }
};