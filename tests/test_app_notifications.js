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
        innerHTML: ''
    });

    return createMockNode;
}

function loadAppJs() {
    const appJsPath = path.join(__dirname, '../js/app.js');
    const appJsCode = fs.readFileSync(appJsPath, 'utf8');
    eval(appJsCode);
}

async function testHappyPath() {
    console.log("Running Notification Happy Path Test...");
    const createMockNode = setupMocks();

    // Set up DOM elements
    const drawer = createMockNode('notification-drawer');
    drawer.classList.add('hidden'); // Initially hidden
    const panel = createMockNode('notification-panel');
    const badge = createMockNode('notification-badge');
    const list = createMockNode('notification-list');

    global.document.getElementById = (id) => {
        if (id === 'notification-drawer') return drawer;
        if (id === 'notification-panel') return panel;
        if (id === 'notification-badge') return badge;
        if (id === 'notification-list') return list;
        return null;
    };

    global.localStorage.getItem = (key) => key === 'userId' ? 'test-user-id' : null;

    // Mock Supabase
    const mockNotifications = [
        { id: 1, type: 'like', actor_id: 'actor1', created_at: '2023-01-01T00:00:00Z' },
        { id: 2, type: 'comment', actor_id: 'actor2', created_at: '2023-01-02T00:00:00Z' }
    ];

    const mockProfiles = [
        { id: 'actor1', display_name: 'Actor One', avatar_url: 'url1' },
        { id: 'actor2', display_name: 'Actor Two', avatar_url: 'url2' }
    ];

    global.window.supabaseClient = {
        from: (table) => {
            if (table === 'notifications') {
                return {
                    update: () => ({ eq: () => ({ eq: async () => {} }) }),
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: async () => ({ data: mockNotifications, error: null })
                            })
                        })
                    })
                };
            }
            if (table === 'profiles') {
                return {
                    select: () => ({
                        in: async () => ({ data: mockProfiles, error: null })
                    })
                };
            }
            return {};
        }
    };

    loadAppJs();

    await window.toggleNotifications();

    assert.strictEqual(drawer.classList.contains('hidden'), false, "Drawer should be visible");
    assert.ok(list.innerHTML.includes('Actor One'), "List should contain Actor One");
    assert.ok(list.innerHTML.includes('Actor Two'), "List should contain Actor Two");
    assert.ok(list.innerHTML.includes('對你的貼文按了讚'), "List should contain correct text for like");
    assert.ok(list.innerHTML.includes('在你的貼文留言'), "List should contain correct text for comment");

    console.log("✅ Happy Path Test Passed");
}

async function testEmptyPath() {
    console.log("Running Notification Empty Path Test...");
    const createMockNode = setupMocks();

    // Set up DOM elements
    const drawer = createMockNode('notification-drawer');
    drawer.classList.add('hidden'); // Initially hidden
    const panel = createMockNode('notification-panel');
    const badge = createMockNode('notification-badge');
    const list = createMockNode('notification-list');

    global.document.getElementById = (id) => {
        if (id === 'notification-drawer') return drawer;
        if (id === 'notification-panel') return panel;
        if (id === 'notification-badge') return badge;
        if (id === 'notification-list') return list;
        return null;
    };

    global.localStorage.getItem = (key) => key === 'userId' ? 'test-user-id' : null;

    global.window.supabaseClient = {
        from: (table) => {
            if (table === 'notifications') {
                return {
                    update: () => ({ eq: () => ({ eq: async () => {} }) }),
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: async () => ({ data: [], error: null })
                            })
                        })
                    })
                };
            }
            return {};
        }
    };

    loadAppJs();

    await window.toggleNotifications();

    assert.ok(list.innerHTML.includes('目前沒有新通知'), "List should show empty state message");
    console.log("✅ Empty Path Test Passed");
}

async function testErrorPath() {
    console.log("Running Notification Error Path Test...");
    const createMockNode = setupMocks();

    // Set up DOM elements
    const drawer = createMockNode('notification-drawer');
    drawer.classList.add('hidden'); // Initially hidden
    const panel = createMockNode('notification-panel');
    const badge = createMockNode('notification-badge');
    const list = createMockNode('notification-list');

    global.document.getElementById = (id) => {
        if (id === 'notification-drawer') return drawer;
        if (id === 'notification-panel') return panel;
        if (id === 'notification-badge') return badge;
        if (id === 'notification-list') return list;
        return null;
    };

    global.localStorage.getItem = (key) => key === 'userId' ? 'test-user-id' : null;

    let consoleErrorCalled = false;
    global.console.error = () => { consoleErrorCalled = true; };

    global.window.supabaseClient = {
        from: (table) => {
            if (table === 'notifications') {
                return {
                    update: () => ({ eq: () => ({ eq: async () => {} }) }),
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: async () => ({ data: null, error: new Error('Database Error') })
                            })
                        })
                    })
                };
            }
            return {};
        }
    };

    loadAppJs();

    await window.toggleNotifications();

    assert.strictEqual(consoleErrorCalled, true, "console.error should be called");
    assert.strictEqual(list.innerHTML, `<div class="text-center text-red-400 text-sm mt-10">無法載入通知。</div>`, "List should show error state message");
    console.log("✅ Error Path Test Passed");
}

async function testToggleClosePath() {
    console.log("Running Notification Close Path Test...");
    const createMockNode = setupMocks();

    // Set up DOM elements
    const drawer = createMockNode('notification-drawer');
    drawer.classList.remove('hidden'); // Initially visible
    const panel = createMockNode('notification-panel');

    global.document.getElementById = (id) => {
        if (id === 'notification-drawer') return drawer;
        if (id === 'notification-panel') return panel;
        return null;
    };

    loadAppJs();

    await window.toggleNotifications();

    assert.strictEqual(drawer.classList.contains('hidden'), true, "Drawer should be hidden after toggle");
    assert.strictEqual(panel.classList.contains('translate-x-full'), true, "Panel should be translated out");
    console.log("✅ Close Path Test Passed");
}

async function runAllTests() {
    try {
        await testHappyPath();
        await testEmptyPath();
        await testErrorPath();
        await testToggleClosePath();
        console.log("\\n🎉 All tests passed successfully!");
    } catch (e) {
        console.error("\\n❌ Test Failed:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

runAllTests();
