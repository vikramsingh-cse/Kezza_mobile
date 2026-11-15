# Kezza mobile MVP

Kezza is an Expo/React Native mobile client backed by FastAPI and PostgreSQL. The first end-to-end journey is agent referral → patient OTP registration → locked referral attribution → trusted payment verification → patient points and agent commission → patient and agent wallet views.

## Current implementation status

- Local PostgreSQL database: `kezza_db`.
- Applied Alembic revision: `c5f760a25687`.
- Financial rules use INR for new activity and preserve historical currency and policy labels.
- Backend business logic and the matching mobile wallet fields are in the repository.
- Admin console supports pending commission approvals and audited patient point grants.
- The local backend and automated test workflow are documented below.
- Production hosting, production OTP delivery, and app-store deployment are not configured yet. See [Release readiness](#release-readiness).

## Local setup

### Configure the mobile API URL

Copy `.env.example` to the ignored root `.env` and set `EXPO_PUBLIC_API_URL` to the Mac's current Wi-Fi address:

```text
EXPO_PUBLIC_API_URL=http://<MAC_WIFI_IP>:8000/api/v1
```

Do not use `localhost` on Android: it points to the phone. The phone and Mac must be on the same Wi-Fi network, and FastAPI must listen on `0.0.0.0`. Expo inlines `EXPO_PUBLIC_*` values into the app bundle, so never put credentials or private keys in them. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

### Configure the backend

Use `backend/.env.example` as the variable reference and create `backend/.env` for local credentials. Set `APP_ENV=development` only on a developer machine to enable the development OTP. Production OTP delivery is not implemented until a real provider is configured. Keep `JWT_SECRET`, database credentials, and `PAYMENT_VERIFICATION_API_KEY` out of Git and Expo public variables.

The active local database is `kezza_db` on PostgreSQL at `127.0.0.1:5432`, using the credentials configured in the ignored backend/root environment file. Never print or commit those files.

### Start the backend and mobile app

Terminal 1:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Terminal 2, from the repository root:

```bash
npx expo start
```

Open the development app on the Android phone and verify the API URL is reachable. See [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) for SDK-specific guidance.

Unauthenticated users start at the account chooser. Patient and Agent / Partner have separate sign-in paths; the chosen role remains fixed through OTP verification and account creation. Administrator sign-in stays separate.

Agent referral links are created on the device with Expo Linking so they match the running app: Expo Go links open the current development session, while installed app builds use the `kezzamobile` scheme. The link opens Patient sign-in and carries the agent code into registration. For use without Expo Go or the installed app, a production HTTPS universal link still needs a Kezza domain and app-link configuration.

### Admin access

Admin accounts are provisioned from the backend terminal; public patient and agent registration cannot create an administrator. From `backend`, with the virtual environment active, create an admin using the intended phone number in E.164 format:

```bash
python -m app.admin_cli --phone +91XXXXXXXXXX --name "Kezza Admin"
```

Use `--promote-existing` only when you deliberately want to grant administrator access to a phone that already belongs to a patient or agent. In the app, sign out if needed, choose **Administrator login** on the login screen, and verify the provisioned phone using OTP. Admin accounts open the Admin console, where admins can approve verified pending commissions and grant patient points with a required reason. Each action is recorded with the administrator's identity in the backend ledger. The admin screen and endpoints require an admin role.

## Financial and API contract

- The mobile app reads points and commission ledgers; it cannot write balances or commissions.
- A trusted POS/payment service calls `POST /api/v1/payments/verify-collected` only after confirming collection. It submits `amount_rupees` with up to two decimal places. The backend stores INR in integer paise and calculates all rewards and commission server-side.
- Payment and wallet responses use integer `amount_minor_units` fields. For INR, one rupee is 100 paise. Historical ZAR records retain their original currency and are still interpreted as cents.
- Each eligible ₹1 of payment earns 1 point. 25 points equal ₹1 of treatment credit.
- Commission tiers use eligible active direct agents: 1% base, 2% from 4 agents, and 3% from 10 agents; configured rates are capped at 10%.
- Duplicate payment references are rejected. Refunds keep original payments and ledger entries, then append linked points and commission reversals.
- Never expose the trusted payment key to the mobile app or an `EXPO_PUBLIC_*` variable.

## Database migrations

Keep the initial migration unchanged. Generate a new Alembic revision for each schema change, review the generated file manually, and back up a production database before applying it:

```bash
cd backend
.venv/bin/alembic current
.venv/bin/alembic heads
.venv/bin/alembic revision --autogenerate -m "describe schema change"
# Review migrations/versions/<new_revision>.py before applying.
.venv/bin/alembic upgrade head
.venv/bin/alembic check
```

Autogeneration is a candidate, not a guarantee; review data migrations, constraints, indexes, and downgrade behavior. The migration and its verified execution state are recorded in [the database runbook](docs/database-migration-runbook.md).

## Verification

Run the existing backend suite and the required mobile static checks:

```bash
cd backend
.venv/bin/python -m unittest discover -s app/tests -v
.venv/bin/alembic current
.venv/bin/alembic check

cd ..
npx expo lint
npx tsc --noEmit
```

The mobile checks need to pass before a build is created. Run backend integration tests against an isolated test database or the project's test fixtures; do not point test code at production data.

## Release readiness

This checkout is currently set up for local development and testing, not a production release. Before deploying:

1. Choose and provision a backend host and production PostgreSQL instance. Configure HTTPS, backups, network restrictions, and production secrets there.
2. Integrate a real OTP/SMS provider. Production OTP requests currently return unavailable without one.
3. Choose the Android package name and/or iOS bundle identifier and associate the app with the correct Expo account/project. This repository currently has no `eas.json`, app-store identifiers, or linked EAS project.
4. Configure a production `EXPO_PUBLIC_API_URL` that points to the HTTPS backend. It is public app configuration, not a secret.
5. Connect a trusted POS/payment source to the payment verification endpoint. Do not let the patient app claim that a payment was collected.
6. Run staging tests using a separate database, then build and install an internal Android package before app-store submission.

Expo's current build and release workflow is described in [Build your project for app stores](https://docs.expo.dev/deploy/build-project/) and [EAS configuration](https://docs.expo.dev/eas/json/). Store signing and submission also require the relevant Expo and app-store account access.
