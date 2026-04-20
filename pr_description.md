🧹 [Code Health] Remove Unused Success-Level Console Logs

🎯 **What:**
Removed several unnecessary `console.log` statements that provided success-level feedback in production code (specifically in `js/admin.js`, `js/supabase-config.js`, and `js/messages.js`).

💡 **Why:**
These logs provided no meaningful value in a production environment and cluttered the console output. Removing them improves the codebase's readability and follows the best practice of keeping the console clean of noise.

✅ **Verification:**
Verified the changes by manually confirming syntax correctness with `node -c` for the modified JavaScript files (`js/admin.js`, `js/supabase-config.js`, `js/messages.js`). Ensured that no runtime logic or dependencies were altered.

✨ **Result:**
Cleaner console output, improving code maintainability without changing any existing application behavior.
