# ⚡ Quick Fix: Only 2 Steps

## ⚠️ IMPORTANT: Copy the SQL files, NOT this markdown!

This guide is just instructions. **You must copy the actual SQL files** to Supabase.

---

## Step 1: Run First SQL Fix

**📄 Copy ENTIRE contents of:** `supabase/002_fix_signup_trigger.sql`

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → **New Query**
4. **Open** `supabase/002_fix_signup_trigger.sql` in VS Code
5. **Copy ALL** the content (Ctrl+A, Ctrl+C)
6. **Paste** into Supabase SQL Editor (Ctrl+V)
7. Click **RUN** button (or press Ctrl+Enter)
8. Wait for "Success" message ✅

---

## Step 2: Run Second SQL Fix

**📄 Copy ENTIRE contents of:** `supabase/003_create_profile_rpc.sql`

1. Click **New Query** in Supabase SQL Editor
2. **Open** `supabase/003_create_profile_rpc.sql` in VS Code
3. **Copy ALL** the content (Ctrl+A, Ctrl+C)
4. **Paste** into Supabase SQL Editor (Ctrl+V)
5. Click **RUN** button (or press Ctrl+Enter)
6. Wait for "Success" message ✅

---

## ✅ Verification

Go to: `http://localhost:5173/debug`

Check that **RPC STATUS** shows: **✓ Ready**

If it shows **✗ Missing**, re-run Step 2.

---

## 🧪 Test Signup

1. Go to `/register` page
2. Use new email (e.g., `test123@example.com`)
3. Fill in name and password (6+ characters)
4. Click "Create Account"
5. Should redirect to dashboard

---

## 💥 Still Failing?

Use the Debug Page: `http://localhost:5173/debug`

It shows:
- ✅ RPC function status
- ✅ Database operations log
- ✅ Recent profiles created
- ✅ Error messages with details
