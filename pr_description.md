
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
