# Kezza mobile MVP

Kezza is an Expo/React Native client backed by FastAPI. The first complete journey covers phone verification, referral attribution, treatment payment records, patient points, agent commission, and both account views.

## Local Android and API setup

The Android phone and Mac must be on the same Wi-Fi network. Android's `localhost` points back to the phone, not to the Mac.

1. Find the Mac's current Wi-Fi address:

   ```bash
   ipconfig getifaddr en0
   ```

2. Set `EXPO_PUBLIC_API_URL` in the ignored root `.env` file to `http://<MAC_WIFI_IP>:8000/api/v1`. The current local `.env` uses `192.168.1.67`; update it if the Mac's address changes.

3. Keep backend credentials in an ignored `.env` file. See [backend/.env.example](backend/.env.example) for variable names. Local OTP mode is enabled only with `APP_ENV=development`; production OTP requests return unavailable until an SMS/OTP provider is configured. Never commit `.env` files or paste secrets into source code.

4. Start FastAPI from the `backend` directory, bound to all interfaces so the phone can reach it:

   ```bash
   cd backend
   .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

5. In a second terminal, start Expo:

   ```bash
   npx expo start
   ```

## Payment and ledger integrity

- The mobile app can read points and commission ledgers but cannot write them.
- A trusted POS/payment integration calls `POST /api/v1/payments/verify-collected` with `X-Payment-Verification-Key` only after confirming collection. Keep that key on the backend or trusted integration; never add it to `EXPO_PUBLIC_*` variables.
- Refunds call `POST /api/v1/payments/{payment_id}/refund` through the same trusted integration. Original payments and ledger entries remain in history; refund events append points and commission reversal entries.
- Amounts are calculated in integer cents. API amounts are validated to two decimal places.

## Database migrations

Keep the initial migration unchanged. For every schema change, generate a new Alembic revision, review the candidate migration manually, then apply it:

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "describe schema change"
# Review migrations/versions/<new_revision>.py before applying.
.venv/bin/alembic upgrade head
```

Autogeneration is a starting point and may miss data migrations, constraints, or backend-specific details.
