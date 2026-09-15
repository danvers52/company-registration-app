# Company Registration App: Setup and Security Guide

## Overview

This application provides tenant-aware employee attendance and administration through a Node.js/Express API, MongoDB persistence, JWT authentication, and a browser frontend. Company membership is resolved from the user's email domain and stored through the `Company` model.

## Current Project Structure

```text
Company Registration App/
├── .dockerignore
├── .env.example                 # Development environment template
├── .env.test                    # Jest test environment template
├── .gitignore
├── .vscode/                     # Workspace settings, if present
├── Dockerfile                   # Node 18 Alpine image
├── docker-compose.yml           # app, test, and replica-set MongoDB services
├── jest.config.js               # Jest configuration
├── jest.setup.js                # Test globals and dotenv setup
├── package.json                 # Runtime, development, and npm scripts
├── package-lock.json
├── performance-test.yml         # Authenticated load-test scenario
├── seedUsers.js                 # Seeds 50 performance-test users
├── server.js                    # Express app, middleware, health check, scheduler
├── setupTimeSeries.js           # Destructive optional MongoDB setup utility
├── tsconfig.json
├── README.md
├── SETUP.md
├── models/
│   ├── ArchivedEmployee.js      # Archived employee schema
│   ├── Attendance.js            # Attendance and break records
│   ├── AuditLog.js              # Active audit records
│   ├── AuditLogArchive.js       # Archived audit records
│   ├── Company.js               # Tenant/company schema
│   └── Employee.js              # Employee/admin schema and password hashing
├── routes/
│   ├── attendance.js            # Attendance CRUD and history APIs
│   ├── auth.js                  # Signup, login, reset, and session APIs
│   ├── employees.js             # Employees, archive, and audit APIs
│   └── export.js                # Excel export APIs
├── utils/
│   ├── auditArchival.js         # Five-month audit archival and month queries
│   ├── config.js                # Environment parsing and validation
│   ├── tenant.js                # Company resolution and isolation helpers
│   └── validators.js             # Request validation helpers
├── public/
│   ├── index.html               # Login, employee, and admin views
│   ├── script.js                # Frontend API calls and UI behavior
│   ├── styles.css
│   └── vendor/xlsx.min.js       # Browser Excel export dependency
└── tests/
    ├── auditlog.test.js
    ├── auth.integration.test.js
    ├── concurrent.test.js
    ├── employee.test.js
    └── validators.test.js
```

## Prerequisites

### Local development

- Node.js 18 or later
- npm 10 or later
- MongoDB with replica-set support, because the API uses transactions

### Docker

- Docker 20.10 or later
- Docker Compose 2.0 or later

Docker is recommended because its MongoDB service starts with replica set `rs0` and the app is configured to use it.

## Local Installation

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set real values. The important names are:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/company-registration?replicaSet=rs0
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5000
BCRYPT_SALT_ROUNDS=12
NODE_ENV=development
```

`config.js` defaults `MONGODB_URI` to the Docker hostname, so local development should set it explicitly to `localhost`. Production requires a JWT secret of at least 32 characters. `BCRYPT_SALT_ROUNDS` must be at least 10.

3. Start MongoDB as a replica set, then run:

```bash
npm start
```

For automatic restart during development:

```bash
npm run dev
```

Visit `http://localhost:5000` and use **Admin Registration** to create the first admin for an email domain. A second admin for the same domain cannot be created through signup; admins create additional users from the dashboard.

## Docker Compose

Start the full application:

```bash
docker-compose up --build
```

Services:

| Service | Purpose | Host port |
| --- | --- | --- |
| `app` | Node.js API and static frontend | `5000` |
| `test` | Jest suite against the test database | none |
| `mongo` | MongoDB 6 replica set `rs0` | `27017` |

The app uses `mongodb://mongo:27017/company-registration?replicaSet=rs0`. MongoDB data is stored in the named `mongo-data` volume and survives `docker-compose down`.

```bash
docker-compose up -d        # start in the background
docker-compose logs -f app  # follow app logs
docker-compose ps           # view service status
docker-compose down         # stop services, preserve data
docker-compose down -v      # stop services and delete data
docker-compose up test      # run the Dockerized Jest service
```

