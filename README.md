# Expense Plus (For SARAVANA)

A high-performance, mobile-first, daily expense tracking Progressive Web App (PWA) built specifically for **SARAVANA** with **offline-first local persistence** and real-time **Neon PostgreSQL synchronization**.

---

## Features

- **Personalized for SARAVANA**: Zero login or authentication friction. Opens directly to your personal daily expense cockpit.
- **2-Page Architecture with Instant Logo Swap**:
  - **Expense Tracking Page**: Fast logging, daily spending strip, customizable fast shortcuts, and grouped transaction logs.
  - **Analytics & Dashboard Page**: Monthly budget progress, 4-metric KPI grid (Period Total, Daily Average, Highest Expense, Transaction Count), spending trend charts, category donut breakdown, category ranking with progress bars, and payment method distribution.
  - **Instant View Swap**: Double-click or double-tap the logo at the top to toggle between the Tracking page and Dashboard page.
- **Customizable Fast Add Shortcuts**:
  - Add your own custom shortcuts (amount, category, note).
  - Remove shortcuts anytime.
  - 1-tap logging for frequent day-to-day expenses.
- **Strictly No Emojis**:
  - Professional, clean SVG icons used for all categories, payment methods, buttons, badges, and statuses.
- **Offline-First Resilience**:
  - Even with **zero network coverage**, you can add, view, edit, and delete expenses instantly.
  - Actions are stored locally in the offline queue and automatically flushed to Neon PostgreSQL upon reconnect.
- **Track Across All Horizons**:
  - **Day**: Today's spending, hourly breakdown.
  - **Week**: 7-day spending comparison (Mon–Sun), weekly total.
  - **Month**: Cumulative spending line chart, category donut breakdown, budget progress bar.
  - **Year**: 12-month bar chart (Jan–Dec), yearly top categories.
  - **All-Time & Custom Search**: Filter by date range, category, payment mode, or keywords.
- **Installable Mobile PWA**:
  - Installable directly to home screen on Android (Chrome) and iPhone (Safari).
- **Data Portability**:
  - Export your transactions to CSV or JSON backup anytime.

---

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Verify Database connection & migrate**:
   ```bash
   npm run migrate
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploying to Vercel

This app is configured for Vercel Serverless out of the box using `@vercel/node`.

1. Push this project to your GitHub repository.
2. Import the project into [Vercel](https://vercel.com).
3. In **Project Settings -> Environment Variables**, add:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string (from `.env`).
4. Click **Deploy**.

---

## How to Install on Mobile Phone (PWA)

### Android (Chrome)
1. Open your deployed website URL in Chrome.
2. Tap the **"Install"** button in the header, or open the browser menu (3 dots) and tap **"Install App"** / **"Add to Home screen"**.
3. Expense Plus will install directly on your phone's home screen with the app icon and launch full-screen.

### iPhone (Safari)
1. Open the website URL in Safari.
2. Tap the **Share** button at the bottom.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. Expense Plus will function as a standalone app.

---

## Offline-First Architecture

```
[ User Input ] -> [ Immediate Optimistic Local UI Update ]
                          |
               [ Save to LocalStorage / IndexedDB ]
                          |
         Is Internet Available (navigator.onLine)?
                 /                         \
             [YES]                         [NO]
               |                             |
   [ Push to Neon DB ]            [ Enqueue in Offline Queue ]
                                         |
                                [ On Reconnect / Heartbeat ]
                                         |
                               [ POST /api/expenses/sync ]
                                         |
                                  [ Synced to DB ]
```
