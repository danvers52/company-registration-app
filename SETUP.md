# Company Registration App — Setup & Security Guide

## Overview
This application is a tenant-aware attendance and employee management system. It uses Node.js, Express, MongoDB, JWT authentication, and a browser-based Admin/Employee frontend.

## Project Structure

```text
Company Registration App/
├── public/
│   ├── index.html          # Frontend HTML
│   ├── styles.css          # CSS styling
│   └── script.js           # Browser JavaScript
├── routes/
│   ├── auth.js             # Authentication and user management
│   ├── employees.js        # Employee and audit APIs
│   ├── attendance.js       # Attendance APIs
│   └── export.js           # Excel export APIs
├── models/
│   ├── Employee.js         # Employee schema
│   ├── Attendance.js       # Attendance schema
│   ├── AuditLog.js         # Audit logs schema
│   ├── AuditLogArchive.js  # Archived audit logs
│   └── Company.js          # Tenant company schema
├── utils/
│   ├── config.js           # Environment and security config
│   ├── tenant.js           # Tenant resolution helpers
│   ├── validators.js       # Request validation helpers
│   └── auditArchival.js    # Audit archiving utilities
├── server.js               # Express server entry point
├── package.json            # Dependencies and scripts
├── .env.example            # Example environment variables
├── SETUP.md                # This guide
└── .gitignore              # Git ignore rules
```

## Prerequisites

Choose your setup method:

### Option 1: Local Development Setup

- Node.js 18+ installed
- npm 10+ installed
- MongoDB running locally or accessible via connection string

### Option 2: Docker Setup (Recommended)

- Docker 20.10 or later
- Docker Compose 2.0 or later
- No need for local Node.js or MongoDB installation

## Installation

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
copy .env.example .env
```

3. Open `.env` and configure values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/company-registration
JWT_SECRET=your-strong-random-secret-here
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5000
BCRYPT_SALT_ROUNDS=12
NODE_ENV=development
```

## Recommended Production Configuration

- Use a strong 32+ character `JWT_SECRET`
- Set `NODE_ENV=production`
- Use HTTPS and secure host configuration
- Avoid committing `.env` to source control
- Use a managed secrets store if available

## Running the App

Start the server:

```bash
npm start
```

For development with auto-reloading:

```bash
npm run dev
```

Open the app in your browser:

```text
http://localhost:5000
```

## Docker Setup & Deployment

### Quick Start with Docker Compose

The fastest way to get started:

```bash
docker-compose up
```

This command:
- Builds the Node.js app container
- Starts a MongoDB container
- Sets up networking between services
- Exposes the app on `http://localhost:5000`
- Exposes MongoDB on `mongodb://localhost:27017`

### Docker Compose Services

**app Service:**
- Runs Node.js application on port 5000
- Depends on MongoDB service
- Uses environment variable `MONGO_URI=mongodb://mongo:27017/company-registration`

**mongo Service:**
- Runs MongoDB 6 image
- Persists data in containers (not preserved between `docker-compose down`)
- Accessible at `mongodb://mongo:27017` from app container
- Accessible at `mongodb://localhost:27017` from host machine

### Common Docker Compose Commands

**Start Services:**

```bash
# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# Rebuild images before starting
docker-compose up --build
```

**Stop Services:**

```bash
# Stop containers (preserve volumes)
docker-compose stop

# Stop and remove containers and networks
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

**View Status & Logs:**

```bash
# List running containers
docker-compose ps

# View logs from all services
docker-compose logs

# View logs from specific service
docker-compose logs app
docker-compose logs mongo

# Follow logs in real-time
docker-compose logs -f

# View last 50 lines
docker-compose logs --tail=50
```

**Manage Containers:**

```bash
# Execute command in running container
docker-compose exec app npm run dev

# Shell access to app container
docker-compose exec app sh