The Docker test service uses `company-registration-test` and waits for MongoDB to accept connections before running `npm test`. Override non-Mongo settings with a root `.env` file or the compose environment section.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `5000` |
| `MONGODB_URI` | No | MongoDB connection string; Docker provides its own value |
| `JWT_SECRET` | Production | JWT signing secret; production requires 32+ characters |
| `JWT_EXPIRES_IN` | No | JWT lifetime, default `24h` |
| `CORS_ORIGIN` | No | Allowed browser origin, default `http://localhost:5000` |
| `BCRYPT_SALT_ROUNDS` | No | Password hashing cost, minimum `10`, example `12` |
| `NODE_ENV` | No | `development`, `test`, or `production` |

Use `MONGODB_URI`, not `MONGO_URI`, when running tests outside Docker. `.env.test` should contain a test database URI and `NODE_ENV=test`; never point tests at a production database.

## Data and Audit Behavior

- Employees and admins are scoped to a `Company` resolved from the email domain.
- The employee list's **Archive** action moves the account to `ArchivedEmployee`; it does not immediately delete attendance or audit references.
- Archived employees can be restored or permanently deleted by a same-company admin. Permanent deletion is irreversible.
- Attendance supports clock-in/out, tea, lunch, client-visit, safety-drill, and restore-employee record types.
- The API prevents duplicate attendance types per employee through a unique database index and transaction handling.
- Audit logs are shown by month and automatically move to `AuditLogArchive` after five months. The scheduler checks daily, and admins can trigger a check from the Archive History tab or the manual archive endpoint.
- Employee and audit exports are Excel workbooks and are rate-limited.

## API and Security

Protected requests use `Authorization: Bearer <JWT>`. Admin endpoints additionally enforce the admin role and company boundary.

Authentication endpoints:

- `POST /api/auth/signup`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Employee and audit endpoints:

- `GET /api/employees`
- `GET /api/employees/:id`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `GET /api/employees/archive/employees`
- `POST /api/employees/archive/employees/:id/restore`
- `DELETE /api/employees/archive/employees/:id`
- `GET /api/employees/audit?month=YYYY-MM`
- `GET /api/employees/audit/archive?month=YYYY-MM`
- `GET /api/employees/audit/check?email=...`
- `POST /api/employees/audit/archive/trigger`

Attendance endpoints:

- `POST /api/attendance/record`
- `POST /api/attendance/admin/add`
- `PUT /api/attendance/admin/edit/:id`
- `DELETE /api/attendance/admin/delete/:id`
- `GET /api/attendance/history`
- `GET /api/attendance/date/:date`
- `GET /api/attendance/admin/all?date=YYYY-MM-DD`

Exports and monitoring:

- `GET /api/export/employees`
- `GET /api/export/audit?month=YYYY-MM`
- `GET /api/health`

Security middleware includes Helmet, CORS, global and route-specific rate limits, HPP protection, MongoDB query sanitization, JSON/urlencoded body limits, bcrypt password hashing, and production JWT validation. The health endpoint returns `200` when MongoDB is connected and `503` otherwise.

## Testing and Optional Utilities

Run the Jest suite locally with:

```bash
npm test
```

`performance-test.yml` is an Artillery-style load scenario. `seedUsers.js` inserts 50 users with `user1@example.com` through `user50@example.com`; use only against a disposable performance database and ensure those users have the required company data before exercising tenant-protected endpoints.

`setupTimeSeries.js` is an optional, destructive database utility. It drops the `attendance` and `employees` collections before attempting to create a time-series attendance collection and seed accounts. It is not used by `npm start` or Docker Compose, and should not be run against an existing database without a backup and a compatibility review with the current Mongoose schemas.

## Troubleshooting

### MongoDB connection or transaction errors

Confirm MongoDB is running as a replica set and that `MONGODB_URI` contains `replicaSet=rs0` where required. With Docker, check `docker-compose ps` and `docker-compose logs mongo`.

### Port already in use

Change `PORT` for local use, or change the host side of the compose mapping, for example `5001:5000`, then open `http://localhost:5001`.

### Authentication or CORS failures

Confirm `JWT_SECRET`, `JWT_EXPIRES_IN`, and `CORS_ORIGIN` are correct for the running environment. Log in again after changing a secret because existing tokens will no longer validate.

### Two users in browser testing

Use separate browser profiles, browsers, or a normal window plus an incognito/private window. Tabs in one profile share `localStorage`, so a second login replaces the first user's token.

## Production Checklist

- Use a managed MongoDB replica set and a backup policy.
- Set a unique 32+ character `JWT_SECRET` through a secrets manager.
- Set `NODE_ENV=production` and use HTTPS.
- Restrict `CORS_ORIGIN` to the real frontend origin.
- Replace the development password-reset response token with email delivery.
- Keep `.env`, test credentials, and seeded accounts out of production.