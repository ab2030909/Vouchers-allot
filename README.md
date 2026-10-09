# Hacktoberfest Islamabad — Kiro Voucher Claim Portal

An enterprise-grade, atomic, high-concurrency web application for distributing exclusive **Kiro voucher redemption links** to registered attendees of **Hacktoberfest Islamabad**.

Built with **Next.js (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **PostgreSQL (Neon)** with robust row locking and database transactions.

---

## 🌟 Primary Capabilities & Security Features

- **Strict 1-to-1 Voucher Allocation**: Guarantees exactly one voucher per registered attendee, and at most one attendee per voucher.
- **Atomic Concurrency Guarantee**: Employs PostgreSQL row-level locking (`SELECT ... FOR UPDATE SKIP LOCKED`) inside isolation transactions to eliminate race conditions under concurrent load.
- **WhatsApp Phone Normalization**: Automatically normalizes Pakistani formats (`03001234567`, `+923001234567`, `923001234567`, `0300-1234567`) to canonical `923XXXXXXXXX` E.164 strings.
- **Organizer Dashboard (`/admin`)**: Live telemetry metrics (Attendees, Vouchers, Claimed, Remaining, Unclaimed Eligible), searchable claim history, UTF-8 CSV exporter, and claim revocation tools.
- **Protected CSV Imports**: Organizer file uploads with pre-import validation, duplicate detection (in-file & database conflicts), and UTF-8 BOM stripping.
- **Security & Privacy**: HTTP-only SameSite admin session cookies, JOSE JWT validation, sliding-window rate limiting, input sanitization, CSRF defenses, and zero sensitive data leakage in public APIs.

---

## 🗄 Relational Database Schema

### `attendees`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique attendee ID |
| `name` | VARCHAR(255) | NOT NULL | Registered attendee full name |
| `whatsapp_number` | VARCHAR(30) | UNIQUE, NOT NULL | Normalized phone number (`923XXXXXXXXX`) |
| `created_at` | TIMESTAMPTZ | DEFAULT `NOW()` | Registration timestamp |

### `vouchers`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique voucher ID |
| `redeem_url` | TEXT | UNIQUE, NOT NULL | Kiro redemption URL |
| `status` | VARCHAR(20) | CHECK (`status IN ('available', 'claimed')`) | Inventory state |
| `claimed_by` | UUID | FK `attendees(id)` ON DELETE SET NULL | Assigned attendee |
| `claimed_at` | TIMESTAMPTZ | Nullable | Claim timestamp |

### `claims`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Claim record ID |
| `attendee_id` | UUID | UNIQUE, FK `attendees(id)` ON DELETE CASCADE | 1-to-1 attendee mapping |
| `voucher_id` | UUID | UNIQUE, FK `vouchers(id)` ON DELETE CASCADE | 1-to-1 voucher mapping |
| `claimed_at` | TIMESTAMPTZ | DEFAULT `NOW()` | Audit claim timestamp |
| `ip_address` | VARCHAR(45) | Nullable | Request IP address |
| `user_agent` | TEXT | Nullable | Client user agent |

### `admin_sessions` & `audit_logs`
- `admin_sessions`: Hashed session tokens (`token_hash` UNIQUE), expiration timestamps, secure rotation.
- `audit_logs`: Administrative actions, IP addresses, JSON details, timestamped telemetry.

---

## 🚀 Quick Local Development Setup

### 1. Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+`

### 2. Clone & Install
```bash
git clone <repository-url>
cd hacktoberfest-kiro-voucher-portal
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Configure your environment variables in `.env.local`:
```env
DATABASE_URL="postgresql://neondb_owner:your_neon_password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
ADMIN_PASSWORD="YourStrongAdminPassword2026!"
SESSION_SECRET="super-secret-at-least-32-chars-long-random-string!"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 4. Initialize Database Schema
To execute database schema migrations against your Neon PostgreSQL instance:
```bash
npm run db:init
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

The repository features a complete automated unit and integration test suite using **Vitest** with an in-memory PostgreSQL engine (`pg-mem`).

Run all tests:
```bash
npm test
```

### Verified Test Suites:
- `tests/phone.test.ts`: Pakistani local & international number normalization, equivalent string mapping, invalid format rejection.
- `tests/csv.test.ts`: Attendee & voucher CSV parsing, UTF-8 BOM handling, header transformation, duplicate rejection.
- `tests/auth.test.ts`: Admin password validation, sliding window rate limiting.
- `tests/claim.test.ts`: Atomic voucher reservation, single claim per registered number, double-claim retry state recovery, inventory exhaustion, transaction isolation.

---

## 📦 Deployment Guide: Vercel & Neon PostgreSQL

### Step 1: Set Up Neon PostgreSQL
1. Create a project on [Neon.tech](https://neon.tech).
2. Create a new database branch (e.g. `main`).
3. Copy the **Pooled Connection String** (`postgresql://...`).

### Step 2: Initialize Database Schema on Neon
Run the initialization script pointing to your Neon database URL:
```bash
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/neondb?sslmode=require" npm run db:init
```

### Step 3: Deploy to Vercel
1. Import the repository into your [Vercel Dashboard](https://vercel.com).
2. Set Environment Variables in Vercel:
   - `DATABASE_URL`: Your Neon connection string
   - `ADMIN_PASSWORD`: Production admin password
   - `SESSION_SECRET`: Random 32+ character string
   - `NEXT_PUBLIC_BASE_URL`: `https://your-app.vercel.app`
3. Click **Deploy**.

---

## 📋 Pre-Event Operational Checklist

- [ ] **Database Migration Executed**: Confirm tables `attendees`, `vouchers`, `claims`, `admin_sessions`, `audit_logs` exist on Neon.
- [ ] **Attendees Imported**: Upload attendee CSV via `/admin` dashboard.
- [ ] **Vouchers Imported**: Upload voucher links CSV via `/admin` dashboard.
- [ ] **Verify Telemetry**: Verify `/admin` metrics show total registered attendees and imported vouchers.
- [ ] **Dummy Test Claim**: Test 1 claim using a test attendee number, verify link issuance, and revoke the test claim using the dashboard Revoke button.
- [ ] **Post-Event Export**: Export claim records CSV at the end of the event for organizer archiving.

---

## 📄 Sample CSV Data Templates

Sample CSV templates containing **fake data only** are provided in the repository:
- `sample_data/attendees_sample.csv`
- `sample_data/vouchers_sample.csv`

---

## 🔒 Security & Privacy Notice

- **Number Normalization**: Phone numbers are stored strictly in normalized E.164 string format.
- **Privacy Enforcement**: Public endpoints never reveal full voucher inventories or unassigned links.
