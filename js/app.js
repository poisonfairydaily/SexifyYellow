// ==========================================
// js/app.js - 全域邏輯、導航與安全驗證核心
// ==========================================

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
        searchBtn.classList.toggle('hidden', !(tabId === 'home-tab' || tabId === 'messages-tab'));
    }
    
    if(tabId === 'home-tab' && typeof window.renderDiscovery === 'function') window.renderDiscovery();
    if(tabId === 'messages-tab' && typeof window.renderMessages === 'function') window.renderMessages();
    if(tabId === 'profile-tab' && typeof window.renderProfile === 'function') window.renderProfile();
}

// 2. 年齡驗證核心 (安全加固：同步資料庫)
window.confirmAge = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入帳號後再進行驗證");

        // 強制更新後端狀態，這會觸發 RLS 權限開啟
        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ is_adult: true })
            .eq('id', user.id);

        if (error) throw error;

        const ageGate = document.getElementById('age-gate');
        if (ageGate) {
            ageGate.classList.add('opacity-0');
            setTimeout(() => ageGate.remove(), 500);
        }

        localStorage.setItem('ageVerified', 'true');
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (e) {
        console.error("驗證失敗:", e);
        alert("驗證寫入失敗，請確認資料庫 profile 表已有 is_adult (bool) 欄位。");
    }
};

// 3. 抽屜控制 (設定、通知)
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

async function toggleNotifications() {
    const drawer = document.getElementById('notification-drawer');
    const panel = document.getElementById('notification-panel');
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');
    if(!drawer || !panel) return;

    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-x-full'), 10);
        if (badge) badge.classList.add('hidden');

        const userId = localStorage.getItem('userId');
        if(!userId) return;

        list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-400"></i></div>`;

        try {
            await window.supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', userId);
            const { data: notifs } = await window.supabaseClient.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);

            if (!notifs || notifs.length === 0) {
                list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前沒有新通知</div>`;
                return;
            }

            const actorIds = [...new Set(notifs.map(n => n.actor_id).filter(Boolean))];
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', actorIds);
            const profMap = Object.fromEntries(profs?.map(p => [p.id, p]) || []);

            list.innerHTML = notifs.map(n => {
                const p = profMap[n.actor_id] || {};
                const text = n.type === 'like' ? '點讚了你的貼文' : (n.type === 'comment' ? '評論了你' : '關注了你');
                return `
                <div class="flex items-start gap-3 p-3 bg-white rounded-xl mb-2 border border-gray-50" onclick="viewOtherProfile('${n.actor_id}')">
                    <img src="${p.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-10 h-10 rounded-full">
                    <div class="flex-1">
                        <p class="text-sm"><b>${p.display_name || '用戶'}</b> ${text}</p>
                        <p class="text-[10px] text-gray-400">${new Date(n.created_at).toLocaleString()}</p>
                    </div>
                </div>`;
            }).join('');
        } catch (err) { list.innerHTML = `<div class="text-center py-10 text-red-400">載入失敗</div>`; }
    } else {
        panel.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 4. Modal 控制 (編輯、收藏、訂單)
function openEditProfile() {
    const m = document.getElementById('edit-profile-modal');
    m.classList.remove('hidden'); m.classList.add('flex');
    setTimeout(() => m.classList.remove('translate-y-full'), 10);
}
function closeEditProfile() {
    const m = document.getElementById('edit-profile-modal');
    m.classList.add('translate-y-full');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
}

function openBookmarksModal() {
    toggleSettings();
    const m = document.getElementById('bookmarks-modal');
    m.classList.remove('hidden'); m.classList.add('flex');
    setTimeout(() => m.classList.remove('translate-y-full'), 10);
    
    const list = document.getElementById('bookmarks-list');
    let bks = JSON.parse(localStorage.getItem('myBookmarks')) || [];
    if(bks.length === 0) { list.innerHTML = `<div class="text-center py-20 text-gray-400">無收藏</div>`; return; }
    list.innerHTML = bks.map(b => `
        <div class="bg-white p-2 rounded-xl border border-gray-100 mb-2" onclick="closeBookmarksModal(); viewPost('${b.id}')">
            <p class="text-xs line-clamp-2">${b.caption || '無標題'}</p>
        </div>
    `).join('');
}
function closeBookmarksModal() {
    const m = document.getElementById('bookmarks-modal');
    m.classList.add('translate-y-full');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
}

function openOrdersModal() {
    toggleSettings();
    const m = document.getElementById('orders-modal');
    m.classList.remove('hidden', 'translate-y-full'); m.classList.add('flex');
}
function closeOrdersModal() {
    const m = document.getElementById('orders-modal');
    m.classList.add('translate-y-full');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
}

// 5. 即時通訊監聽 (通知與訊息紅點)
function setupGlobalRealtime(userId) {
    if (!userId) return;
    window.supabaseClient.channel('global-sync')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        const b = document.getElementById('notification-badge');
        if (b) b.classList.remove('hidden');
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver=eq.${userId}` }, payload => {
        const mb = document.getElementById('nav-msg-badge');
        if (mb && window.activeRoomId !== payload.new.room_id) mb.classList.remove('hidden');
        if (document.getElementById('messages-tab') && !document.getElementById('messages-tab').classList.contains('hidden')) {
            if (typeof window.renderMessages === 'function') window.renderMessages();
        }
    }).subscribe();
}

// 6. 初始化與事件綁定
window.addEventListener('authReady', async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // 後端二次驗證年齡
    const { data: profile } = await window.supabaseClient.from('profiles').select('is_adult').eq('id', userId).single();
    if (profile?.is_adult) {
        const gate = document.getElementById('age-gate');
        if (gate) gate.remove();
        localStorage.setItem('ageVerified', 'true');
    }

    // 初始化紅點
    const { count: n } = await window.supabaseClient.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    if (n > 0) document.getElementById('notification-badge')?.classList.remove('hidden');

    const { count: m } = await window.supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('receiver', userId).eq('is_read', false);
    if (m > 0) document.getElementById('nav-msg-badge')?.classList.remove('hidden');

    setupGlobalRealtime(userId);
    
    // 首頁內容加載
    if (!document.getElementById('home-tab').classList.contains('hidden')) {
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('ageVerified') === 'true') {
        const gate = document.getElementById('age-gate');
        if (gate) gate.style.display = 'none';
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("確定要登出嗎？")) {
                localStorage.clear();
                window.location.reload();
            }
        });
    }
});
