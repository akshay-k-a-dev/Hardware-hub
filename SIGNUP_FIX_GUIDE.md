# 🔧 MakerVault Signup Fix Guide

## Problem
Users were getting "Failed to complete profile setup" error when trying to register. The root cause is that the automatic profile creation trigger was failing, and the fallback manual profile creation couldn't complete due to RLS (Row Level Security) restrictions.

## Solution Overview
I've implemented a three-part fix:
1. **Improved trigger error handling** - The auth trigger now logs errors instead of failing
2. **Better RLS policies** - Allow profile creation during signup
3. **RPC function fallback** - A secure server function handles profile creation when the trigger fails

## Step 1: Run the Trigger Fix SQL
Run this SQL in your **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

**File:** `supabase/002_fix_signup_trigger.sql`

This SQL:
- Updates the trigger with better error handling
- Ensures all table defaults are set properly
- Adds RLS policies that allow profile creation

## Step 2: Create the Profile RPC Function
Run this SQL in your **Supabase SQL Editor**:

**File:** `supabase/003_create_profile_rpc.sql`

This SQL:
- Creates a `create_user_profile` function that runs with elevated privileges
- Allows the client to call this function securely
- Provides better error handling and logging

## Step 3: Verify the Fix
1. Go to `http://localhost:5173/debug` (or your dev server URL + `/debug`)
2. Check the **RPC STATUS** indicator - it should show "✓ Ready"
3. If it shows "✗ Missing", the RPC function wasn't created properly - re-run Step 2

## Step 4: Test Signup
1. Click "Sign up" on the login page
2. Use a new email address (e.g., `test123@example.com`)
3. Fill in all fields and submit

### If signup still fails:
1. **Check the debug page logs** (`/debug`)
   - Look for errors in the "Database Operations" section
   - Filter by "AUTH_SIGNUP" to see signup attempts

2. **Check browser console** (F12 → Console)
   - Look for `[AUTH]` prefixed messages
   - These show exactly what went wrong

3. **Check Supabase logs**
   - Supabase Dashboard → Your Project → Logs
   - Look for errors around your signup attempt time
   - Check both "Postgres" and authentication logs

## Code Changes Made

### Updated Files:

#### 1. `src/lib/supabase.js`
- Added comprehensive database operation logging
- All SELECT, INSERT, UPDATE, DELETE operations are logged
- Auth operations (signup, signin) are logged with details
- Errors include full error messages for debugging

#### 2. `src/contexts/AuthContext.jsx`
- Enhanced `signUp()` function with:
  - Input validation
  - Better error messages
  - Timeout to wait for trigger execution
  - Profile verification
  - RPC function fallback for profile creation
- Enhanced `signIn()` and `fetchProfile()` with error handling and logging
- Better session management

#### 3. `src/pages/Register.jsx`
- Added validation for required fields
- Better error messages displayed to users
- Logging of signup attempts

#### 4. `src/pages/Login.jsx`
- Better error handling
- Friendly error messages for common issues

#### 5. `src/pages/Debug.jsx`
- New debug interface accessible at `/debug`
- Shows real-time database operations
- Displays recent profiles in the database
- RPC function status check
- Session information
- Troubleshooting guide

#### 6. `supabase/001_initial_schema.sql`
- Updated trigger with error handling
- Improved RLS policies for profile creation
- Added support for both authenticated and anonymous profile creation

#### 7. New Files Created:
- `supabase/002_fix_signup_trigger.sql` - Comprehensive trigger fix
- `supabase/003_create_profile_rpc.sql` - Profile creation RPC function

## How It Works Now

### Signup Flow:
```
1. User submits signup form
   ↓
2. Client validates input (name, email, password)
   ↓
3. Call supabase.auth.signUp()
   ↓
4. Server creates auth user
   ↓
5. Database trigger (handle_new_user) automatically creates profile
   ↓
6. Wait 1.5 seconds for trigger to complete
   ↓
7. Verify profile exists with SELECT query
   ↓
   If profile found → Success, user logged in
   ↓
   If profile not found → Call create_user_profile RPC
   ↓
   RPC creates profile and returns success
   ↓
8. User is logged in and redirected to dashboard
```

## Database Logging

All database operations are logged to the browser's localStorage and console:

```javascript
// View logs in browser console
console.log(getDbLogs()); // Returns array of all operations

// Clear logs
clearDbLogs();
```

Log entry format:
```json
{
  "timestamp": "2026-03-03T10:09:30.552Z",
  "operation": "AUTH_SIGNUP",
  "table": "auth.users",
  "status": "SUCCESS",
  "details": { "email": "user@example.com" },
  "error": null
}
```

## Troubleshooting Checklist

- [ ] Have you run `supabase/002_fix_signup_trigger.sql`?
- [ ] Have you run `supabase/003_create_profile_rpc.sql`?
- [ ] Does the Debug page show RPC STATUS as "✓ Ready"?
- [ ] Are you using a new email address (not already registered)?
- [ ] Check browser console for [AUTH] error messages
- [ ] Check Debug page logs for failed operations
- [ ] Check Supabase Dashboard → Logs for database errors
- [ ] Is the profiles table accessible (RLS not too restrictive)?

## Common Errors & Solutions

### "Database error saving new user" (500 error)
- **Cause:** The auth trigger is failing
- **Fix:** Run `supabase/002_fix_signup_trigger.sql`

### "Failed to complete profile setup"
- **Cause:** RPC function not created or failing
- **Fix:** Run `supabase/003_create_profile_rpc.sql` and verify RPC STATUS

### "Email already registered"
- **Cause:** You're using the same email twice
- **Fix:** Use a new email address for each test signup

### Profile shows in Debug but not in app
- **Cause:** Profile fetch error or RLS policy issue
- **Fix:** Check `fetchProfile()` errors in console

## Performance Notes

- Signup now waits 1.5 seconds for the trigger to complete
- This is necessary to ensure the profile is created before navigating to the dashboard
- If 1.5s is too long or too short, adjust in `AuthContext.jsx` signup function

## Next Steps

After signup is working:
1. Test login with the newly created account
2. Test role-based access (student vs provider)
3. Check that profile shows correct role in debug page
4. Remove `/debug` route from production (it's for development only)

## Support

If you still have issues:
1. Screenshots of the error message
2. Browser console logs (F12)
3. Database logs from Supabase Dashboard
4. Steps to reproduce

All of this information is easier to get from the Debug page at `/debug`.