# Rebuild specific service
docker-compose build app
```

### Environment Variables for Docker

The MongoDB connection is automatically configured in Docker:

```env
MONGO_URI=mongodb://mongo:27017/company-registration
```

You can override other environment variables by:

1. Creating a `.env` file in the project root
2. Modifying the `environment` section in `docker-compose.yml`
3. Passing `-e` flags with `docker-compose run`

Example `.env` file:

```env
NODE_ENV=production
JWT_SECRET=your-strong-random-secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5000
BCRYPT_SALT_ROUNDS=12
PORT=5000
```

### Dockerfile Details

The application uses a multi-stage optimized Dockerfile:

- **Base Image:** Node.js 18-alpine (lightweight)
- **Working Directory:** `/app`
- **Exposed Port:** 5000
- **Entry Point:** `npm start`

The Dockerfile:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Port Mappings

| Service | Container Port | Host Port | Purpose |
|---------|----------------|-----------|---------|
| app     | 5000           | 5000      | Web Application |
| mongo   | 27017          | 27017     | MongoDB Database |

### Data Persistence

**Important:** By default, Docker containers don't persist data between runs. To persist MongoDB data, modify `docker-compose.yml`:

```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    depends_on:
      - mongo
    environment:
      - MONGO_URI=mongodb://mongo:27017/company-registration
  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

Then run:

```bash
docker-compose up
```

### Troubleshooting Docker

**Port Already in Use:**

```bash
# Change port mappings in docker-compose.yml
# For example, change "5000:5000" to "5001:5000"
```

**Container Crashes:**

```bash
# Check logs
docker-compose logs app

# Restart container
docker-compose restart app
```

**MongoDB Connection Issues:**

```bash
# Ensure mongo service is running
docker-compose ps

# Rebuild and restart
docker-compose down
docker-compose up --build
```

**Clean Up Everything:**

```bash
# Remove all containers, networks, and volumes
docker-compose down -v

# Remove dangling images
docker image prune
```

## Creating an Initial Admin Account

If no admin account exists, create one using the 'Admin Registration' link on sign-up or 
create one directly in MongoDB.

### Example using Node.js or Mongo shell:

```js
const bcrypt = require('bcrypt');
const hashedPassword = bcrypt.hashSync('admin123', 12);

db.employees.insertOne({
  name: 'Admin User',
  email: 'admin@company.com',
  password: hashedPassword,
  role: 'admin',
  company: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

> Replace `admin123` with a secure password before using this in production.

## Environment Variables

- `PORT` — server port
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JSON Web Token secret
- `JWT_EXPIRES_IN` — token expiration (example: `24h`)
- `CORS_ORIGIN` — allowed browser origin
- `BCRYPT_SALT_ROUNDS` — bcrypt hash cost, minimum `12`
- `NODE_ENV` — `development` or `production`

## API Endpoints

### Authentication
- `POST /api/auth/login` — login
- `POST /api/auth/register` — register employee (admin only)
- `GET /api/auth/me` — get current authenticated user
- `POST /api/auth/logout` — logout

### Employee Management
- `GET /api/employees` — list company employees (admin only)
- `GET /api/employees/:id` — get employee by ID
- `PUT /api/employees/:id` — update employee profile
- `DELETE /api/employees/:id` — remove employee (admin only)
- `GET /api/employees/audit` — active audit logs (admin only)
- `GET /api/employees/audit/archive` — archived audit logs (admin only)

### Attendance
- `POST /api/attendance/record` — record attendance
- `GET /api/attendance/history` — user attendance history
- `GET /api/attendance/date/:date` — date-specific attendance
- `GET /api/attendance/admin/all` — all company attendance (admin only)

### Export
- `GET /api/export/employees` — export employee list
- `GET /api/export/audit` — export audit log

## Security Features

This app includes:

- JWT authentication with configurable expiry
- Bcrypt password hashing
- Helmet HTTP headers
- CORS origin restrictions
- Rate limiting on auth and global routes
- HTTP parameter pollution prevention
- MongoDB query sanitization
- Request body size limits
- Tenant-aware authorization via `Company` model

## Testing

Use Postman, Thunder Client, or curl.

Example login request:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}'
```

## Troubleshooting

### MongoDB Connection Error
- Verify MongoDB is running
- Confirm `MONGODB_URI` is correct
- Ensure the connection string is valid

### Port Already In Use
- Change `PORT` in `.env`
- Stop the conflicting process

### Token / Auth Failures
- Verify `JWT_SECRET` matches between environments
- Check that tokens are not expired

## Next Steps

1. Install dependencies
2. Configure `.env`
3. Create initial admin account
4. Start the server
5. Open the app in browser
6. Login and configure company users

## Future Enhancements

- HTTPS enforcement in production
- Refresh token support
- Role-based permission expansion
- Mobile-responsive UI improvements
- Integration tests and CI validation
- Email or SMS notifications
- Biometric integration 

## Notes

Keep this guide updated when configuration or security behavior changes. Use environment variables for all secrets and deploy with best-practice security settings.
