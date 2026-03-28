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

// 搜尋一鍵刪除邏輯
function handleSearch() {
    const val = document.getElementById('home-search').value;
    const clearBtn = document.getElementById('search-clear-btn');
    if(val.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
    
    if(typeof searchPosts === 'function') searchPosts();
}

function clearSearch() {
    document.getElementById('home-search').value = '';
    document.getElementById('search-clear-btn').classList.add('hidden');
    if(typeof searchPosts === 'function') searchPosts();
}

// 開關通知中心
function openNotifications() {
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
    renderSubsList(); // 從 profile.js 讀取渲染
    document.getElementById('fans-subs-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('fans-subs-modal').classList.remove('translate-x-full'), 10);
}
function closeFansSubsModal() {
    document.getElementById('fans-subs-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('fans-subs-modal').classList.add('hidden'), 300);
}