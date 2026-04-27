# Base-Camp — Smart Employee Onboarding & Identity Service

> A serverless, AWS-native employee onboarding system that automates identity provisioning, document collection, and multi-stage onboarding workflows — with real-time tracking via a web-based HR dashboard.

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![HTML](https://img.shields.io/badge/Frontend-HTML%2FJS-blue)](./frontend)

---

## Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [AWS Services Used](#-aws-services-used)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Frontend (HR Dashboard)](#-frontend-hr-dashboard)
- [Backend (Lambda & Step Functions)](#-backend-lambda--step-functions)
- [Environment Variables](#-environment-variables)
- [License](#-license)

---

## Overview

**Base-Camp** streamlines the entire employee onboarding lifecycle using a fully serverless AWS architecture. HR teams can initiate onboarding, track progress in real-time, and manage identity provisioning — all through a clean web dashboard.

Key capabilities:
- Automated multi-stage onboarding workflows via AWS Step Functions
- Identity and access provisioning using Amazon Cognito
- Secure document collection and storage
- Real-time status tracking via an HR web dashboard

---

## Architecture

```
HR Dashboard (Frontend)
        │
        ▼
  Amazon API Gateway
        │
        ▼
  AWS Lambda Functions
   ┌────┴────┐
   │         │
   ▼         ▼
AWS Step   Amazon
Functions  Cognito
   │         │
   ▼         ▼
Amazon    Identity &
DynamoDB  Access Mgmt
   │
   ▼
Amazon S3
(Documents)
```

The frontend HR dashboard communicates with the backend via API Gateway, which triggers Lambda functions. AWS Step Functions orchestrate the multi-stage onboarding workflow while Cognito handles identity provisioning for new employees.

---

## AWS Services Used

| Service | Purpose |
|---|---|
| **AWS Lambda** | Serverless compute for onboarding logic |
| **AWS Step Functions** | Multi-stage workflow orchestration |
| **Amazon DynamoDB** | Employee records and onboarding state storage |
| **Amazon Cognito** | Employee identity provisioning and authentication |
| **Amazon API Gateway** | RESTful API layer for frontend–backend communication |
| **Amazon S3** | Secure document storage |
| **AWS IAM** | Role-based access control |

---

## Features

- **Automated Onboarding Workflows** — Step Functions orchestrate multi-stage onboarding (account creation → document collection → access provisioning → completion)
- **Identity Provisioning** — Automatically create and manage employee identities in Amazon Cognito
- **Document Collection** — Collect and store onboarding documents securely in S3
- **HR Dashboard** — Web interface for HR teams to initiate and monitor onboarding in real-time
- **Real-time Status Tracking** — Live updates on each employee's onboarding stage
- **Serverless & Scalable** — No infrastructure to manage; scales automatically with demand
- **Secure by Default** — Environment variables for secrets, IAM roles for least-privilege access

---

## Project Structure

```
Base-Camp/
├── backend/               # AWS Lambda functions & Step Functions definitions
│   ├── lambdas/           # Individual Lambda function handlers
│   └── stepfunctions/     # Step Functions state machine definitions (ASL)
│
├── frontend/              # HR Dashboard web interface
│   ├── index.html         # Main dashboard entry point
│   ├── *.html             # Additional pages (employee details, status, etc.)
│   └── *.js               # Frontend JavaScript logic & API calls
│
├── .gitignore             # Ignores .env files
├── LICENSE                # MIT License
└── README.md              # This file
```

---

## Getting Started

### Prerequisites

- AWS Account with appropriate permissions
- [AWS CLI](https://aws.amazon.com/cli/) configured
- Node.js (for Lambda functions)
- A modern web browser (for the HR dashboard)

### 1. Clone the Repository

```bash
git clone https://github.com/Rajith-07/Base-Camp.git
cd Base-Camp
```

### 2. Configure AWS Services

Set up the required AWS services in your account:

```bash
# Configure AWS CLI
aws configure

# Deploy Lambda functions
cd backend
# Deploy each Lambda function via AWS Console or AWS CLI
```

### 3. Set Environment Variables

Create a `.env` file in the backend directory (see [Environment Variables](#-environment-variables)):

```bash
cp .env.example .env
# Edit .env with your AWS resource ARNs and IDs
```

### 4. Deploy Step Functions

Deploy the state machine from the `backend/stepfunctions/` directory via the AWS Console or AWS CLI:

```bash
aws stepfunctions create-state-machine \
  --name "EmployeeOnboardingWorkflow" \
  --definition file://backend/stepfunctions/onboarding.asl.json \
  --role-arn <YOUR_STEP_FUNCTIONS_ROLE_ARN>
```

### 5. Launch the Frontend

Open the HR dashboard in your browser:

```bash
cd frontend
open index.html
# Or serve it via a static hosting service like S3 + CloudFront
```

---

## Frontend (HR Dashboard)

The frontend is a lightweight HTML/JavaScript web application serving as the HR team's control panel.

**Key screens:**
- **Dashboard** — Overview of all active onboarding cases and their stages
- **New Employee** — Form to initiate the onboarding workflow for a new hire
- **Employee Status** — Real-time view of an individual's onboarding progress
- **Document Management** — Upload and track required onboarding documents

The dashboard communicates with the backend via Amazon API Gateway REST APIs.

---

## Backend (Lambda & Step Functions)

The backend consists of AWS Lambda functions triggered by API Gateway and orchestrated by Step Functions.

**Onboarding Workflow Stages:**

```
1. Initiate Onboarding
        ↓
2. Create Cognito Identity
        ↓
3. Provision Access & Roles
        ↓
4. Collect Documents (S3)
        ↓
5. Store Records (DynamoDB)
        ↓
6. Notify Completion
```

Each stage is an individual Lambda function, and the state machine manages transitions, retries, and error handling.

---

## Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# AWS Region
AWS_REGION=us-east-1

# DynamoDB
DYNAMODB_TABLE_NAME=EmployeeOnboarding

# Cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# S3
S3_BUCKET_NAME=base-camp-documents

# Step Functions
STATE_MACHINE_ARN=arn:aws:states:us-east-1:xxxxxxxxxxxx:stateMachine:EmployeeOnboardingWorkflow

# API Gateway
API_GATEWAY_ENDPOINT=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

> Never commit `.env` files to version control. The `.gitignore` is already configured to exclude them.

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

<p align="center">
  Built with ❤️ on AWS · <a href="https://github.com/Rajith-07/Base-Camp">View on GitHub</a>
</p>
