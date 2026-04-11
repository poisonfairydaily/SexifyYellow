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

// 2. 底部導航欄分頁切換 (修復版：嚴格使用 hidden/block)
function switchTab(tabId, btn) {
    // 嚴格隱藏所有分頁
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.add('hidden');
        t.classList.remove('block', 'flex', 'flex-col'); // 清除可能干擾的佈局類別
    });
    
    // 顯示目標分頁
    const targetTab = document.getElementById(tabId);
    if(targetTab) {
        targetTab.classList.remove('hidden');
        // 如果是訊息分頁，需要 flex 佈局來排版
        if(tabId === 'messages-tab') {
            targetTab.classList.add('flex', 'flex-col');
        } else {
            targetTab.classList.add('block');
        }
    }
    
    // 重置所有底部導航按鈕的顏色
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active', 'text-gray-900'); 
        b.classList.add('text-gray-400'); 
    });
    
    // 將點擊的按鈕設為啟動顏色 (發佈按鈕沒有 nav-btn，不會受影響)
    if(btn && btn.classList.contains('nav-btn')) { 
        btn.classList.add('nav-active', 'text-gray-900'); 
        btn.classList.remove('text-gray-400'); 
    }
    
    // 觸發重新渲染，確保資料最新
    if(tabId === 'home-tab' && typeof window.renderDiscovery === 'function') window.renderDiscovery();
    if(tabId === 'shop-tab' && typeof window.renderShop === 'function') window.renderShop();
    if(tabId === 'messages-tab' && typeof window.renderMessages === 'function') window.renderMessages();
    if(tabId === 'profile-tab' && typeof window.renderProfile === 'function') window.renderProfile();
}

// 3. 通用 Modal 開關控制
function toggleModal(modalId, action) {
    const modal = document.getElementById(modalId);
    if(!modal) return;
    
    if (action === 'open') {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

// 4. 各類特定視窗開關
function openFansSubsModal(type) { toggleModal('fans-subs-modal', 'open'); }
function closeFansSubsModal() { toggleModal('fans-subs-modal', 'close'); }

function openEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    if(modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    }
}
function closeEditProfile() {
    const modal = document.getElementById('edit-profile-modal');
    if(modal) {
        modal.classList.add('translate-y-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// 發佈視窗
function openUploadModal() { 
    const modal = document.getElementById('upload-modal');
    const panel = document.getElementById('upload-panel');
    if(modal && panel) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => panel.classList.remove('translate-y-full'), 10);
    }
}

function closeUploadModal() { 
    const modal = document.getElementById('upload-modal');
    const panel = document.getElementById('upload-panel');
    if(modal && panel) {
        panel.classList.add('translate-y-full');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    }
}

function openComments() { 
    const sheet = document.getElementById('comment-sheet');
    const panel = document.getElementById('comment-panel');
    if(sheet && panel) {
        sheet.classList.remove('hidden');
        sheet.classList.add('flex');
        setTimeout(() => panel.classList.remove('translate-y-full'), 10);
    }
}
function closeComments() { 
    const sheet = document.getElementById('comment-sheet');
    const panel = document.getElementById('comment-panel');
    if(sheet && panel) {
        panel.classList.add('translate-y-full');
        setTimeout(() => {
            sheet.classList.add('hidden');
            sheet.classList.remove('flex');
        }, 300);
    }
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
