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

// 4. Modal 控制與搜尋列
function toggleSearch(show) {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.add('active');
        setTimeout(() => document.getElementById('searchInput').focus(), 100);
    } else {
        overlay.classList.remove('active');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '<div class="text-center text-gray-400 mt-10 text-sm">請在上方輸入關鍵字開始搜尋...</div>';
    }
}

function openEditProfile() {
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

// ===== 新增：收藏、訂單、聯絡我們 =====
function openBookmarksModal() {
    toggleSettings();
    const modal = document.getElementById('bookmarks-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    
    // 渲染收藏內容
    const list = document.getElementById('bookmarks-list');
    let bookmarks = JSON.parse(localStorage.getItem('myBookmarks')) || [];
    if(bookmarks.length === 0) {
        list.innerHTML = `<div class="text-center py-20 text-gray-400">目前沒有收藏貼文</div>`;
        return;
    }
    list.innerHTML = bookmarks.map(b => `
        <div class="masonry-item cursor-pointer bg-white p-2 border border-gray-100 rounded-xl" onclick="closeBookmarksModal(); viewPost('${b.id}')">
            <div class="flex items-center gap-2 mb-2">
                <img src="${b.authorAvatar}" class="w-5 h-5 rounded-full object-cover">
                <span class="text-[10px] font-bold text-gray-700">${b.authorName}</span>
            </div>
            ${b.media_url ? `<img src="${b.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字內容</div>`}
            <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed">${b.caption || ''}</p>
        </div>
    `).join('');
}
function closeBookmarksModal() {
    const modal = document.getElementById('bookmarks-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

function openOrdersModal() {
    toggleSettings();
    const modal = document.getElementById('orders-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
}
function closeOrdersModal() {
    const modal = document.getElementById('orders-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

function openContactModal() {
    toggleSettings();
    const modal = document.getElementById('contact-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
}
function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

// 核心修復：年齡驗證邏輯
function verifyAge() {
    const ageGate = document.getElementById('age-gate');
    if (ageGate) {
        ageGate.classList.add('opacity-0');
        setTimeout(() => {
            ageGate.classList.add('hidden');
            ageGate.style.display = 'none';
        }, 500);
    }
    localStorage.setItem('ageVerified', 'true');
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('ageVerified') === 'true') {
        const ageGate = document.getElementById('age-gate');
        if (ageGate) ageGate.style.display = 'none';
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
