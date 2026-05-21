# Dentiplus

Dentiplus is a multi-user dental management portal built as a design sibling of Opticplus. This repository contains:

- `frontend/`: the React + Vite portal shell, role-aware dashboards, login screen, session-restore state, and reusable design system.
- `backend/`: a lightweight Laravel-style PHP API structure that connects to the provided `u363431941_edental` MySQL schema.

## Structure

```text
dentiplus/
  frontend/
  backend/
```

## Quick Start

1. Import `c:\Users\abida\Downloads\u363431941_edental (1).sql` into MySQL.
2. Copy `backend/.env.example` to `backend/.env` and set your database credentials.
3. Install frontend dependencies:
   - `cd frontend`
   - `npm install`
4. Start the frontend from the project root:
   - `npm run frontend`
5. Start the backend API from the project root:
   - `npm run backend`

Default local URLs:

- Frontend: `http://localhost:5176`
- Backend API: `http://127.0.0.1:8000/api/v1`

If you prefer, you can still run the frontend directly inside `frontend/` with `npm run dev`.

## API Notes

The API is organized with small Laravel-style layers:

- `app/Http/Controllers`
- `app/Support`
- `routes/api.php`
- `public/index.php`

Core endpoints included in this scaffold:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`
- `GET /api/v1/dashboard`
- `GET /api/v1/appointments`
- `GET /api/v1/patients`
- `GET /api/v1/billing`
- `GET /api/v1/messages`
- `GET /api/v1/staff`
- `GET /api/v1/settings`

## Schema Direction

Dentiplus is built around the imported eDental schema instead of a speculative replacement. The UI and API map directly to existing tables such as:

- `users`, `staff`, `staff_branches`, `sessions`
- `appointments`, `patients`, `patient_assignments`
- `clinical_details`, `medical_records`, `prescriptions`, `procedures`
- `billing_records`, `payments`, `payments_new`, `receipts`, `refunds`
- `expenses`, `health_insurance`
- `conversations`, `conversation_participants`, `messages`, `message_reads`, `message_templates`
- `settings`

## Frontend Themes

The shell intentionally mirrors the Opticplus family feel without copying optical workflows:

- full-height independent shell scrolling
- fixed desktop sidebar
- left drawer navigation on mobile
- dashboard hero surfaces
- branded session restore
- dense but polished operational layouts

## Current Scope

This first pass focuses on:

- brand-ready shell and design system
- multi-role dashboard experience
- schema-aware authentication/session bootstrap
- core data workspaces for appointments, patients, billing, messages, staff, and settings

It is ready to extend into deeper dental workflows without throwing away the current schema or shell.
