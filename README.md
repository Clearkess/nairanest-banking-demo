# NairaNest

Modern digital banking interface and early full-stack foundation.

## Current status
This is a development preview, NOT a licensed bank or production-ready financial service. Registration and authentication routes require PostgreSQL. New customers and accounts are created in PENDING status. The authenticated `/dashboard` reads the signed-in customer's posted ledger entries; the public homepage remains a clearly labelled visual preview with illustrative figures. Internal transfers are denied unless both parties have ACTIVE accounts and VERIFIED KYC.

## Stack
- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
- PostgreSQL + Prisma
- bcrypt password hashing and opaque server-side sessions

## Local setup
1. Use Node.js 20.9 or newer.
2. Copy .env.example to .env and configure PostgreSQL.
3. Install dependencies with npm install.
4. Run npx prisma generate.
5. Run npx prisma migrate dev --name initial.
6. Start with npm run dev.

## API routes
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/transfers/internal

Registration requires fullName, email and a 12+ character password with uppercase, lowercase and a number. Optional phone is accepted. Authentication uses HttpOnly, SameSite=Strict cookies; sessions are stored as SHA-256 token hashes. Mutating routes reject cross-origin requests. Transfers use integer minor units, idempotency keys, a serializable database transaction and debit/credit entries.

## Critical production work still required
- Add email verification, MFA/passkeys, password reset, session rotation and security event logging. Distributed Upstash sliding-window rate limits are implemented for login, registration and internal transfers; configure the Upstash credentials before production.
- Add verified KYC/AML and sanctions-screening provider workflows; create audited staff approval controls.
- Add database constraints and tests for ledger invariants, concurrency and reconciliation. Prove balance locking/serialization under load.
- Integrate a licensed bank/payment institution in its sandbox, verify signed webhooks, implement settlement/reconciliation, reversals, fees, limits and provider idempotency.
- Add card issuing through a licensed provider and never store PAN/CVV.
- Add privacy controls, retention/deletion workflows, backups, monitoring, incident response, penetration testing and regulatory/legal approval.
- Configure distributed rate limiting before exposing authentication endpoints publicly.

Never use demo credentials, sample balances or illustrative dashboard transactions as real customer data. Do not accept deposits or enable live transfers until compliance, provider, operational and security work has been completed and independently tested.
