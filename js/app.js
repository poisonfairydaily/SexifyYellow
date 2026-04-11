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

// 2. 底部導航欄分頁切換
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active'); 
        b.classList.add('text-gray-400'); 
    });
    
    if(btn) { 
        btn.classList.add('nav-active'); 
        btn.classList.remove('text-gray-400'); 
    }
    
    // 觸發其他腳本中的渲染函數
    if(tabId === 'home-tab' && typeof window.renderDiscovery === 'function') window.renderDiscovery();
    if(tabId === 'shop-tab' && typeof window.renderShop === 'function') window.renderShop();
    if(tabId === 'messages-tab' && typeof window.renderMessages === 'function') window.renderMessages();
    // 呼叫個人頁面渲染
    if(tabId === 'profile-tab' && typeof window.renderProfile === 'function') window.renderProfile();
}

// 3. 設定抽屜 (Drawer)
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

// 4. Modal 輔助開關邏輯
function toggleModal(modalId, action) {
    const modal = document.getElementById(modalId);
    if(!modal) return;
    
    const panel = modal.firstElementChild; 

    if (action === 'open') {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if(modal.classList.contains('translate-x-full')) modal.classList.remove('translate-x-full');
            if(modal.classList.contains('translate-y-full')) modal.classList.remove('translate-y-full');
            if(panel && panel.classList.contains('translate-y-full')) panel.classList.remove('translate-y-full');
        }, 10);
    } else {
        if(modal.classList.contains('flex-col') || modal.id === 'fans-subs-modal' || modal.id.includes('center')) {
             modal.classList.add('translate-x-full');
        } else if (panel) {
             panel.classList.add('translate-y-full');
        }
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// === 各類 Modal 對應開關 ===
function openPersonalCenter() { toggleSettings(); toggleModal('personal-center-modal', 'open'); }
function closePersonalCenter() { toggleModal('personal-center-modal', 'close'); }

function openFansSubsModal() { 
    toggleSettings(); 
    if(typeof renderSubsList === 'function') renderSubsList();
    if(typeof renderFansList === 'function') renderFansList();
    toggleModal('fans-subs-modal', 'open'); 
}
function closeFansSubsModal() { toggleModal('fans-subs-modal', 'close'); }

// 【新增】編輯個人資料視窗
function openEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
}
function closeEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function openUploadModal() { toggleModal('upload-modal', 'open'); }
function closeUploadModal() { toggleModal('upload-modal', 'close'); }

function openComments() { toggleModal('comment-sheet', 'open'); }
function closeComments() { toggleModal('comment-sheet', 'close'); }

// 5. 登出事件監聽器綁定
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

// 6. 控制邏輯順序
window.addEventListener('authReady', () => {
    const homeBtn = document.querySelector('.nav-btn'); 
    if (homeBtn && document.getElementById('home-tab')) {
        switchTab('home-tab', homeBtn);
    }
});