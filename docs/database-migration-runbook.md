# Kezza database migration runbook

## Current execution status

**Migrations through `c5f760a25687` have been applied to the local `kezza_db` database.** The earlier runbook status is superseded by this record.

| Item | Verified status |
|---|---|
| Database | `kezza_db` on local PostgreSQL `127.0.0.1:5432` |
| Database role | `kezza_user` |
| Previous revision | `a89c31bdf721` |
| Applied revision | `c5f760a25687 (head)` |
| Backup | Custom-format dump created and archive listing validated before the admin migration |
| Post-migration schema | Financial columns, three commission tiers, admin role constraint, and point/commission audit foreign keys verified |
| Model-to-schema check | `alembic check`: no new upgrade operations detected |
| Backend tests | `python -m unittest discover -s app/tests -v`: 16 tests passed, including admin authorization, Agent OTP login, referral attribution locking, and the full referral-to-reward journey |
| Mobile lint | `npx expo lint`: passed |
| TypeScript | `npx tsc --noEmit`: passed |
| Android JavaScript bundle | `npx expo export --platform android`: passed; Metro bundled 1,758 modules |
| Android device test | Not yet confirmed on the physical Android phone |
| API server / Expo Metro | Run locally when performing Expo Go device testing; see the setup steps in README |

Backup location:

```text
~/Desktop/kezza-db-backups/kezza_db_before_admin_console_20261113_172625.dump
```

The backup is the recovery copy. Keep it unchanged and outside the repository.

## Migration contents

- Preserves the initial migration and advances the existing revision chain.
- Renames the old commission tier table to `commission_tiers_legacy`; creates the current `commission_tiers` table with 1%, 2%, and 3% thresholds at 0, 4, and 10 eligible direct agents.
- Renames payment and commission amount columns to `amount_minor_units` without changing stored integers. New INR payment values are paise; historical ZAR values remain cents and retain their currency.
- Adds payment refund metadata, commission tier snapshots, points policy versions, and linked reversal references.
- Existing points rows are labeled `legacy_zar_v1`; newly generated points use `inr_v1`.
- The admin migration adds a constrained `users.role`, backfills existing agent and patient roles, and adds administrator references to manual point grants and commission approvals.
- Admin APIs list and approve eligible pending commissions and grant patient points with a required reason. These writes are backend-only and ledger-audited.

The migration changes schema and defaults. Points, treatment credit, payment verification, and commission calculations are enforced by backend services; they are not calculated by PostgreSQL defaults.

## Financial contract after migration

- Trusted payment requests submit `amount_rupees` to `POST /api/v1/payments/verify-collected` after an external payment source confirms collection.
- New INR transactions are stored in integer paise and exposed as `amount_minor_units` in API responses.
- One eligible rupee earns one point; 25 points convert to ₹1 treatment credit.
- Agent commission uses the eligible active direct-agent tier and is capped at 10%.
- Duplicate payment references are rejected. Refunds append linked points and commission reversal rows; they do not erase the original financial records.
- The patient app cannot set payment, points, or commission balances. Keep `PAYMENT_VERIFICATION_API_KEY` on the backend or trusted payment integration.

## Repeatable verification commands

Run from the repository root:

```bash
cd backend
.venv/bin/alembic current
.venv/bin/alembic heads
.venv/bin/alembic check
.venv/bin/python -m unittest discover -s app/tests -v
```

Expected Alembic result: `c5f760a25687 (head)` and “No new upgrade operations detected.” The test suite must use test fixtures or an isolated database, never production financial data.

The Android export validates the JavaScript bundle; it does not install a native Android package or prove that the phone can reach the API over Wi-Fi. `expo-doctor` is not installed in this checkout; its `npx` invocation did not produce output, so that optional diagnostic remains unverified.

## Recovery guidance

Do not downgrade after new financial activity has been recorded. Downgrade removes refund, reversal, policy-version, and commission audit metadata. Treat the validated dump as the recovery point and plan restoration with the database owner if needed; do not improvise a restore over the active database.

## Deployment status and remaining prerequisites

The database migration is complete, but production deployment is not. Before a production release:

1. Select and provision a backend host and production PostgreSQL database, with HTTPS, backups, restricted access, and managed secrets.
2. Configure a real OTP/SMS delivery provider; production OTP delivery is currently unavailable.
3. Select the permanent Android package name and/or iOS bundle identifier, configure an Expo project owner/project ID, and create EAS build profiles. The repository has no `eas.json` or store identifiers yet.
4. Set the mobile public API URL to the production HTTPS endpoint. Do not put secrets in `EXPO_PUBLIC_*` values.
5. Connect the trusted POS/payment provider. The mobile app must never be considered proof of collected payment.
6. Test the full referral-to-payment-to-reward journey in staging with an isolated database, then distribute an internal Android build for device testing before app-store release.

For current Expo SDK and build instructions, see the [SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/), [production build guide](https://docs.expo.dev/deploy/build-project/), and [EAS configuration reference](https://docs.expo.dev/eas/json/).
