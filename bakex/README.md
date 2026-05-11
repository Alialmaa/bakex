# Bakex 🍞 — Bakery Management System

> Next.js + Supabase + Vercel

---

## 🚀 Setup in 3 Steps

### Step 1 — Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → Create free account
2. Create a new project
3. Go to **SQL Editor** → paste the content of `supabase_schema.sql` → Run
4. Go to **Settings → API** → copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key

### Step 2 — Environment Variables

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=any_random_string_here
```

### Step 3 — Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your repo
3. Add environment variables (same as `.env.local`)
4. Deploy → get your URL like `bakex.vercel.app`

---

## 🔐 Default Login

| Username | Password | Role |
|----------|----------|------|
| admin | 1234 | Admin (full access) |

---

## 📁 Project Structure

```
bakex/
├── pages/
│   ├── index.tsx          # Dashboard
│   ├── login.tsx          # Login page
│   ├── register.tsx       # Create account
│   ├── stock.tsx          # Inventory
│   ├── produce.tsx        # Production
│   ├── reports.tsx        # Financial reports
│   └── api/
│       ├── auth/          # Login / Logout
│       ├── stock/         # Inventory CRUD
│       ├── recipes/       # Recipes + Production
│       ├── sales/         # Sales recording
│       └── users/         # User management
├── components/
│   └── Layout.tsx         # Sidebar + Topbar
├── lib/
│   ├── supabase.ts        # DB client
│   ├── auth.ts            # JWT helpers
│   └── translations.ts    # Arabic / English
├── styles/
│   └── globals.css        # Global styles
└── supabase_schema.sql    # Run this in Supabase
```

---

## ✨ Features

- ✅ Login with JWT (secure, httpOnly cookie)
- ✅ User roles: Admin, Manager, Staff, Read-only
- ✅ Custom permissions per page per user
- ✅ Inventory management with alerts
- ✅ Production — deducts from stock automatically
- ✅ Sales recording → monthly reports
- ✅ Financial reports: revenue, cost, profit, margin
- ✅ Bilingual Arabic 🇸🇦 / English 🇺🇸 with RTL
- ✅ Bakex branding

---

## 🛠 Run Locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```
