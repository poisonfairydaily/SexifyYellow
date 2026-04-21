const assert = require('assert');
const fs = require('fs');
const path = require('path');

function setupMocks() {
    global.document = {
        getElementById: (id) => null,
        createElement: (tag) => ({ tag, style: {}, innerHTML: '', textContent: '' })
    };
    global.window = {
        onload: null,
        location: { href: '' }
    };

    // Create a mock DOM node factory
    const createMockNode = (id) => ({
        id,
        innerHTML: '',
        style: {},
        classList: {
            classes: new Set(),
            contains: function(c) { return this.classes.has(c); },
            add: function(c) { this.classes.add(c); },
            remove: function(c) { this.classes.delete(c); }
        }
    });

    global.supabase = {
        createClient: () => ({})
    };

    return createMockNode;
}

function loadDashboardJs() {
    const dashboardJsPath = path.join(__dirname, '../js/dashboard.js');
    const dashboardJsCode = fs.readFileSync(dashboardJsPath, 'utf8');

    // Instead of string manipulation with eval which is brittle and crashes if not fully mocked,
    // we use standard Node js evaluation after setting up the mocks globally just like test_app_notifications.js.
    eval(dashboardJsCode);
}

async function testLoadAuditListErrorPath() {
    console.log("Running LoadAuditList Error Path Test...");
    const createMockNode = setupMocks();

    const listContainer = createMockNode('audit-list');

    // Mock getElementById for our specific container
    global.document.getElementById = (id) => {
        if (id === 'audit-list') return listContainer;
        return null;
    };

    let consoleErrorCalled = false;
    const originalConsoleError = console.error;
    global.console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('抓取失敗')) {
            consoleErrorCalled = true;
        } else {
            originalConsoleError(...args);
        }
    };

    // Override the mock BEFORE evaluation so `dashboard.js` uses it when creating `supabaseClient` globally.
    global.supabase = {
        createClient: () => ({
            from: (table) => {
                if (table === 'products') {
                    return {
                        select: () => ({
                            eq: () => ({
                                order: async () => ({ data: null, error: new Error('Simulated Supabase error') })
                            })
                        })
                    };
                }
                return {};
            }
        })
    };

    // Evaluate the code. This will define `loadAuditList` and `renderTable` in the module or global scope depending on how eval runs.
    // In Node.js, `eval` creates locals if not using `global.eval`.
    // Wait, the previous test app approach was to eval the code and test window/global functions if they were exported,
    // or just call them if they were declared as var/function in the eval scope.
    // However, if we eval in the current function, `loadAuditList` is a local variable to this function.

    const dashboardJsPath = path.join(__dirname, '../js/dashboard.js');
    const dashboardJsCode = fs.readFileSync(dashboardJsPath, 'utf8');
    eval(dashboardJsCode);

    // Now loadAuditList is accessible because eval evaluates in the current local scope
    await loadAuditList();

    global.console.error = originalConsoleError;

    assert.strictEqual(consoleErrorCalled, true, "console.error should be called when catching the error");
    assert.ok(listContainer.innerHTML.includes('抓取資料失敗'), "Container should display failure message");
    assert.ok(listContainer.innerHTML.includes('Simulated Supabase error'), "Container should display the specific error message");

    console.log("✅ LoadAuditList Error Path Test Passed");
}

async function testLoadAuditListHappyPath() {
    console.log("Running LoadAuditList Happy Path Test...");
    const createMockNode = setupMocks();

    const listContainer = createMockNode('audit-list');
    global.document.getElementById = (id) => {
        if (id === 'audit-list') return listContainer;
        return null;
    };

    const mockProducts = [ { id: 1, name: 'Product A' }, { id: 2, name: 'Product B' } ];

    global.supabase = {
        createClient: () => ({
            from: (table) => {
                if (table === 'products') {
                    return {
                        select: () => ({
                            eq: () => ({
                                order: async () => ({ data: mockProducts, error: null })
                            })
                        })
                    };
                }
                return {};
            }
        })
    };

    const dashboardJsPath = path.join(__dirname, '../js/dashboard.js');
    let dashboardJsCode = fs.readFileSync(dashboardJsPath, 'utf8');

    // We can evaluate it and stub renderTable inside the eval.
    // But since renderTable is defined via `function renderTable(...)`, it's locally hoisted.
    // To mock renderTable, we replace its body to avoid DOM manipulation errors for parts we haven't mocked (like creating rows and cells).
    dashboardJsCode = dashboardJsCode.replace(
        /function renderTable\(products\) {[\s\S]*?(?=\n\/\/ --- |\nwindow\.hardDeleteProduct)/,
        `function renderTable(products) {
            global.renderTableCalled = true;
            global.renderTableArgs = products;
        }`
    );

    global.renderTableCalled = false;
    global.renderTableArgs = null;

    eval(dashboardJsCode);

    await loadAuditList();

    assert.strictEqual(global.renderTableCalled, true, "renderTable should be called on success");
    assert.deepStrictEqual(global.renderTableArgs, mockProducts, "renderTable should be called with products from DB");

    console.log("✅ LoadAuditList Happy Path Test Passed");
}

async function runAllTests() {
    try {
        await testLoadAuditListErrorPath();
        await testLoadAuditListHappyPath();
        console.log("\n🎉 All tests passed successfully!");
    } catch (e) {
        console.error("\n❌ Test Failed:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

runAllTests();
