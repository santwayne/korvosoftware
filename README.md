# Korvo

Korvo (formerly **Royal Software**) is Wayne E Solutions' dealer and distributor management system. It covers a company's whole sales chain in one Android app and connects it to Tally. Korvo is half of **Bundle B (Growlane AI)**; the other half is Loyvexa, which adds loyalty.

```
backend/   Node.js + Express + MongoDB API   (from Wayneesolutions/royalSoftwareBackend, main @ 290fbe0)
app/       React Native / Expo Android app   (from Wayneesolutions/royalappfrontend, master @ 3c9ee8e)
```

## What's in it

- **Sales hierarchy:** company admin → zonal manager → RSM → ASM → sales officer → distributor/dealer → sub-dealer. One login, and each role gets its own dashboard and sees only its own team's data.
- **Orders and approvals:** single and bulk approve/reject, plus unapprove (also for orders already sent to Tally). Pending approvals include the creator's draft orders.
- **Tally sync:** vouchers, ledger and inventory entries, dealers/ledgers, products, stock, price lists, outstanding dues, sales and dispatch. Not tied to Tally only.
- **Ledger report:** running balance, correct Dr/Cr opening balance, sorting by date/type/bill number.
- **Targets and achievements** rolled up the hierarchy.
- **Bundle B / Loyvexa integration** (`backend/services/loyvexa.js`, `backend/routes/integrations/loyvexaRoute.js`):
  - Order approved / delivered / cancelled / returned → Loyvexa, which awards purchase points and runs the AI reorder model.
  - Dealers, products and overdue outstanding sync to Loyvexa nightly, which drives the AI payment reminders.
  - WhatsApp orders from Loyvexa come in through `POST /api/v1/orders/external`.
  - Hub provisioning: the Regulars "Products & Bundles" hub switches the brand on, with console sign-in.
  - Rewards tab in the app (`app/src/screens/dashboard/common/RewardsScreen.tsx`), using a 1-hour dealer token from `GET /api/v1/rewards/session`.

## Not renamed on purpose

These still say "royal". Renaming them would break the live app or the integration:

| What | Why it stays |
|---|---|
| `app/app.json` → `slug: royaltally`, `android.package: com.santkaur.royalsoftware`, EAS `projectId` | Changing them makes a new app on the Play Store and unlinks the EAS project |
| `API_BASE_URL=https://royalapp.wayneesolutions.com/api/v1` | The live server; change it only after a new domain is set up |
| MongoDB database names in scripts (`royalapp`, `royalsoftware`) | Existing data lives there |
| Loyvexa endpoint `/api/connect/royal` | It is Loyvexa's adapter name; it must match the Loyvexa side |
| Demo seed data brands ("Royal Paints") | Sample data only |

The user-facing name in the app, the API docs title and the package names are **Korvo**.

## Run

```bash
# backend
cd backend && npm install && npm start      # needs .env (MONGODB_URI, JWT secret, Loyvexa settings)

# app
cd app && npm install && npx expo start
# APK: see app/BUILD_SETUP_SUMMARY.md / build-production-apk.ps1
```

Loyvexa itself (the loyalty platform with AI, QR scan-to-earn and UPI payouts) lives in its own repo, `santwayne/loyvexa`.
