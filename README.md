# Company Registration App

A tenant-aware employee attendance and admin dashboard application built with Node.js, Express, MongoDB, and JWT authentication.

## Features

- Employee clock-in/clock-out tracking
- Employee break tracking for tea, lunch, client visits, and safety drills
- Attendance history and date filtering
- Admin employee management and attendance editing
- Employee archiving with restore and permanent-delete options
- Audit log tracking and export support
- Archival support and management
- Tenant-aware authorization with `Company` model
- Company names display without `.com` or `.co.za` suffixes
- Security hardening with Helmet, CORS, rate limiting, and input sanitization

## Getting Started

### Prerequisites

Choose one of the following setup options:

**Option 1: Local Development**
- Node.js 18 or later
- npm 10 or later
- MongoDB running locally or accessible remotely

**Option 2: Docker (Recommended)**
- Docker 20.10 or later
- Docker Compose 2.0 or later

### Install Dependencies

**For Local Development:**

```bash
npm install
```

**For Docker Setup:**

No local installation needed. Docker handles all dependencies.

### Quick Start with Docker

```bash
docker-compose up
```

The app will be available at `http://localhost:5000`

### Environment Setup

**For Local Development:**

Create `.env` in the project root and add:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/company-registration
JWT_SECRET=your-strong-random-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5000
BCRYPT_SALT_ROUNDS=12
NODE_ENV=development
```

**For Docker:**

Docker Compose automatically sets the MongoDB connection string. Customize other variables by creating a `.env` file or modifying the `docker-compose.yml`.

### Run the App

**Local Development:**

Run the server entry point directly:

```bash
node server.js
```

**Docker Setup:**

Start all services (app + MongoDB):

```bash
docker-compose up
```

For detached mode (background):

```bash
docker-compose up -d
```

Stop services:

```bash
docker-compose down
```

View logs:

```bash
docker-compose logs -f app
```

Open the app in your browser:

```text
http://localhost:5000
```

## Scripts

### npm Scripts
- `npm test` — run tests with Jest

### Docker Commands
- `docker-compose up` — start app and MongoDB
- `docker-compose up -d` — start in background
- `docker-compose down` — stop and remove containers
- `docker-compose logs -f` — view logs in real-time
- `docker-compose ps` — list running containers

## API Endpoints

### Authentication

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Employees

- `GET /api/employees`
- `GET /api/employees/:id`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id` — archive an employee
- `GET /api/employees/audit`
- `GET /api/employees/audit/archive`

### Attendance

- `POST /api/attendance/record`
- `POST /api/attendance/admin/add`
- `PUT /api/attendance/admin/edit/:id`
- `DELETE /api/attendance/admin/delete/:id`
- `GET /api/attendance/history`
- `GET /api/attendance/date/:date`
- `GET /api/attendance/admin/all`

### Attendance and Login Notes

- Employees can record only their own attendance. The server identifies the employee from the authenticated JWT.
- To test two employees at the same time, use separate browser profiles, browsers, or a normal window plus a private/incognito window. Browser `localStorage` is shared by tabs in the same profile, so logging in as a second employee replaces the first employee's token.
- Admins can edit attendance records from the Attendance tab or from an employee's View action. The editor changes attendance type, timestamp, and notes without changing the record owner.
- Company and tenant matching still use the full email domain internally; only the displayed company name removes `.com` and `.co.za`.

### Employee Archive Notes

- The Admin employee-list action is **Archive**, not immediate deletion.
- Archived employees are hidden from the active employee list and retained in the Archive tab.
- Admins can restore an archived employee or permanently delete the archived account.
- Permanent deletion cannot be undone. Archived accounts retain their original attendance and audit references.

### Export

- `GET /api/export/employees`
- `GET /api/export/audit`

## Security Notes

- `JWT_SECRET` must be strong and stored securely
- Use HTTPS in production
- Keep `.env` out of version control
- CORS is restricted by `CORS_ORIGIN`
- Request sanitization and rate limiting are enabled

## Next Steps

1. Review `SETUP.md` for complete installation and security guidance.
2. Configure `.env` with your MongoDB connection and secrets.
3. Create the initial admin user in MongoDB.
4. Run `node server.js` or `docker-compose up`.
5. Open `http://localhost:5000` in your browser.

## Support

For setup issues, review `SETUP.md` and confirm environment values. If MongoDB connection fails, verify `MONGODB_URI` and that MongoDB is running.
