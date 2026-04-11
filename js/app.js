// 1. 基本畫面狀態控制
function verifyAge() {
    const ageGate = document.getElementById('age-gate');
    if(ageGate) {
        ageGate.classList.add('opacity-0');
        setTimeout(() => { 
            ageGate.style.display = 'none'; 
            document.getElementById('app-content').classList.remove('blur-2xl', 'pointer-events-none'); 
        }, 500);
    }
}

// 2. 底部導航欄分頁切換 (極度嚴格版本，徹底解決疊加)
function switchTab(tabId, btn) {
    // 隱藏所有內容
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.add('hidden');
        t.classList.remove('block', 'flex', 'flex-col');
    });
    
    // 顯示目標內容
    const targetTab = document.getElementById(tabId);
    if(targetTab) {
        targetTab.classList.remove('hidden');
        if(tabId === 'messages-tab') {
            targetTab.classList.add('flex', 'flex-col'); // 訊息需要 flex
        } else {
            targetTab.classList.add('block');
        }
    }
    
    // 導航按鈕變色邏輯
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active', 'text-gray-900'); 
        b.classList.add('text-gray-400'); 
    });
    
    if(btn && btn.classList.contains('nav-btn')) { 
        btn.classList.add('nav-active', 'text-gray-900'); 
        btn.classList.remove('text-gray-400'); 
    }
    
    // 呼叫對應模組重新渲染資料
    if(tabId === 'home-tab' && typeof window.renderDiscovery === 'function') window.renderDiscovery();
    if(tabId === 'shop-tab' && typeof window.renderShop === 'function') window.renderShop();
    if(tabId === 'messages-tab' && typeof window.renderMessages === 'function') window.renderMessages();
    if(tabId === 'profile-tab' && typeof window.renderProfile === 'function') window.renderProfile();
}

// 3. 抽屜控制 (Drawer 控制)
// 左側滑出：通知
function toggleNotifications() {
    const drawer = document.getElementById('notification-drawer');
    const panel = document.getElementById('notification-panel');
    if(!drawer || !panel) return;

    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('-translate-x-full'), 10); // 由左向右
    } else {
        panel.classList.add('-translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 右側滑出：設定
function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const panel = document.getElementById('settings-panel');
    if(!drawer || !panel) return;

    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-x-full'), 10); // 由右向左
    } else {
        panel.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 4. Modal 輔助開關邏輯
function openFansSubsModal() { 
    toggleSettings(); // 先關閉設定側邊欄
    const modal = document.getElementById('fans-subs-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    if(typeof renderSubsList === 'function') renderSubsList();
    if(typeof renderFansList === 'function') renderFansList();
}
function closeFansSubsModal() { 
    const modal = document.getElementById('fans-subs-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function openEditProfile() {
    toggleSettings();
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

function openComments() { 
    const modal = document.getElementById('comment-sheet');
    const panel = document.getElementById('comment-panel');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => panel.classList.remove('translate-y-full'), 10);
}
function closeComments() { 
    const modal = document.getElementById('comment-sheet');
    const panel = document.getElementById('comment-panel');
    panel.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

// 5. 登出事件綁定
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("確定要登出帳號嗎？")) {
                if (typeof logoutUser === 'function') {
                    logoutUser();
                } else {
                    alert('登出功能異常，請確保 auth.js 已正確載入。');
                }
            }
        });
    }
});
