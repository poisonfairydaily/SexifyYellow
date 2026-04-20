🧪 Testing improvement for executeSecurePurchase

🎯 **What:** The `executeSecurePurchase` functionality in `js/shop.js` lacked sufficient test coverage, leaving error paths and side effects like balance modifications untested.
📊 **Coverage:** This change implements 6 new tests that mock the browser globals and `supabaseClient`. The tests cover:
- Unauthenticated user rejection.
- Database error handling.
- Insufficient balance rejection.
- Cancellation via confirm dialogs.
- Successful digital purchase paths (balance deduction, order creation).
- Successful physical item purchase paths.
✨ **Result:** A fully tested critical flow that guarantees reliability for purchase executions, significantly improving the overall safety of refactoring within the `js/shop.js` module.
