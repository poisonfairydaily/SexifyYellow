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
                list.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-gray-400 mt-10">
                        <i class="fa-regular fa-bell-slash text-4xl mb-3 opacity-50"></i>
                        <p class="text-sm font-bold">目前沒有新通知</p>
                    </div>`;
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
                let text = '';
                let icon = '';
                if (n.type === 'like') { text = '對你的貼文按了讚'; icon = '<i class="fa-solid fa-heart text-sexify"></i>'; }
                else if (n.type === 'comment') { text = '在你的貼文留言'; icon = '<i class="fa-solid fa-comment text-blue-500"></i>'; }
                else if (n.type === 'subscribe') { text = '成為了你的新粉絲'; icon = '<i class="fa-solid fa-user-plus text-green-500"></i>'; }

                return `
                <div class="flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer" onclick="viewOtherProfile('${n.actor_id}')">
                    <img src="${avatar}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1">
                        <p class="text-sm text-gray-800"><span class="font-bold">${actorName}</span> ${text}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${new Date(n.created_at).toLocaleString()}</p>
                    </div>
                    <div class="text-lg">${icon}</div>
                </div>`;
            }).join('');
        } catch (err) {
            console.error("載入通知失敗:", err);
            list.innerHTML = `<div class="text-center text-red-400 text-sm mt-10">無法載入通知。</div>`;
        }

    } else {
        panel.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 4. Modal 控制與個人資料安全處理
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

// 核心功能更新：分表儲存個人資料
async function saveUserProfile(formData) {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
        // 分割資料：公開 vs 私密
        const publicUpdate = {
            display_name: formData.display_name,
            avatar_url: formData.avatar_url,
            bio: formData.bio,
            updated_at: new Date()
        };

        const privateUpdate = {
            id: userId, // 確保 ID 一致
            birthday: formData.birthday,
            contact_email: formData.contact_email,
            updated_at: new Date()
        };

        // 並行更新兩張表
        const [resPublic, resPrivate] = await Promise.all([
            window.supabaseClient.from('profiles').update(publicUpdate).eq('id', userId),
            window.supabaseClient.from('user_private_data').upsert(privateUpdate) // 使用 upsert 避免初次建立時出錯
        ]);

        if (resPublic.error) throw resPublic.error;
        if (resPrivate.error) throw resPrivate.error;

        alert("資料儲存成功！");
        closeEditProfile();
        if (typeof window.renderProfile === 'function') window.renderProfile();
    } catch (err) {
        console.error("更新個人資料失敗:", err);
        alert("更新失敗，請檢查資料格式。");
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

// 收藏、訂單
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

// 5. 核心：年齡驗證防卡死 + 背景安全同步
window.verifyAge = async function() {
    const ageGate = document.getElementById('age-gate');
    if (ageGate) {
        ageGate.style.display = 'none';
        ageGate.classList.add('hidden', 'opacity-0');
    }
    localStorage.setItem('ageVerified', 'true');

    if (typeof window.renderDiscovery === 'function') {
        window.renderDiscovery();
    }

    try {
        if (window.supabaseClient) {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (user) {
                await window.supabaseClient.from('profiles').update({ is_adult: true }).eq('id', user.id);
            }
        }
    } catch (e) {
        console.warn("背景同步失敗，但允許進入", e);
    }
};

window.confirmAge = window.verifyAge;
window.enterSite = window.verifyAge;

// 實時推播監聽
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
                localStorage.clear();
                window.location.reload();
            }
        });
    }
});
