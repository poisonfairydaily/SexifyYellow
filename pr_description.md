🧹 [Refactor renderProductGrid]

🎯 **What:** The code health issue addressed
Refactored the overly long `renderProductGrid` function in `js/shop.js` by extracting the product card template generation into a separate `generateProductCardHTML` function.

💡 **Why:** How this improves maintainability
This reduces the cyclomatic complexity and length of the `renderProductGrid` function. The function is now cleaner, easier to read, and isolates data-fetching/filtering logic from UI rendering logic, making both parts easier to test and maintain individually.

✅ **Verification:** How you confirmed the change is safe
- Confirmed the javascript syntax is correct via `node -c js/shop.js`.
- Confirmed the existing tests in `js/shop.test.js` still pass successfully.
- Code changes were reviewed to ensure identical output.

✨ **Result:** The improvement achieved
`renderProductGrid` is shorter and focused on data orchestration. The UI logic is safely isolated in `generateProductCardHTML`.
