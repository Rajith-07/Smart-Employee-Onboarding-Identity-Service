import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { randomUUID } from "crypto";

const REGION = process.env.REGION;

const ddb = new DynamoDBClient({ region: REGION });

// --- Validators ---
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || "");
const isPhone = (v) => /^\d{7,15}$/.test(v || "");

// --- Response helper ---
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": CORS_ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  try {
    console.log("=== EVENT START ===");
    console.log("RAW EVENT:", JSON.stringify(event));

    // --- CORS ---
    if (event.httpMethod === "OPTIONS") {
      return response(200, { message: "OK" });
    }

    // --- Parse ---
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

    // ✅ --- UUID-based employee ID (backend only) ---
    const employeeId = `EMP-${randomUUID()}`;
    console.log("EMPLOYEE ID:", employeeId);

    // --- Env ---
    const tableName = process.env.DYNAMODB_EMPLOYEES_TABLE;
    if (!tableName) {
      return response(500, { message: "Server misconfigured" });
    }

    // --- Item ---
    const item = {
      employee_id: { S: employeeId },

      first_name: { S: body.first_name },
      last_name: { S: body.last_name },
      email: { S: body.email },

      phone_country_code: { S: body.phone_country_code || "" },
      phone: { S: body.phone },

      role: { S: body.role || "" },
      department: { S: body.department || "" },
      employment_type: { S: body.employment_type || "" },

      joining_date: { S: body.joining_date || "" },
      manager_id: { S: body.manager_id || "" },

      work_location: { S: body.work_location || "" },
      work_mode: { S: body.work_mode || "" },

      emergency_contact_name: { S: body.emergency_contact_name || "" },
      emergency_contact_phone: { S: body.emergency_contact_phone || "" },

      status: { S: "pending_approval" },
      created_at: { S: new Date().toISOString() }
    };

    console.log("DYNAMO ITEM:", item);

    // --- Write (safe insert) ---
    try {
      await ddb.send(new PutItemCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(employee_id)"
      }));

      console.log("DYNAMODB WRITE SUCCESS");

    } catch (err) {
      console.error("DYNAMODB ERROR:", err);

      if (err.name === "ConditionalCheckFailedException") {
        return response(409, {
          message: "Duplicate employee ID (extremely rare)"
        });
      }

      return response(500, {
        message: "Database write failed",
        error: err.message
      });
    }

    return response(200, {
      message: "Application submitted successfully",
      employee_id: employeeId
    });

  } catch (err) {
    console.error("🔥 UNHANDLED ERROR:", err);

    return response(500, {
      message: "Internal server error",
      error: err.message
    });
  }
};