🧪 Error path coverage for renderProductGrid in shop.js

🎯 **What:** The `renderProductGrid` function in `js/shop.js` has error handling that executes when Supabase user authentication or products database fetching throws an error. Previously, this path was entirely untested.
📊 **Coverage:** Two specific tests were added:
  1. Handled rejection when loading user data.
  2. Handled rejection when fetching products data.
Both tests ensure that `console.error` is triggered appropriately and that the user-facing grid correctly renders the "無法載入商品資料" fallback message.
✨ **Result:** Test coverage for `shop.js` is now expanded. The `shop.test.js` has also been migrated from `js/` to `tests/` for better structure, and environment package `jest-environment-jsdom` is properly initialized.
