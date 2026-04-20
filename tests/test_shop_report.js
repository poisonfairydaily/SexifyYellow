const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Setup mocks
global.window = {};
global.document = {
    createElement: () => ({ textContent: '', innerHTML: '' }),
    addEventListener: () => {},
    getElementById: () => ({ addEventListener: () => {}, removeEventListener: () => {}, style: {}, classList: { add: () => {}, remove: () => {} }, value: '', innerHTML: '', appendChild: () => {}, replaceChildren: () => {} }),
    querySelectorAll: () => []
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};

// We need to load shop.js
const shopJsPath = path.join(__dirname, '../js/shop.js');
const shopJsCode = fs.readFileSync(shopJsPath, 'utf8');

// Evaluate shopJsCode in the current global context
const scriptFunction = new Function(shopJsCode);
scriptFunction();

async function runTests() {
    let testsPassed = 0;
    let testsFailed = 0;

    function logResult(name, success, error) {
        if (success) {
            console.log(`✅ ${name}`);
            testsPassed++;
        } else {
            console.log(`❌ ${name}`);
            console.error(error);
            testsFailed++;
        }
    }

    // Mock functions tracker
    let alertMessages = [];
    let promptResult = null;
    let supabaseInsertResult = null;
    let supabaseGetUserResult = null;
    let insertedData = null;

    global.alert = (msg) => { alertMessages.push(msg); };
    global.prompt = (msg) => { return promptResult; };

    window.supabaseClient = {
        auth: {
            getUser: async () => supabaseGetUserResult
        },
        from: (table) => ({
            insert: async (data) => {
                insertedData = data;
                return supabaseInsertResult;
            }
        })
    };

    function resetState() {
        alertMessages = [];
        promptResult = null;
        supabaseInsertResult = null;
        supabaseGetUserResult = null;
        insertedData = null;
    }

    console.log("Running window.reportProduct tests...\n");

    // Test 1: User cancels prompt or enters empty string
    try {
        resetState();
        promptResult = ""; // empty reason
        await window.reportProduct("prod123");
        assert.strictEqual(alertMessages.length, 0, "No alert should be shown");
        assert.strictEqual(insertedData, null, "Should not insert anything");
        logResult("Handles empty reason correctly", true);
    } catch (e) {
        logResult("Handles empty reason correctly", false, e);
    }

    // Test 2: User not logged in
    try {
        resetState();
        promptResult = "spam";
        supabaseGetUserResult = { data: { user: null } };
        await window.reportProduct("prod123");
        assert.deepStrictEqual(alertMessages, ["請先登入帳號"], "Should prompt to login");
        assert.strictEqual(insertedData, null, "Should not insert anything");
        logResult("Handles not logged in user", true);
    } catch (e) {
        logResult("Handles not logged in user", false, e);
    }

    // Test 3: Successful report
    try {
        resetState();
        promptResult = "inappropriate content";
        supabaseGetUserResult = { data: { user: { id: "user456" } } };
        supabaseInsertResult = { error: null };
        await window.reportProduct("prod789");
        assert.deepStrictEqual(insertedData, [{
            product_id: "prod789", reporter_id: "user456", reason: "inappropriate content"
        }], "Should insert correct data");
        assert.deepStrictEqual(alertMessages, ["📢 感謝檢舉，我們將儘速審核。"], "Should show success message");
        logResult("Handles successful report", true);
    } catch (e) {
        logResult("Handles successful report", false, e);
    }

    // Test 4: Supabase insert error handling
    try {
        resetState();
        promptResult = "scam";
        supabaseGetUserResult = { data: { user: { id: "user456" } } };
        supabaseInsertResult = { error: new Error("Database error") };
        await window.reportProduct("prod789");
        assert.deepStrictEqual(alertMessages, ["檢舉失敗"], "Should show failure message");
        logResult("Handles database error correctly", true);
    } catch (e) {
        logResult("Handles database error correctly", false, e);
    }

    // Test 5: Supabase getUser throws exception
    try {
        resetState();
        promptResult = "fake";
        window.supabaseClient.auth.getUser = async () => { throw new Error("Network error") };
        await window.reportProduct("prod789");
        assert.deepStrictEqual(alertMessages, ["檢舉失敗"], "Should handle getUser exception gracefully");

        // Restore
        window.supabaseClient.auth.getUser = async () => supabaseGetUserResult;
        logResult("Handles network error gracefully", true);
    } catch (e) {
        logResult("Handles network error gracefully", false, e);
    }

    console.log(`\nTest Summary: ${testsPassed} passed, ${testsFailed} failed`);
    if (testsFailed > 0) process.exit(1);
}

runTests();
