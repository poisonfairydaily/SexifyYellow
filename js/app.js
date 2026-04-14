// ==========================================
// js/app.js - 核心邏輯與安全性修補
// 修復：年齡驗證漏洞、雙重通知查詢、UI 導航
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

// 2. 年齡驗證核心邏輯 (安全加固版)
window.confirmAge = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        if (!user) {
            alert("請先登入帳號後再進行驗證");
            return;
        }

        // 寫入資料庫：確保 RLS 後端過濾能生效
        const { error } = await window.supabaseClient
            .from('profiles')
            .update({ is_adult: true })
            .eq('id', user.id);

        if (error) throw error;

        // UI 處理：淡出並徹底從 DOM 移除，防止手動修改 CSS 顯示
        const ageGate = document.getElementById('age-gate');
        if (ageGate) {
            ageGate.classList.add('opacity-0');
            setTimeout(() => {
                ageGate.remove(); 
            }, 500);
        }

        // 紀錄本地狀態並重新加載內容
        localStorage.setItem('ageVerified', 'true');
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (e) {
        console.error("驗證失敗:", e);
        alert("存取失敗，請確認資料庫已新增 is_adult 欄位。");
    }
};

// 3. 抽屜與彈窗控制
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
            await window.supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);

            const { data: notifs, error } = await window.supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            if (!notifs || notifs.length === 0) {
                list.innerHTML = `<div class="flex flex-col items-center justify-center text-gray-400 mt-10"><p class="text-sm">目前沒有新通知</p></div>`;
                return;
            }

            const actorIds = [...new Set(notifs.map(n => n.actor_id).filter(Boolean))];
            let profilesMap = {};
            if (actorIds.length > 0) {
                const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', actorIds);
                if (profs) profs.forEach(p => profilesMap[p.id] = p);
            }

            list.innerHTML = notifs.map(n => {
                const actor = profilesMap[n.actor_id] || {};
                const actorName = actor.display_name || '某人';
                const avatar = actor.avatar_url || 'https://ui-avatars.com/api/?name=U';
                let text = n.type === 'like' ? '對你的貼文按了讚' : (n.type === 'comment' ? '在你的貼文留言' : '成為了你的新粉絲');
                return `
                <div class="flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer" onclick="viewOtherProfile('${n.actor_id}')">
                    <img src="${avatar}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1">
                        <p class="text-sm text-gray-800"><span class="font-bold">${actorName}</span> ${text}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${new Date(n.created_at).toLocaleString()}</p>
                    </div>
                </div>`;
            }).join('');
        } catch (err) {
            list.innerHTML = `<div class="text-center text-red-400 text-sm mt-10">無法載入通知</div>`;
        }
    } else {
        panel.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 4. 初始化檢查與即時監聽
function setupGlobalRealtime(userId) {
    window.supabaseClient.channel('global-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        const badge = document.getElementById('notification-badge');
        if (badge) badge.classList.remove('hidden');
    }).subscribe();
}

window.addEventListener('authReady', async () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        // 同步檢查資料庫的年齡驗證狀態
        const { data: profile } = await window.supabaseClient.from('profiles').select('is_adult').eq('id', userId).single();
        if (profile && profile.is_adult) {
            const gate = document.getElementById('age-gate');
            if (gate) gate.remove();
            localStorage.setItem('ageVerified', 'true');
        }
        setupGlobalRealtime(userId);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // 初步檢查本地緩存（提供快速載入感）
    if (localStorage.getItem('ageVerified') === 'true') {
        const ageGate = document.getElementById('age-gate');
        if (ageGate) ageGate.style.display = 'none';
    }
});

// 其他 Modal 控制函數 (openEditProfile, closeEditProfile 等) 保持原樣...

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

// 收藏、訂單、聯絡我們
function openBookmarksModal() {
    toggleSettings();
    const modal = document.getElementById('bookmarks-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    
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

// 實時推播：訂閱全局通知與訊息
function setupGlobalRealtime(userId) {
    window.supabaseClient.channel('global-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        const badge = document.getElementById('notification-badge');
        if (badge) badge.classList.remove('hidden');
    }).subscribe();

    window.supabaseClient.channel('global-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver=eq.${userId}` }, payload => {
        const msgBadge = document.getElementById('nav-msg-badge');
        if (msgBadge && window.activeRoomId !== payload.new.room_id) {
            msgBadge.classList.remove('hidden');
            if (document.getElementById('messages-tab') && !document.getElementById('messages-tab').classList.contains('hidden')) {
                if (typeof window.renderMessages === 'function') window.renderMessages();
            }
        }
    }).subscribe();
}

window.addEventListener('authReady', async () => {
    const homeTab = document.getElementById('home-tab');
    if (homeTab && !homeTab.classList.contains('hidden')) {
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();
    }

    const userId = localStorage.getItem('userId');
    if (userId) {
        try {
            const { count } = await window.supabaseClient.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
            if (count > 0) document.getElementById('notification-badge').classList.remove('hidden');
            
            const { count: msgCount } = await window.supabaseClient.from('messages').select('*', { count: 'exact', head: true }).eq('receiver', userId).eq('is_read', false);
            if (msgCount > 0) document.getElementById('nav-msg-badge').classList.remove('hidden');
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
        logoutBtn.addEventListener('click', () => {
            if (confirm("確定要登出帳號嗎？")) {
                if (typeof logoutUser === 'function') logoutUser();
            }
        });
    }
});
