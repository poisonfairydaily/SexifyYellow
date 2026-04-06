// js/app.js

// 頁面加載時的初始化
document.addEventListener('DOMContentLoaded', () => {
    initUIEvents();
    checkSession();
});

function initUIEvents() {
    // ... 原有的 Tab 切換邏輯 ...

    // 年齡驗證按鈕
    const ageGateBtn = document.getElementById('age-gate-confirm');
    if (ageGateBtn) {
        ageGateBtn.addEventListener('click', () => {
            document.getElementById('age-gate').classList.add('hidden');
            localStorage.setItem('age-verified', 'true');
        });
    }

    // 【新增】綁定登出按鈕
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('確定要登出嗎？')) {
                await logoutUser(); // 調用 auth.js 中的函數
            }
        });
    }
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        document.getElementById('auth-modal').classList.remove('hidden');
    } else {
        initApp(session.user);
    }
}

function initApp(user) {
    // 這裡放置登入後需要執行的初始化，例如：
    // loadDiscovery();
    // subscribeMessages(user.id);
    console.log('App Initialized for:', user.email);
}
