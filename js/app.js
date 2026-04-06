// 年齡驗證邏輯
function verifyAge() {
    document.getElementById('age-gate').classList.add('opacity-0');
    setTimeout(() => { 
        document.getElementById('age-gate').style.display = 'none'; 
        document.getElementById('app-content').classList.remove('blur-2xl', 'pointer-events-none'); 
    }, 500);
}

// 底部 Tab 切換邏輯
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active'); 
        b.classList.add('text-gray-400'); 
    });
    
    if(btn) { 
        btn.classList.add('nav-active'); 
        btn.classList.remove('text-gray-400'); 
    }
    
    if(tabId === 'shop-tab' && typeof renderShop === 'function') renderShop();
    if(tabId === 'profile-tab' && typeof renderProfile === 'function') renderProfile();
    if(tabId === 'messages-tab' && typeof renderMessages === 'function') renderMessages();
}

// 控制全站左側設定面板
function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const panel = document.getElementById('settings-panel');
    
    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('-translate-x-full'), 10);
    } else {
        panel.classList.add('-translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 初始化 UI 事件
function initUIEvents() {
    // 綁定設定面板中的登出按鈕
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("確定要登出帳號嗎？")) {
                if (typeof logoutUser === 'function') {
                    logoutUser();
                }
            }
        });
    }
}

// 頁面加載完成後執行初始化
document.addEventListener('DOMContentLoaded', () => {
    initUIEvents();
});

// 開關通知中心
function openNotifications() {
    toggleSettings();
    document.getElementById('notifications-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('notifications-modal').classList.remove('translate-x-full'), 10);
}
function closeNotifications() {
    document.getElementById('notifications-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('notifications-modal').classList.add('hidden'), 300);
}

// 開關個人中心
function openPersonalCenter() {
    toggleSettings();
    document.getElementById('personal-center-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('personal-center-modal').classList.remove('translate-x-full'), 10);
}
function closePersonalCenter() {
    document.getElementById('personal-center-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('personal-center-modal').classList.add('hidden'), 300);
}

// 開關粉絲與訂閱名單
function openFansSubsModal() {
    toggleSettings();
    if(typeof renderSubsList === 'function') renderSubsList();
    if(typeof renderFansList === 'function') renderFansList(); // 調用 profile.js 中的粉絲列表渲染
    
    document.getElementById('fans-subs-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('fans-subs-modal').classList.remove('translate-x-full'), 10);
}
function closeFansSubsModal() {
    document.getElementById('fans-subs-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('fans-subs-modal').classList.add('hidden'), 300);
}
