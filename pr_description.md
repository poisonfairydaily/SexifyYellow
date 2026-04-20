🔒 [Security Fix] Harden Database Row-Level Security Policies

🎯 **What:**
Fixed overly permissive Row-Level Security (RLS) policies in the Supabase database that exposed the application to unauthorized access via the public Anon Key. Specifically, removed public/anonymous `INSERT`, `UPDATE`, and `DELETE` access to tables like `messages`, `reports`, and `storage.objects` (e.g. `message-images`). Restricted private data reading by removing the public `SELECT` policy on `user_private_data`.

⚠️ **Risk:**
The Supabase `SUPABASE_ANON_KEY` is hardcoded in the frontend and is designed to be public. However, if RLS is not properly configured, an attacker could use this key to insert, update, or read arbitrary records across the entire database. Prior to this fix, anyone with the key could insert messages, read private user data, and upload/delete files in certain storage buckets without authentication, leading to severe data breaches and potential defacement/spam.

🛡️ **Solution:**
Applied secure RLS policies directly via migration:
- Dropped public `SELECT` access from the `messages` and `user_private_data` tables.
- Dropped anonymous `INSERT` access from the `messages` table.
- Enforced `authenticated` role requirements for storage uploads and deletions in the `message-images` bucket.
- Ensured sensitive read operations require authenticated user sessions matching their respective `auth.uid()`.

🎯 **What:**
- The gap in testing for `window.saveUserProfile` handling Promise.all errors has been addressed.
- The existing Jest test suite in `js/app.test.js` was modified to include the new test cases.
- Additionally, previously broken tests for `window.handleShare` caused by JSDOM's read-only navigator object were resolved.

📊 **Coverage:**
The new test suite covers:
- Early return for unauthenticated users (no `userId`).
- Simulated failures during the public profile update process.
- Simulated failures during the private data update process.
- The happy path for successful user profile updates.

✨ **Result:**
- Test coverage has improved significantly.
- All tests in the test suite pass correctly without polluting the environment or outputting untracked error messages.
# 🔒 [security fix] Remove sensitive data from localStorage

🎯 **What:** The application was storing sensitive user identifiers (`userId`, `myChatName`) in `localStorage` in various files. This exposes user data if an XSS vulnerability is exploited.

⚠️ **Risk:** Storing user identifiers and sensitive metadata in `localStorage` increases the blast radius of XSS attacks, allowing malicious scripts to steal identities and interact with the application under the guise of an authenticated user.

🛡️ **Solution:**
- Removed all instances of `localStorage.setItem` that were caching `userId` and `myChatName`.
- Updated all references to `localStorage.getItem('userId')` to securely and asynchronously fetch the user ID directly from `await window.supabaseClient.auth.getSession()`.
- Updated tests (`tests/test_app_notifications.js`) to properly mock the Supabase session retrieval logic.
- Adjusted `@babel/preset-env` and `navigator` global mocking in `app.test.js` to ensure the testing environment correctly runs the modern asynchronous code and updated JSDOM configurations.
