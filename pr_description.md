🧪 Add Error Test for View Other Profile

🎯 **What:**
Added a test to cover the `viewOtherProfile` function in `js/profile.js:477`, verifying that when a Supabase query fetch fails, the function catches the error, correctly avoids crashing, and properly logs it out.
Also fixed `app.test.js` to correctly define properties with `Object.defineProperty(navigator)` due to some Jest environment restrictions.

📊 **Coverage:**
The scenario where viewing another profile fails due to Supabase returning an error object is now covered by testing error catch block and validating `console.error` logs.

✨ **Result:**
Test coverage and test reliability across vanilla js functionality has improved.
