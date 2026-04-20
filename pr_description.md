🎯 **What:**
Added a test suite for the `window.refreshBalanceUI` function located in `js/shop.js`.

📊 **Coverage:**
The tests now cover:
- Early return for unauthenticated users.
- Successful updating of the 3 DOM elements (`user-balance`, `shop-balance-display`, and `pc-balance`) when the balance is retrieved.
- Handling missing elements gracefully.
- Proper logging of errors if the API call fails.

✨ **Result:**
This improves our test coverage for `js/shop.js` and prevents regressions in the Balance UI Refresh functionality.
