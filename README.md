# ServiceMate — Local Service Booking Marketplace

ServiceMate is a full-stack local service booking web application built with React, TypeScript, Tailwind CSS, Express, and SQLite (`better-sqlite3`). Customers can discover local professionals (plumbers, electricians, home cleaners, tutors, and appliance repair technicians), compare prices and ratings, book open time slots, reschedule or cancel bookings, and leave reviews after completed visits. Service providers can manage their profiles, services, availability slots, and booking requests, while platform administrators have a protected Admin Area.

> **Demo Notice:** All seeded providers, bookings, and reviews are fictional sample data. Payment processing, email/SMS notifications, map geocoding, and identity/license verification are not connected in this demo build.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite
- **Backend:** Node.js, Express 4, Zod validation, `tsx`
- **Database:** SQLite (`better-sqlite3`) with WAL mode, foreign keys, and atomic transactions
- **Auth & Security:** Per-user salted `scrypt` password hashing, HMAC-SHA256 Bearer tokens held in memory, parameterized SQL queries, role-based access control (`customer`, `provider`, `admin`), and partial unique booking indexes to prevent double-booking

---

## Quick Start & Exact Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional for Local Dev)
Copy `.env.example` to `.env` if you want to customize `PORT`, `SESSION_SECRET`, `ADMIN_PASSCODE`, or `DATABASE_PATH`:
```bash
cp .env.example .env
```

### 3. Initialize Database Schema & Seed Sample Data
```bash
npm run db:init
npm run db:seed
```
*(To wipe and re-seed sample data from scratch, run `npx tsx src/db/seed-cli.ts --force`. Note that `server.ts` also runs migrations and seeds automatically on first launch if the database is empty.)*

### 4. Start the Backend & Frontend Server
**Development mode (Express API + Vite middleware on port 3000):**
```bash
npm run dev
```

**Production build & run:**
```bash
npm run build
npm start
```

Open `http://localhost:3000` in your browser.

---

## Demo Accounts

You can register your own customer or provider account, or use the seeded sample accounts (also available via one-click quick-fill buttons on the Sign In screen):

| Role | Email | Password |
| :--- | :--- | :--- |
| Customer (Aarav Mehta) | `customer@servicemate.demo` | `CustomerDemo123!` |
| Customer (Priya Nair) | `priya@servicemate.demo` | `CustomerDemo123!` |
| Provider (Rajesh Sharma · Plumbing) | `rajesh@servicemate.demo` | `ProviderDemo123!` |
| Provider (Kavitha Iyer · Electrical) | `kavitha@servicemate.demo` | `ProviderDemo123!` |
| Provider (Lakshmi Devi · Cleaning) | `lakshmi@servicemate.demo` | `ProviderDemo123!` |
| Provider (Ananya Rao · Tutoring) | `ananya@servicemate.demo` | `ProviderDemo123!` |
| Provider (Vikram Kulkarni · Appliance) | `vikram@servicemate.demo` | `ProviderDemo123!` |

### Admin Access
- **If `ADMIN_PASSCODE` is set** in `.env`, the Admin tab prompts for that passcode.
- **If `ADMIN_PASSCODE` is unset**, the first visitor to the **Admin** tab sees a one-time **First-Run Admin Setup** form to claim the initial administrator email and password. Once claimed, setup locks permanently and requires signing in with those credentials.
- Ordinary `customer` and `provider` accounts are blocked (`403 Forbidden`) from all `/api/admin/*` endpoints.

---

## Database Schema (`src/db/schema.sql`)

1. `users` — customer, provider, and admin accounts with salted `scrypt` password hashes
2. `categories` — service categories (`plumbing`, `electrical`, `cleaning`, `tutoring`, `appliance-repair`)
3. `provider_profiles` — display/business details, bio, service area, city, delivery mode, and active status
4. `services` — provider service offerings with price (cents), duration (minutes), and delivery mode
5. `availability_slots` — provider date/time windows with `is_booked` and `is_blocked` flags and `UNIQUE(provider_id, slot_date, start_time)`
6. `bookings` — booking requests with unique `reference_code` (`SM-XXXXXX`), status lifecycle (`pending`, `confirmed`, `completed`, `cancelled`, `declined`), and partial unique index `idx_unique_active_booking` preventing double-bookings
7. `reviews` — 1–5 star ratings and comments linked to completed bookings

---

## API Overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/admin/status`, `POST /api/auth/admin/claim`, `POST /api/auth/admin/login`
- **Marketplace:** `GET /api/categories`, `GET /api/providers`, `GET /api/providers/:id`, `GET /api/providers/:id/availability`
- **Bookings & Reviews:** `GET /api/bookings`, `POST /api/bookings`, `PATCH /api/bookings/:id/reschedule`, `PATCH /api/bookings/:id/cancel`, `PATCH /api/bookings/:id/status`, `POST /api/reviews`
- **Provider Portal:** `GET /api/provider/dashboard`, `PUT /api/provider/profile`, `POST /api/provider/services`, `PUT /api/provider/services/:id`, `DELETE /api/provider/services/:id`, `POST /api/provider/availability`, `PATCH /api/provider/availability/:id`, `DELETE /api/provider/availability/:id`
- **Admin Portal:** `GET /api/admin/overview`, `PATCH /api/admin/users/:id`, `PATCH /api/admin/providers/:id`, `POST /api/admin/categories`, `PUT /api/admin/categories/:id`

---

## Remaining Setup Before Public Deployment

1. Set a strong random `SESSION_SECRET` and `ADMIN_PASSCODE` in production environment variables.
2. Configure HTTPS/TLS termination and persistent disk storage (or migrate SQLite to a managed database) so `data/servicemate.db` persists across container restarts.
3. Integrate real payment processing (e.g., Stripe), transactional email/SMS confirmations, and provider license/identity verification if offering live commercial bookings.
