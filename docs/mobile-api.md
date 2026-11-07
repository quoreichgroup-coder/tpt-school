# Mobile API v1

Base URL: `https://<school-host>/api/v1`. All endpoints return JSON. Protected
routes require `Authorization: Bearer <accessToken>`. Invalid input returns 400,
expired/revoked credentials return 401, and explicit role checks return 403.
Class routes return 404 for both missing and inaccessible classes. Login can
return 429 when rate limited.

## Authentication

- `POST /auth/login` accepts `{ "email": "...", "password": "..." }`. It
  returns `accessToken`, `expiresIn` (3600 seconds), `refreshToken`, and a
  minimal user profile. Invalid input returns 400, bad credentials 401, and
  rate limited attempts 429. Accountant accounts are web-only; login returns
  403 so finance access stays in the web app.
- `GET /auth/me` returns the authenticated user's minimal profile.
- `POST /auth/refresh` accepts `{ "refreshToken": "..." }`, revokes that
  refresh token, and returns a new access/refresh token pair. Refresh tokens
  rotate and expire 30 days after issue; access tokens expire after one hour.
- `POST /auth/logout` accepts the current refresh token and revokes its session.
  The mobile app clears local tokens even if the network is unavailable; in
  that case the server session expires naturally.

Tokens are stored on-device with Expo SecureStore. The app retries one request
after a 401 using a shared refresh operation. A temporary network or 5xx error
does not erase stored tokens; a 400/401 refresh response clears them. All tokens
are invalidated if `AUTH_SECRET` is rotated. Keep that secret at least 32
characters and server-side only.

## Family and student portal

`GET /portal` is limited to student and parent accounts. Students receive their
own record; parents receive only linked students. Each student entry includes
active classes, recent attendance, current-term grades and weighted averages,
approved/published report cards with subject averages, weekday timetable, and
upcoming published exams. Visible notices are filtered by role, year, publish
date, and expiry. The response omits medical, billing, and contact data.

## Teacher and admin workflows

- `GET /teacher/classes` returns class rosters. Teachers see only assigned
  classes; admins see all classes.
- `GET /teacher/classes/:classId/attendance?date=YYYY-MM-DD` returns the active
  roster and attendance for that date; invalid calendar dates return 400. `POST` accepts `{ "date": "YYYY-MM-DD",
  "records": [{ "studentId": "<student record id>", "status": "present" }] }`.
  Status values are `present`, `absent`, `late`, or `excused`; dates must fall
  within a configured term and students must be actively enrolled.
- `GET /teacher/classes/:classId/gradebooks` returns active students and
  non-cancelled gradebooks, including scores, max score, coefficient, and term.
  `POST` accepts `{ "gradebookId": "...", "records": [{ "studentId": "<student
  record id>", "score": 12.5 }] }`. Scores must be between zero and the
  gradebook maximum. Writes are limited to the class teacher or an admin;
  cancelled exam gradebooks reject writes with 409.

For both teacher workflows, `studentId` in submitted records is the internal
student record ID returned by the roster, not the school's displayed student
number. Attendance and grade writes update existing records for the same date
or assessment.
