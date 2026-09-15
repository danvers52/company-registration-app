# Company Registration App

A tenant-aware employee attendance and administration application built with Node.js, Express, MongoDB, and JWT authentication. The browser frontend supports both employee attendance workflows and an admin dashboard.

## Features

- Employee clock-in and clock-out tracking
- Tea, lunch, client-visit, and safety-drill break tracking
- Employee attendance history and date filtering
- Admin attendance creation, editing, deletion, and date filtering
- Employee and admin account management
- First-admin signup per email domain and tenant isolation by company
- Employee archive, restore, and permanent-delete workflows
- Active and archived audit-log views, monthly filtering, export, and automatic archival after five months
- Excel export for employees and audit logs
- Password reset token generation and password reset
- Company display-name cleanup for `.com` and `.co.za` suffixes
- Health check endpoint and MongoDB connection retry handling
- Security middleware including Helmet, CORS restrictions, rate limiting, HPP protection, MongoDB query sanitization, and request-size limits

## Requirements

For local development:

- Node.js 18 or later
- npm 10 or later
- MongoDB running locally or available through `MONGODB_URI`

For Docker:

- Docker 20.10 or later
- Docker Compose 2.0 or later

## Quick Start

### Docker Compose

Docker is the recommended path because the compose file starts the app and a MongoDB replica set, which is required by the transaction-based routes.

```bash
docker-compose up --build
```

Open `http://localhost:5000`.

The `mongo-data` named volume preserves database data. To remove the data as well as the containers, run:

```bash
docker-compose down -v
```

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root. `.env.example` contains the expected shape:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/company-registration?replicaSet=rs0
JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5000
BCRYPT_SALT_ROUNDS=12
NODE_ENV=development
```

3. Start MongoDB as a replica set, then start the server:

```bash
npm start
```

Open `http://localhost:5000`. The server validates the MongoDB URI, port, and CORS origin at startup and retries MongoDB connections up to five times.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the application |
| `npm run dev` | Start with nodemon |
| `npm test` | Run the Jest suite serially |
| `docker-compose up --build` | Build and start app plus MongoDB |
| `docker-compose up test` | Run the test container against the test database |
| `docker-compose logs -f app` | Follow application logs |
| `docker-compose down` | Stop containers and preserve the named volume |
| `docker-compose down -v` | Stop containers and delete database volume |

## API Endpoints

### Authentication

- `POST /api/auth/signup` — create the first admin for an email domain
- `POST /api/auth/register` — admin creates an employee or admin in the same company
- `POST /api/auth/login` — authenticate and receive a JWT
- `POST /api/auth/forgot-password` — generate a one-hour reset token
- `POST /api/auth/reset-password` — set a new password using a valid reset token
- `GET /api/auth/me` — retrieve the authenticated user
- `POST /api/auth/logout` — record logout in the audit log

### Employees and Audit Logs

- `GET /api/employees` — list active company employees
- `GET /api/employees/:id` — retrieve an employee
- `PUT /api/employees/:id` — update an employee profile
- `DELETE /api/employees/:id` — archive an employee
- `GET /api/employees/archive/employees` — list archived employees
- `POST /api/employees/archive/employees/:id/restore` — restore an employee
- `DELETE /api/employees/archive/employees/:id` — permanently delete an archived employee
- `GET /api/employees/audit` — list active audit logs, optionally with `?month=YYYY-MM`
- `GET /api/employees/audit/archive` — list archived audit logs
- `GET /api/employees/audit/check?email=...` — inspect active and archived logs for an email
- `POST /api/employees/audit/archive/trigger` — manually run audit archival

### Attendance

- `POST /api/attendance/record` — record attendance for the authenticated employee, or for a same-company employee as an admin
- `POST /api/attendance/admin/add` — add a record as an admin
- `PUT /api/attendance/admin/edit/:id` — edit type, timestamp, location, or notes
- `DELETE /api/attendance/admin/delete/:id` — delete a record
- `GET /api/attendance/history` — retrieve the authenticated employee's latest 50 records
- `GET /api/attendance/date/:date` — retrieve the authenticated employee's records for `YYYY-MM-DD`
- `GET /api/attendance/admin/all` — retrieve company records, optionally with `?date=YYYY-MM-DD`

### Exports and Health

- `GET /api/export/employees` — download the active employee list as Excel
- `GET /api/export/audit?month=YYYY-MM` — download a monthly audit log as Excel
- `GET /api/health` — report application and MongoDB health

All protected endpoints require `Authorization: Bearer <token>`. Admin-only endpoints additionally require the admin role and same-company access.

## Testing and Performance

The Jest tests use `.env.test` and the test configuration in `jest.config.js`. Docker Compose provides a separate `test` service using `company-registration-test`. Ensure the test environment uses `MONGODB_URI` when running outside Docker; the application does not read `MONGO_URI`.

`performance-test.yml` contains an Artillery-style authenticated-user load scenario. `seedUsers.js` is a utility for inserting 50 performance-test users; review the target database before running it.

## Security and Production Notes

- Use a unique `JWT_SECRET` of at least 32 characters in production.
- Keep `.env` and all credentials out of version control.
- Set `NODE_ENV=production` and use HTTPS.
- Set `CORS_ORIGIN` to the actual frontend origin.
- Keep `BCRYPT_SALT_ROUNDS` at 10 or higher; 12 is the default example.
- Password reset currently returns the reset token in the API response for development/testing. Use an email delivery flow before production deployment.
- The application uses MongoDB transactions, so production MongoDB must support replica sets or a compatible deployment.

See [SETUP.md](SETUP.md) for the complete project tree, Docker details, environment reference, API behavior, and troubleshooting guidance.