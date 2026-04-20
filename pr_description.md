🧪 Add error handling tests for R2 upload in profile.js

## 🎯 What
This PR addresses a testing gap in `js/profile.js:34` by adding robust unit tests for the `window.uploadToR2` function. Previously, there were no automated tests validating how the system handles different edge cases and failure scenarios during image uploads to Cloudflare R2 via our Worker layer.

## 📊 Coverage
The new `describe('uploadToR2')` block inside `tests/profile.test.js` covers the following scenarios:
1. **Happy Path**: Verifies that a successful upload properly transforms the Blob and FormData correctly, interacting with `global.fetch`, and accurately returning the resolved `url`.
2. **Worker HTTP Failures**: Simulates `!response.ok` (e.g., HTTP 500) from the Cloudflare Worker to ensure an error (`Worker 回傳失敗狀態碼: 500`) is correctly thrown.
3. **Missing URL in Response**: Simulates a `200 OK` response where the JSON payload is unexpectedly missing the `url` property, ensuring it safely throws `Worker 回傳網址失敗`.
4. **Network/Fetch Errors**: Tests generic network failures (e.g. `Promise.reject`) during the fetch call and verifies that the `catch` block intercepts, logs, and re-throws the error correctly.

_Note:_ Global state bleed (e.g., `navigator.share`) in previous tests within `js/app.test.js` was also patched to ensure reliable test runs.

## ✨ Result
Test coverage for the critical `window.uploadToR2` workflow is now properly documented and verified against edge case failures. The full Jest test suite ensures no regressions.

* **Tests**: 24 tests total (all pass).
* **Dependencies added**: `@babel/preset-env` (devDependency) to resolve environmental missing-module errors running JS tests with ES modules.
