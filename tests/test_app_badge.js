const assert = require('assert');
const fs = require('fs');
const path = require('path');

function setupMocks() {
    // Reset global state
    global.document = {
        getElementById: (id) => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    };

    global.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {}
    };

    global.setTimeout = (cb, ms) => cb();
    global.window = {};

    // Create a mock DOM node factory
    const createMockNode = (id) => ({
        id,
        classList: {
            classes: new Set(),
            contains: function(c) { return this.classes.has(c); },
            add: function(c) { this.classes.add(c); },
            remove: function(c) { this.classes.delete(c); }
        },
        innerHTML: '',
        style: {}
    });

    return createMockNode;
}

function loadAppJs() {
    const appJsPath = path.join(__dirname, '../js/app.js');
    const appJsCode = fs.readFileSync(appJsPath, 'utf8');
    eval(appJsCode);
}

async function testMissingDeps() {
    console.log("Running Missing Dependencies Test...");
    setupMocks();
    loadAppJs();

    // No userId, no supabase, no badge
    await window.updateGlobalMessageBadge();

    // Set userId, but no supabase
    global.localStorage.getItem = () => 'user123';
    await window.updateGlobalMessageBadge();

    // Set supabase, but no badge
    global.window.supabaseClient = {};
    await window.updateGlobalMessageBadge();

    console.log("✅ Missing Dependencies Test Passed (No crash)");
}

async function testCountGreaterThanZero() {
    console.log("Running Count > 0 Test...");
    const createMockNode = setupMocks();
    const badge = createMockNode('nav-msg-badge');
    badge.classList.add('hidden'); // Initially hidden

    global.document.getElementById = (id) => id === 'nav-msg-badge' ? badge : null;
    global.localStorage.getItem = () => 'user123';

    global.window.supabaseClient = {
        from: (table) => {
            if (table === 'messages') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: async () => ({ count: 5, error: null })
                        })
                    })
                };
            }
        }
    };

    loadAppJs();
    await window.updateGlobalMessageBadge();

    assert.strictEqual(badge.classList.contains('hidden'), false, "Badge should not be hidden when count > 0");
    console.log("✅ Count > 0 Test Passed");
}

async function testCountZero() {
    console.log("Running Count == 0 Test...");
    const createMockNode = setupMocks();
    const badge = createMockNode('nav-msg-badge');
    badge.classList.remove('hidden'); // Initially visible

    global.document.getElementById = (id) => id === 'nav-msg-badge' ? badge : null;
    global.localStorage.getItem = () => 'user123';

    global.window.supabaseClient = {
        from: (table) => {
            if (table === 'messages') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: async () => ({ count: 0, error: null })
                        })
                    })
                };
            }
        }
    };

    loadAppJs();
    await window.updateGlobalMessageBadge();

    assert.strictEqual(badge.classList.contains('hidden'), true, "Badge should be hidden when count == 0");
    console.log("✅ Count == 0 Test Passed");
}

async function testErrorPath() {
    console.log("Running Error Path Test...");
    const createMockNode = setupMocks();
    const badge = createMockNode('nav-msg-badge');

    global.document.getElementById = (id) => id === 'nav-msg-badge' ? badge : null;
    global.localStorage.getItem = () => 'user123';

    let consoleWarnCalled = false;
    const originalWarn = global.console.warn;
    global.console.warn = () => { consoleWarnCalled = true; };

    global.window.supabaseClient = {
        from: (table) => {
            if (table === 'messages') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: async () => { throw new Error("Database error"); }
                        })
                    })
                };
            }
        }
    };

    loadAppJs();
    await window.updateGlobalMessageBadge();

    global.console.warn = originalWarn; // Restore

    assert.strictEqual(consoleWarnCalled, true, "console.warn should be called on error");
    console.log("✅ Error Path Test Passed");
}

async function runAllTests() {
    try {
        await testMissingDeps();
        await testCountGreaterThanZero();
        await testCountZero();
        await testErrorPath();
        console.log("\n🎉 All tests passed successfully!");
    } catch (e) {
        console.error("\n❌ Test Failed:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

runAllTests();
