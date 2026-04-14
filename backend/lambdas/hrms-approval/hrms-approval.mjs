import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SESClient, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { randomBytes } from "crypto";

const REGION = process.env.REGION;

const ddb = new DynamoDBClient({ region: REGION });
const cognito = new CognitoIdentityProviderClient({ region: REGION });
const ses = new SESClient({ region: REGION });
const sfn = new SFNClient({ region: REGION });

export const handler = async (event) => {
  const { employee_id } = event;
  if (!employee_id) throw new Error("Missing employee_id");

  try {
    // 1. Fetch Employee Data
    const { Item: employee } = await ddb.send(new GetItemCommand({
      TableName: process.env.DYNAMODB_EMPLOYEES_TABLE,
      Key: { employee_id: { S: employee_id } }
    }));

    if (!employee) throw new Error("Employee not found");
    if (employee.sfn_execution_arn?.S) return { statusCode: 200, body: "Workflow already active" };

    const email = employee.email.S;
    const tempPassword = `${process.env.TEMP_PASSWORD_PREFIX}${randomBytes(4).toString('hex')}${process.env.TEMP_PASSWORD_SUFFIX}`;

    // 2. Provision Identity (Handle Idempotency)
    try {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: email,
        TemporaryPassword: tempPassword,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "custom:employee_id", Value: employee_id }
        ]
      }));
    } catch (err) {
      if (err.name !== "UsernameExistsException") throw err;
      console.log("Cognito user already exists, proceeding...");
    }

    // 3. Notify Hire
    await ses.send(new SendTemplatedEmailCommand({
      Source: process.env.SES_SENDER_EMAIL,
      Destination: { ToAddresses: [email] },
      Template: "OnboardingWelcome",
      TemplateData: JSON.stringify({
        name: employee.first_name?.S || "New Hire",
        email: email,
        temp_password: tempPassword,
        portal_url: process.env.ONBOARDING_PORTAL_URL
      })
    }));

    // 4. Trigger Workflow Engine
    const sfnResult = await sfn.send(new StartExecutionCommand({
      stateMachineArn: process.env.STEP_FUNCTION_ARN,
      name: `onboard-${employee_id}-${Date.now()}`,
      input: JSON.stringify({
        employee_id,
        email,
        name: employee.first_name?.S,
        department: employee.department?.S
      })
    }));

    // 5. Final State Sync (Consolidated)
    await ddb.send(new UpdateItemCommand({
      TableName: process.env.DYNAMODB_EMPLOYEES_TABLE,
      Key: { employee_id: { S: employee_id } },
      UpdateExpression: "SET #s = :s, onboarding_stage = :st, sfn_execution_arn = :arn, processed_at = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": { S: "approved" },
        ":st": { S: "NOT_STARTED" },
        ":arn": { S: sfnResult.executionArn },
        ":now": { S: new Date().toISOString() }
      }
    }));

    return { statusCode: 200, body: JSON.stringify({ message: "Onboarding initiated" }) };

  } catch (err) {
    console.error("PROVISIONING_ERROR:", err);
    throw err; // Let Lambda retry if it's a transient service error
  }
};