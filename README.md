# Company Registration App

A tenant-aware employee attendance and admin dashboard application built with Node.js, Express, MongoDB, and JWT authentication.

## Features

- Employee clock-in/clock-out tracking
- Attendance history and date filtering
- Admin employee management
- Audit log tracking and export support
- Archival support and selecting
- Tenant-aware authorization with `Company` model
- Security hardening with Helmet, CORS, rate limiting, and input sanitization

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 10 or later
- MongoDB running locally or accessible remotely

### Install Dependencies

```bash
npm install
```

### Environment Setup

Copy the example environment file:

```bash
copy .env.example .env
```

Edit `.env` with your settings:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/company-registration
JWT_SECRET=your-strong-random-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5000
BCRYPT_SALT_ROUNDS=12
NODE_ENV=development
```

### Run the App

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

Open the app in your browser:

```text
http://localhost:5000
```

## Scripts

- `npm start` — start the server
- `npm run dev` — start with nodemon

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
- `DELETE /api/employees/:id`
- `GET /api/employees/audit`
- `GET /api/employees/audit/archive`

### Attendance

- `POST /api/attendance/record`
- `GET /api/attendance/history`
- `GET /api/attendance/date/:date`
- `GET /api/attendance/admin/all`

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
4. Run `npm start` or `npm run dev`.
5. Open `http://localhost:5000` in your browser.

## Support

For setup issues, review `SETUP.md` and confirm environment values. If MongoDB connection fails, verify `MONGODB_URI` and that MongoDB is running.
