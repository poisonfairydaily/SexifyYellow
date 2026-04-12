// 1. 底部導航欄分頁切換
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.add('hidden');
        t.classList.remove('block', 'flex', 'flex-col');
    });
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) {
        targetTab.classList.remove('hidden');
        if(tabId === 'messages-tab') targetTab.classList.add('flex', 'flex-col');
        else targetTab.classList.add('block');
    }
    
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active', 'text-gray-900'); 
        b.classList.add('text-gray-400'); 
    });
    
    if(btn && btn.classList.contains('nav-btn')) { 
        btn.classList.add('nav-active', 'text-gray-900'); 
        btn.classList.remove('text-gray-400'); 
    }

    // 控制搜尋按鈕只在首頁與訊息出現
    const searchBtn = document.getElementById('global-search-btn');
    if(searchBtn) {
        if(tabId === 'home-tab' || tabId === 'messages-tab') {
            searchBtn.classList.remove('hidden');
        } else {
            searchBtn.classList.add('hidden');
        }
    }
    
    if(tabId === 'home-tab' && typeof window.renderDiscovery === 'function') window.renderDiscovery();
    if(tabId === 'messages-tab' && typeof window.renderMessages === 'function') window.renderMessages();
    if(tabId === 'profile-tab' && typeof window.renderProfile === 'function') window.renderProfile();
}

// 2. 左側：設定抽屜
function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const panel = document.getElementById('settings-panel');
    if(!drawer || !panel) return;
    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('-translate-x-full'), 10);
    } else {
        panel.classList.add('-translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 3. 右側：通知抽屜
function toggleNotifications() {
    const drawer = document.getElementById('notification-drawer');
    const panel = document.getElementById('notification-panel');
    if(!drawer || !panel) return;
    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-x-full'), 10);
    } else {
        panel.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 4. Modal 控制
function openEditProfile() {
    toggleSettings(); // 關閉左側設定
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
}
function closeEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

function openUploadModal() { 
    const modal = document.getElementById('upload-modal');
    const panel = document.getElementById('upload-panel');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => panel.classList.remove('translate-y-full'), 10);
}
function closeUploadModal() { 
    const modal = document.getElementById('upload-modal');
    const panel = document.getElementById('upload-panel');
    panel.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

// 5. 核心修復：年齡驗證邏輯
function verifyAge() {
    const ageGate = document.getElementById('age-gate');
    if (ageGate) {
        ageGate.classList.add('opacity-0');
        setTimeout(() => {
            ageGate.classList.add('hidden');
            ageGate.style.display = 'none';
        }, 500);
    }
    // 記錄已驗證，下次整理網頁不阻擋
    localStorage.setItem('ageVerified', 'true');
}

document.addEventListener('DOMContentLoaded', () => {
    // 檢查是否已經驗證過年齡
    if (localStorage.getItem('ageVerified') === 'true') {
        const ageGate = document.getElementById('age-gate');
        if (ageGate) {
            ageGate.style.display = 'none';
        }
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("確定要登出帳號嗎？")) {
                if (typeof logoutUser === 'function') logoutUser();
            }
        });
    }
});
