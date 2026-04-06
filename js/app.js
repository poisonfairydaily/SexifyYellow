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

function openFansSubsModal() { toggleSettings(); toggleModal('fans-subs-modal', 'open'); }
function closeFansSubsModal() { toggleModal('fans-subs-modal', 'close'); }

function openNotifications() { toggleModal('notifications-modal', 'open'); }
function closeNotifications() { toggleModal('notifications-modal', 'close'); }

function openEditProfile() { document.getElementById('edit-profile-modal').classList.remove('hidden'); }
function closeEditProfile() { document.getElementById('edit-profile-modal').classList.add('hidden'); }

function openUploadModal() { toggleModal('upload-modal', 'open'); }
function closeUploadModal() { toggleModal('upload-modal', 'close'); }

function openComments() { toggleModal('comment-sheet', 'open'); }
function closeComments() { toggleModal('comment-sheet', 'close'); }

function closeDetail() { toggleModal('post-detail', 'close'); }
function closeChat() { toggleModal('chat-modal', 'close'); }

// 5. 搜尋功能綁定
function handleSearch() {
    const val = document.getElementById('home-search').value;
    const clearBtn = document.getElementById('search-clear-btn');
    if(val.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
    
    if(typeof window.renderDiscovery === 'function') window.renderDiscovery(val);
}
function clearSearch() {
    document.getElementById('home-search').value = '';
    document.getElementById('search-clear-btn').classList.add('hidden');
    if(typeof window.renderDiscovery === 'function') window.renderDiscovery();
}

function searchShop() {
    const val = document.getElementById('shop-search').value;
    const clearBtn = document.getElementById('shop-search-clear-btn');
    if(val.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
    
    if(typeof window.renderShop === 'function') window.renderShop(val);
}
function clearShopSearch() {
    document.getElementById('shop-search').value = '';
    document.getElementById('shop-search-clear-btn').classList.add('hidden');
    if(typeof window.renderShop === 'function') window.renderShop();
}

// 6. 登出事件監聽器綁定
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

// 【修復核心 3】控制邏輯順序：等待 auth.js 發出「authReady」後，才進行首次 UI 渲染
window.addEventListener('authReady', () => {
    // 這樣可以保證首頁渲染時，localStorage 裡絕對已經有最新的 userId 了
    const homeBtn = document.querySelector('.nav-btn'); // 抓取第一個導航按鈕 (首頁)
    if (homeBtn && document.getElementById('home-tab')) {
        switchTab('home-tab', homeBtn);
    }
});
