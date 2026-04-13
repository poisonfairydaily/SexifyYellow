// ==========================================
// js/app.js - 全域邏輯與狀態管理 (完整修復無刪減版)
// ==========================================

// 1. 年齡驗證邏輯
window.verifyAge = function() {
    localStorage.setItem('ageVerified', 'true');
    const ageGate = document.getElementById('age-gate');
    if (ageGate) {
        ageGate.style.opacity = '0';
        setTimeout(() => {
            ageGate.style.display = 'none';
        }, 500);
    }
};

// 2. 底部導航欄分頁切換
window.switchTab = function(tabId, btn) {
    // 隱藏所有分頁
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.add('hidden');
        t.classList.remove('block', 'flex', 'flex-col');
    });
    
    // 顯示目標分頁
    const targetTab = document.getElementById(tabId);
    if(targetTab) {
        targetTab.classList.remove('hidden');
        if(tabId === 'messages-tab') {
            targetTab.classList.add('flex', 'flex-col');
        } else {
            targetTab.classList.add('block');
        }
    }
    
    // 重置按鈕樣式
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active', 'text-gray-900'); 
        b.classList.add('text-gray-400'); 
    });
    
    // 激活當前按鈕
    if(btn && btn.classList.contains('nav-btn')) { 
        btn.classList.add('nav-active', 'text-gray-900'); 
        btn.classList.remove('text-gray-400'); 
    }

    // 處理頂部搜尋按鈕的顯示/隱藏
    const searchBtn = document.getElementById('global-search-btn');
    if(searchBtn) {
        if(tabId === 'home-tab' || tabId === 'messages-tab') {
            searchBtn.classList.remove('hidden');
        } else {
            searchBtn.classList.add('hidden');
        }
    }

    // 切換分頁時觸發對應的渲染函數
    if (tabId === 'home-tab' && typeof window.renderDiscovery === 'function') {
        window.renderDiscovery();
    } else if (tabId === 'shop-tab' && typeof window.renderShop === 'function') {
        window.renderShop();
    } else if (tabId === 'messages-tab' && typeof window.renderMessages === 'function') {
        window.renderMessages();
    } else if (tabId === 'profile-tab' && typeof window.renderProfile === 'function') {
        window.renderProfile();
    }
};

// 3. 搜尋覆蓋層開關
window.toggleSearch = function(show) {
    const overlay = document.getElementById('search-overlay');
    if (overlay) {
        if (show) {
            overlay.classList.add('active');
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        } else {
            overlay.classList.remove('active');
        }
    }
};

// 4. 查看其他用戶專頁 (跳轉邏輯一致化)
window.viewOtherProfile = function(userId) {
    if (!userId) return;
    const myUserId = localStorage.getItem('userId');
    
    if (userId === myUserId) {
        // 如果點擊的是自己，直接切換到底部導航欄的「我」分頁
        const profileBtn = document.querySelectorAll('.nav-btn')[4]; 
        window.switchTab('profile-tab', profileBtn);
        window.toggleSearch(false);
    } else {
        // 如果是其他人，跳轉到統一的外部個人主頁
        window.location.href = `profile-view.html?userId=${userId}`;
    }
};

// 5. 全域即時通知設定 (Realtime badges)
window.setupGlobalRealtime = function(userId) {
    if (!userId || !window.supabaseClient) return;

    // 監聽一般通知
    window.supabaseClient.channel('global_notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
            const badge = document.getElementById('notification-badge');
            if (badge) badge.classList.remove('hidden');
        })
        .subscribe();

    // 監聽新訊息
    window.supabaseClient.channel('global_messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver=eq.${userId}` }, payload => {
            const msgBadge = document.getElementById('nav-msg-badge');
            if (msgBadge) msgBadge.classList.remove('hidden');
            
            // 如果剛好停留在訊息列表頁，自動刷新列表
            if (typeof window.renderMessages === 'function') {
                window.renderMessages();
            }
        })
        .subscribe();
};

// 6. 登入準備完成事件監聽
window.addEventListener('authReady', async () => {
    const homeTab = document.getElementById('home-tab');
    if (homeTab && !homeTab.classList.contains('hidden')) {
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
    }

    const userId = localStorage.getItem('userId');
    if (userId) {
        try {
            // 抓取未讀通知數量
            const { count } = await window.supabaseClient.from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);
            const notifBadge = document.getElementById('notification-badge');
            if (count > 0 && notifBadge) notifBadge.classList.remove('hidden');
            
            // 抓取未讀訊息數量
            const { count: msgCount } = await window.supabaseClient.from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver', userId)
                .eq('is_read', false);
            const msgBadge = document.getElementById('nav-msg-badge');
            if (msgCount > 0 && msgBadge) msgBadge.classList.remove('hidden');
        } catch(e) {
            console.warn('載入未讀標記時發生錯誤', e);
        }
        
        window.setupGlobalRealtime(userId);
    }
});

// 7. 頁面載入初始化與登出邏輯
document.addEventListener('DOMContentLoaded', () => {
    // 檢查是否已通過年齡驗證
    if (localStorage.getItem('ageVerified') === 'true') {
        const ageGate = document.getElementById('age-gate');
        if (ageGate) ageGate.style.display = 'none';
    }

    // 綁定登出按鈕
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("確定要登出帳號嗎？")) {
                if(window.supabaseClient) {
                    await window.supabaseClient.auth.signOut();
                }
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
            }
        });
    }
});
