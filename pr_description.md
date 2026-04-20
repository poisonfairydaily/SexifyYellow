🎯 **What:** The testing gap addressed
This PR addresses a missing error handling test for `uploadMediaToSupabase` in `js/messages.js`. Previously, `uploadMediaToSupabase` lacked unit tests, leaving its core behavior and error scenarios unverified.
Additionally, tests in `js/app.test.js` were failing due to strict mocking constraints for `global.navigator` in JSDOM environments, which is now fixed by using `Object.defineProperty` for the mock.

📊 **Coverage:** What scenarios are now tested
- `uploadMediaToSupabase`: Successfully uploading a file and resolving the expected public URL from Supabase storage.
- `uploadMediaToSupabase`: Properly catching and logging an error if the upload fails (e.g. from the `upload` method), and preventing further execution (`getPublicUrl`).

✨ **Result:** The improvement in test coverage
- Improved confidence and test coverage for the media upload functionality to Supabase.
- Restored passing state for `window.handleShare` tests and overall Jest testing suite execution across the vanilla JS environment.
