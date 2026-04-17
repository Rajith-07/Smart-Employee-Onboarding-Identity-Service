import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { randomUUID } from "crypto";

const REGION = process.env.REGION;

const ddb = new DynamoDBClient({ region: REGION });
const ses = new SESv2Client({ region: REGION });

// --- Validators ---
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || "");
const isPhone = (v) => /^\d{7,15}$/.test(v || "");

// --- Response helper ---
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": process.env.CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": process.env.CORS_ALLOW_METHODS,
  },
  body: JSON.stringify(body),
});

// --- Send onboarding confirmation email via SES template ---
const sendOnboardingEmail = async ({
  toEmail,
  firstName,
  lastName,
  employeeId,
  email,
  phoneCountryCode,
  phone,
  role,
  department,
  employmentType,
  joiningDate,
  workLocation,
  workMode,
}) => {
  const command = new SendEmailCommand({
    FromEmailAddress: process.env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [toEmail],
    },
    Content: {
      Template: {
        TemplateName: process.env.FORM_SUBMISSION_SUCCESS_TEMPLATE,
        TemplateData: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          employee_id: employeeId,
          email: email,
          phone_country_code: phoneCountryCode,
          phone: phone,
          role: role,
          department: department,
          employment_type: employmentType,
          joining_date: joiningDate,
          work_location: workLocation,
          work_mode: workMode,
        }),
      },
    },
  });

  await ses.send(command);
};

export const handler = async (event) => {
  try {
    console.log("=== EVENT START ===");
    console.log("RAW EVENT:", JSON.stringify(event));

    // --- CORS preflight ---
    if (event.httpMethod === "OPTIONS") {
      return response(200, { message: "OK" });
    }

    // --- Parse body ---
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      console.error("JSON PARSE ERROR:", err);
      return response(400, { message: "Invalid JSON" });
    }

    console.log("PARSED BODY:", body);

    // --- Validation ---
    if (
      !body.first_name ||
      !body.last_name ||
      !isEmail(body.email) ||
      !isPhone(body.phone)
    ) {
      return response(400, { message: "Invalid input data" });
    }

    // --- Generate employee ID ---
    const employeeId = `EMP-${randomUUID()}`;
    console.log("EMPLOYEE ID:", employeeId);

    // --- Env check ---
    const tableName = process.env.DYNAMODB_EMPLOYEES_TABLE;
    if (!tableName) {
      return response(500, { message: "Server misconfigured: missing table name" });
    }
    if (!process.env.SES_FROM_EMAIL) {
      console.warn("SES_FROM_EMAIL env var is not set — email will be skipped");
    }

    // --- Build DynamoDB item ---
    const item = {
      employee_id:              { S: employeeId },
      first_name:               { S: body.first_name },
      last_name:                { S: body.last_name },
      email:                    { S: body.email },
      phone_country_code:       { S: body.phone_country_code || "" },
      phone:                    { S: body.phone },
      role:                     { S: body.role || "" },
      department:               { S: body.department || "" },
      employment_type:          { S: body.employment_type || "" },
      joining_date:             { S: body.joining_date || "" },
      manager_id:               { S: body.manager_id || "" },
      work_location:            { S: body.work_location || "" },
      work_mode:                { S: body.work_mode || "" },
      emergency_contact_name:   { S: body.emergency_contact_name || "" },
      emergency_contact_phone:  { S: body.emergency_contact_phone || "" },
      status:                   { S: "pending_approval" },
      created_at:               { S: new Date().toISOString() },
    };

    console.log("DYNAMO ITEM:", JSON.stringify(item));

    // --- Write to DynamoDB (safe insert) ---
    try {
      await ddb.send(new PutItemCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(employee_id)",
      }));

      console.log("DYNAMODB WRITE SUCCESS");

    } catch (err) {
      console.error("DYNAMODB ERROR:", err);

      if (err.name === "ConditionalCheckFailedException") {
        return response(409, { message: "Duplicate employee ID (extremely rare)" });
      }

      return response(500, {
        message: "Database write failed",
        error: err.message,
      });
    }

    // --- Send confirmation email via SES (non-blocking on failure) ---
    if (process.env.SES_FROM_EMAIL) {
      try {
        await sendOnboardingEmail({
          toEmail:         body.email,
          firstName:       body.first_name,
          lastName:        body.last_name,
          employeeId:      employeeId,
          email:           body.email,
          phoneCountryCode: body.phone_country_code || "",
          phone:           body.phone,
          role:            body.role || "",
          department:      body.department || "",
          employmentType:  body.employment_type || "",
          joiningDate:     body.joining_date || "",
          workLocation:    body.work_location || "",
          workMode:        body.work_mode || "",
        });

        console.log("SES EMAIL SENT to:", body.email);

      } catch (sesErr) {
        // Log but do not fail — employee record is already saved
        console.error("SES EMAIL ERROR (non-fatal):", sesErr);
      }
    }

    // --- Success ---
    return response(200, {
      message: "Application submitted successfully",
      employee_id: employeeId,
    });

  } catch (err) {
    console.error("UNHANDLED ERROR:", err);
    return response(500, {
      message: "Internal server error",
      error: err.message,
    });
  }
};