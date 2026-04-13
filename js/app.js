// ==========================================
// js/app.js - 全域邏輯與導航完整版
// ==========================================

window.switchTab = function(tabId, btn) {
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
    
    // 自動觸發對應分頁的渲染
    if (tabId === 'home-tab' && typeof renderDiscovery === 'function') renderDiscovery();
    if (tabId === 'profile-tab' && typeof renderProfile === 'function') renderProfile();
    if (tabId === 'messages-tab' && typeof renderMessages === 'function') renderMessages();
    if (tabId === 'shop-tab' && typeof renderShop === 'function') renderShop();
}

window.viewOtherProfile = function(userId) {
    const myUserId = localStorage.getItem('userId');
    if (!userId) return;
    
    // 如果點到自己，跳回個人中心；否則進入他人專頁
    if (userId === myUserId) {
        switchTab('profile-tab', document.querySelector('[onclick*="profile-tab"]'));
    } else {
        window.location.href = `profile.html?userId=${userId}`;
    }
}

window.setupGlobalRealtime = function(userId) {
    if (window.globalNotifChannel) window.globalNotifChannel.unsubscribe();
    window.globalNotifChannel = window.supabaseClient.channel('global_notif_' + userId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
            const badge = document.getElementById('notification-badge');
            if(badge) badge.classList.remove('hidden');
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver=eq.${userId}` }, payload => {
            const badge = document.getElementById('nav-msg-badge');
            if(badge) badge.classList.remove('hidden');
            if(typeof renderMessages === 'function' && document.getElementById('messages-tab') && !document.getElementById('messages-tab').classList.contains('hidden')) {
                renderMessages();
            }
        }).subscribe();
}

document.addEventListener('authReady', async () => {
    const homeTab = document.getElementById('home-tab');
    if (homeTab && !homeTab.classList.contains('hidden')) {
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
    }

    const userId = localStorage.getItem('userId');
    if (userId) {
        try {
            const { count } = await window.supabaseClient.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
            if (count > 0 && document.getElementById('notification-badge')) document.getElementById('notification-badge').classList.remove('hidden');
            
            const { count: msgCount } = await window.supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('receiver', userId).eq('is_read', false);
            if (msgCount > 0 && document.getElementById('nav-msg-badge')) document.getElementById('nav-msg-badge').classList.remove('hidden');
        } catch(e) {}
        setupGlobalRealtime(userId);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('ageVerified') === 'true') {
        const ageGate = document.getElementById('age-gate');
        if (ageGate) ageGate.style.display = 'none';
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm("確定要登出嗎？")) {
                await window.supabaseClient.auth.signOut();
            }
        });
    }
});
