# Task Scheduler Backend

Express.js + Node.js + MySQL backend API for the Task Scheduler app.

## 1. Setup

1. Copy `.env.example` to `.env`
2. Update DB and JWT values
3. Install dependencies:

```bash
npm install
```

4. Create DB schema:

```bash
mysql -u root -p < sql/schema.sql
```

5. Run in development:

```bash
npm run dev
```

Server starts on `http://localhost:5000` by default.

## 2. API Base

- Base URL: `/api`
- Health: `GET /health`

## 3. Main Routes

- Auth: `/api/auth`
- Users: `/api/users`
- Projects: `/api/projects`
- Tasks: `/api/tasks`
- My Tasks: `/api/my-tasks`
- Comments: `/api/comments`
- Time Entries: `/api/time-entries`
- Dashboard: `/api/dashboard`

## 4. Security

- JWT auth via `Authorization: Bearer <token>`
- Password hashing via `bcryptjs`
- Request validation via `express-validator`
- Rate limiting on auth routes
- Helmet + CORS + request logging

## 5. Notes

- All responses follow standard success/error format.
- SQL operations use parameterized queries (`mysql2/promise`).
- Task reassignment uses a DB transaction.
