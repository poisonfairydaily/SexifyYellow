🧪 Add tests for window.openEditProfile try/catch block

🎯 **What:**
Added a new test suite to `tests/profile.test.js` to cover the `try/catch` block inside `window.openEditProfile`.

📊 **Coverage:**
The added test suite `openEditProfile try/catch block` covers:
- Simulating a rejection from `getAuthenticatedUserId()` and verifying that the correct error alert is displayed.
- Simulating a rejection from `window.supabaseClient.from().select().eq().single()` when fetching the profile and verifying that the error is correctly handled.
- Simulating a successful load to ensure DOM elements correctly receive the profile data.

✨ **Result:**
Improved the testing reliability of the profile editing modal functionality. Handled potential async failures during initialization and increased overall codebase test coverage.
