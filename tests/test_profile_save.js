const assert = require('assert');
const fs = require('fs');
const path = require('path');

function setupMocks() {
    global.document = {
        getElementById: (id) => mockNodes[id] || createMockNode(id),
        addEventListener: () => {},
        createElement: () => createMockNode('temp')
    };

    const mockNodes = {};
    const createMockNode = (id) => {
        const node = {
            id,
            innerText: '',
            disabled: false,
            value: '',
            src: '',
            classList: {
                classes: new Set(),
                add: function(c) { this.classes.add(c); },
                remove: function(c) { this.classes.delete(c); },
                contains: function(c) { return this.classes.has(c); }
            },
            toDataURL: () => 'data:image/webp;base64,...',
            closest: () => ({ remove: () => {} })
        };
        mockNodes[id] = node;
        return node;
    };

    global.localStorage = {
        setItem: () => {},
        getItem: () => null
    };

    global.alertMsg = null;
    global.alert = (msg) => { global.alertMsg = msg; };

    global.getAuthenticatedUserId = async () => 'user-123';

    global.isAvatarChanged = false;
    global.currentAvatarImage = null;

    global.uploadToR2 = async () => 'https://example.com/image.webp';
    global.closeEditProfile = () => {};
    global.renderProfile = () => {};
    global.escapeHTML = (str) => str;

    if (!global.window) global.window = {};

    global.window.uploadToR2 = global.uploadToR2;
    global.window.closeEditProfile = global.closeEditProfile;
    global.window.renderProfile = global.renderProfile;
    global.window.getAuthenticatedUserId = global.getAuthenticatedUserId;
    global.window.isAvatarChanged = global.isAvatarChanged;
    global.window.currentAvatarImage = global.currentAvatarImage;
    global.window.escapeHTML = global.escapeHTML;

    // supabase mock
    global.window.supabaseClient = {
        auth: {
            getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null })
        },
        from: () => ({
            update: () => ({
                eq: async () => ({ error: null })
            }),
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        order: async () => ({ data: [], error: null })
                    })
                }),
                in: async () => ({ data: [], error: null })
            }),
            insert: async () => ({ error: null }),
            delete: () => ({
                eq: async () => ({ error: null })
            })
        })
    };

    global.supabaseClient = global.window.supabaseClient;

    return mockNodes;
}

function loadProfileJs() {
    const profileJsPath = path.join(__dirname, '../js/profile.js');
    const profileJsCode = fs.readFileSync(profileJsPath, 'utf8');

    eval(profileJsCode);
}

async function runTests() {
    console.log("Running saveProfileData tests...");

    setupMocks();
    loadProfileJs();

    // Test 1: Happy Path
    try {
        const nodes = setupMocks();
        nodes['edit-display-name'] = global.document.getElementById('edit-display-name');
        nodes['edit-display-name'].value = 'New Name';
        nodes['edit-bio'] = global.document.getElementById('edit-bio');
        nodes['edit-bio'].value = 'New Bio';
        nodes['edit-banner-preview'] = global.document.getElementById('edit-banner-preview');
        nodes['edit-banner-preview'].src = '';

        await window.saveProfileData();

        assert.strictEqual(nodes['save-profile-btn'].innerText, "儲存修改");
        assert.strictEqual(nodes['save-profile-btn'].disabled, false);
        assert.strictEqual(global.alertMsg, null, "Should not alert on success");
        console.log("✅ Happy Path Test Passed");
    } catch (err) {
        console.error("❌ Happy Path Test Failed:", err);
        process.exit(1);
    }

    // Test 2: Unauthenticated
    try {
        setupMocks();
        global.window.supabaseClient.auth.getUser = async () => ({ data: { user: null }, error: null });

        await window.saveProfileData();

        assert.strictEqual(global.alertMsg, "請登入");
        console.log("✅ Unauthenticated Test Passed");
    } catch (err) {
        console.error("❌ Unauthenticated Test Failed:", err);
        process.exit(1);
    }

    // Test 3: Supabase Error Handling
    try {
        const nodes = setupMocks();
        nodes['edit-display-name'] = global.document.getElementById('edit-display-name');
        nodes['edit-display-name'].value = 'New Name';
        nodes['edit-bio'] = global.document.getElementById('edit-bio');
        nodes['edit-bio'].value = 'New Bio';
        nodes['edit-banner-preview'] = global.document.getElementById('edit-banner-preview');
        nodes['edit-banner-preview'].src = '';

        global.window.supabaseClient.from = () => ({
            update: () => ({
                eq: async () => ({ error: new Error('Supabase update failed') })
            })
        });

        await window.saveProfileData();

        assert.strictEqual(nodes['save-profile-btn'].innerText, "儲存修改");
        assert.strictEqual(nodes['save-profile-btn'].disabled, false);
        assert.strictEqual(global.alertMsg, "更新失敗：Supabase update failed");
        console.log("✅ Supabase Error Handling Test Passed");
    } catch (err) {
        console.error("❌ Supabase Error Handling Test Failed:", err);
        process.exit(1);
    }

    // Test 4: R2 Upload Error Handling
    try {
        const nodes = setupMocks();
        nodes['edit-display-name'] = global.document.getElementById('edit-display-name');
        nodes['edit-display-name'].value = 'New Name';
        nodes['edit-bio'] = global.document.getElementById('edit-bio');
        nodes['edit-bio'].value = 'New Bio';

        // Trigger banner upload
        nodes['edit-banner-preview'] = global.document.getElementById('edit-banner-preview');
        nodes['edit-banner-preview'].src = 'data:image/webp;base64,...';

        global.uploadToR2 = async () => {
            throw new Error('Upload failed');
        };
        global.window.uploadToR2 = global.uploadToR2;

        await window.saveProfileData();

        assert.strictEqual(nodes['save-profile-btn'].innerText, "儲存修改");
        assert.strictEqual(nodes['save-profile-btn'].disabled, false);
        assert.strictEqual(global.alertMsg, "更新失敗：Upload failed");
        console.log("✅ R2 Upload Error Handling Test Passed");
    } catch (err) {
        console.error("❌ R2 Upload Error Handling Test Failed:", err);
        process.exit(1);
    }

    console.log("\n🎉 All tests passed successfully!");
}

runTests();
