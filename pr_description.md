🧪 Testing Improvement Task

🎯 What: The testing gap addressed
This PR adds testing coverage for the Followers (fans) and Subscriptions (subs) tabs in `js/profile.js` when error occurs fetching data from the database. It explicitly checks that an error displays the expected fallback message "讀取失敗".

📊 Coverage: What scenarios are now tested
*   When fetching subscriptions for followers (fans) tab throws an error, the UI correctly displays the "讀取失敗" message.
*   When fetching subscriptions for subscriptions (subs) tab throws an error, the UI correctly displays the "讀取失敗" message.

✨ Result: The improvement in test coverage
The error cases for displaying fans and subscriptions are now fully covered by unit tests using Jest, preventing regressions when the UI templates or database abstractions are refactored in the future.
