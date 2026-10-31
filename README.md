# Borewell Water Hisab (બોરવેલ પાણી હિસાબ)

A simple, easy-to-use, mobile-friendly website designed specifically for farmers and borewell operators to track water supply hours, automatically calculate bills, record payments, and view overall accounts.

---

## 🌟 Key Features

1. **Farmer-Friendly UI**:
   - Green & white nature theme (`#1b5e20`, `#2e7d32`, `#4caf50`, `#ffffff`).
   - High-contrast, large touch-friendly buttons and bold text.
   - Dual-language support (Gujarati & English) with familiar agricultural phrasing (*પાણીના કલાક*, *કુલ બિલ*, *બાકી પૈસા*).
   - Responsive design optimized for smartphones and desktops.

2. **Home Page with Top Summary Bar**:
   - **4 Large Primary Buttons**:
     1. 👨‍🌾 Farmer Details (ખેડૂતની માહિતી)
     2. 💧 Water Supply Entry (પાણીની નોંધ)
     3. 🧾 Bill Calculation (બિલ ગણતરી)
     4. 📋 All Farmers' Hisab (બધા ખેડૂતોનો હિસાબ)
   - **Real-Time Summary Metrics**:
     - Total Farmers (કુલ ખેડૂતો)
     - Today's Water Supply (આજનું પાણી - કલાક)
     - Today's Total Bill (આજનું કુલ બિલ - ₹)
     - Total Pending Amount (કુલ બાકી રકમ - ₹)

3. **Farmer Details**:
   - Add new farmers with Name, Mobile, Village, Crop (Fasal), Farm Identifier (ખાતા/સર્વે નં.).
   - Searchable table with instant filtering by name, village, or mobile.
   - Quick action buttons (Add Water, View Bill, Edit Details, Delete).

4. **Water Supply Entry**:
   - Automatic duration calculation supporting partial hours (e.g. 30 minutes = 0.50h, 2.5h, etc.).
   - Midnight-crossing safe (e.g. 10:00 PM to 02:00 AM = 4.0 hours).
   - Live total bill calculation (`Duration × Hourly Rate`).
   - Price snapshot: each session preserves its agreed rate even if crop rates change later.
   - Allows recording past and future dates.

5. **Simple Bill Calculation**:
   - Individual farmer bill generator for any selected date range or preset (All Time, This Month).
   - Detailed table matching the requirement:
     - Farmer Name
     - Total Water Supply Hours
     - Price Per Hour
     - Total Bill (Kul Bill)
     - Amount Paid
     - Remaining Amount (Baki Paisa)
   - **3 Action Buttons**:
     - 👁️ View Bill (બિલ જુઓ)
     - 📥 Download PDF (પીડીએફ ડાઉનલોડ)
     - 🖨️ Print Bill (બિલ પ્રિન્ટ કરો)
   - Date-wise itemized session breakdown.

6. **All Farmers' Hisab (બધા ખેડૂતોનો હિસાબ)**:
   - Full ledger table: Farmer Name | Village | Crop | Total Hours | Total Bill | Paid | Remaining | Status.
   - Date range filter and search box.
   - Auto-computed Grand Totals footer row.
   - Download CSV/Excel report and Print Report buttons.

7. **Crop & Hourly Rate Management**:
   - Default crops: Cotton (કપાસ @ ₹200/hr), Wheat (ઘઉં @ ₹180/hr), Groundnut (મગફળી @ ₹220/hr), Cumin (જીરું @ ₹210/hr), Mustard (રાયડો @ ₹190/hr).
   - Modify hourly rates or add custom crops.

8. **Payment Entry**:
   - Record payments via Cash (રોકડ), UPI (Google Pay, PhonePe, Paytm), or Other/Cheque.
   - Automatically updates farmer balance and status (Paid / Pending).

---

## 🛠️ Technology Stack

- **Frontend**: Clean HTML5, CSS3, Vanilla JavaScript (Single-Page Application).
- **Backend**: Node.js & Express REST API.
- **Database**: PostgreSQL with connection pooling (`pg`).
- **Currency**: Indian Rupee (₹).

---

## 🚀 How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database (.env)
Edit `.env` if your PostgreSQL credentials differ:
```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=prince2396
PGDATABASE=borewell_water_db
```

### 3. Start the Server
```bash
npm start
```
The server will automatically initialize tables and sample seed data if not already present.

Open your browser at:
```
http://localhost:3000
```

### 4. Run Automated Tests
```bash
npm test
```

---

## 🌐 Deploy to Render

### Option 1: Automatic Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Blueprint**.
2. Connect your GitHub repository: `https://github.com/patelprince2006/Water_supply_management_system`.
3. Render will read `render.yaml` and automatically provision:
   - A free PostgreSQL database (`water-supply-db`)
   - The Node.js Web Service (`water-supply-management-system`)
   - Wire the `DATABASE_URL` between them automatically.
4. Click **Apply**. Within 2–3 minutes, your application will be live at `https://<your-service-name>.onrender.com`.

### Option 2: Manual Setup
1. **Create PostgreSQL Database on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) -> **New +** -> **PostgreSQL**.
   - Name: `water-supply-db`, Database: `borewell_water_db`, Plan: Free.
   - Click **Create Database**.
   - Copy the **Internal Database URL** (e.g., `postgres://...`).
2. **Create Web Service on Render**:
   - Go to **New +** -> **Web Service**.
   - Connect repository: `patelprince2006/Water_supply_management_system`.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free.
   - In **Environment Variables**, add:
     - `DATABASE_URL`: *(paste the Internal Database URL copied above)*
     - `NODE_ENV`: `production`
3. Click **Create Web Service**. Tables and initial seed data will be created automatically on first launch!

