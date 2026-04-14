import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const REGION = process.env.REGION;

const ddb = new DynamoDBClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

export const handler = async (event) => {
  try {
    const employeeId = event.pathParameters?.id;
    const { status } = JSON.parse(event.body || "{}");

    if (!employeeId || !["approved", "rejected"].includes(status)) {
      return response(400, { message: "Invalid request parameters" });
    }

    const timestamp = new Date().toISOString();

    try {
      await ddb.send(new UpdateItemCommand({
        TableName: process.env.DYNAMODB_EMPLOYEES_TABLE,
        Key: { employee_id: { S: employeeId } },
        UpdateExpression: "SET #s = :s, reviewed_at = :t",
        ConditionExpression: "attribute_exists(employee_id) AND #s = :p",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": { S: status },
          ":p": { S: "pending_approval" },
          ":t": { S: timestamp }
        }
      }));
    } catch (dbErr) {
      if (dbErr.name === "ConditionalCheckFailedException") {
        return response(409, { message: "Employee record already processed or not found" });
      }
      throw dbErr;
    }

    if (status === "approved") {
      await lambda.send(new InvokeCommand({
        FunctionName: process.env.APPROVAL_LAMBDA_NAME,
        InvocationType: "Event",
        Payload: JSON.stringify({ employee_id: employeeId })
      }));
    }

    return response(200, { 
      message: `Employee ${status} successfully`,
      employee_id: employeeId,
      status 
    });

  } catch (err) {
    console.error("CRITICAL_FAILURE:", err);
    return response(500, { message: "Internal server error", reference: event.requestContext?.requestId });
  }
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});