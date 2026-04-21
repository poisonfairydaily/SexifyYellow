// ==========================================
// js/app.js - 全域邏輯、導航、長按手勢與分享核心
// ==========================================

// ✨ 新增：全域快取 User ID，防止 Supabase Lock Stolen 報錯
window.cachedMyUserId = null;

// 防 XSS 攻擊的核心過濾器
window.escapeHTML = function(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        };
        return charsToReplace[tag] || tag;
    });
};

// ✨ 文字安全過濾器 (Anti-Spam & Phishing)
window.containsToxicContent = function(text) {
    if (!text) return false;
    // 1. 攔截常見短網址
    const shortLinkRegex = /(bit\.ly|t\.co|tinyurl|reurl\.cc|pse\.is)/i;
    // 2. 攔截詐騙特徵
    const scamRegex = /(加賴|加line|加微信|t\.me\/|line\.me\/|投資群|免費領)/i;
    return shortLinkRegex.test(text) || scamRegex.test(text);
};

// 1. 底部導航欄分頁切換
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
    
    if(tabId === 'home-tab' && typeof window.renderDiscovery === 'function') window.renderDiscovery();
    if(tabId === 'messages-tab' && typeof window.renderMessages === 'function') window.renderMessages();
    if(tabId === 'profile-tab' && typeof window.renderProfile === 'function') window.renderProfile();
};

// 2. 左側：設定抽屜
window.toggleSettings = function() {
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
};

// 3. 右側：通知抽屜 (已加入 Cache 優化)
window.toggleNotifications = async function() {
    const drawer = document.getElementById('notification-drawer');
    const panel = document.getElementById('notification-panel');
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');
    if(!drawer || !panel) return;

    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-x-full'), 10);
        if (badge) badge.classList.add('hidden');

        let userId = window.cachedMyUserId;
        if (!userId && window.supabaseClient) {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            userId = session?.user?.id;
            window.cachedMyUserId = userId;
        }
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
};

// 4. Modal 控制與個人資料處理
window.toggleSearch = function(show) {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;
    if (show) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        setTimeout(() => {
            overlay.classList.remove('translate-y-full');
            document.getElementById('searchInput').focus();
        }, 10);
    } else {
        overlay.classList.add('translate-y-full');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
            document.getElementById('searchInput').value = '';
            document.getElementById('searchResults').innerHTML = '<div class="text-center text-gray-400 mt-10 text-sm">請在上方輸入關鍵字開始搜尋...</div>';
        }, 300);
    }
};

window.saveUserProfile = async function(formData) {
    let userId = window.cachedMyUserId;
    if (!userId && window.supabaseClient) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        userId = session?.user?.id;
    }
    if (!userId) return;

    try {
        const publicUpdate = {
            display_name: formData.display_name,
            avatar_url: formData.avatar_url,
            bio: formData.bio,
            updated_at: new Date()
        };

        const privateUpdate = {
            id: userId,
            birthday: formData.birthday,
            contact_email: formData.contact_email,
            updated_at: new Date()
        };

        const [resPublic, resPrivate] = await Promise.all([
            window.supabaseClient.from('profiles').update(publicUpdate).eq('id', userId),
            window.supabaseClient.from('user_private_data').upsert(privateUpdate) 
        ]);

        if (resPublic.error) throw resPublic.error;
        if (resPrivate.error) throw resPrivate.error;

        alert("資料儲存成功！");
        window.closeEditProfile();
        if (typeof window.renderProfile === 'function') window.renderProfile();
    } catch (err) {
        console.error("更新個人資料失敗:", err);
        alert("更新失敗，請檢查資料格式。");
    }
};

window.openEditProfile = function() {
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
};

window.closeEditProfile = function() {
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

// 收藏、訂單與聯絡
window.openBookmarksModal = function() {
    toggleSettings();
    const modal = document.getElementById('bookmarks-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    
    const list = document.getElementById('bookmarks-list');
    let bookmarks = JSON.parse(localStorage.getItem('myBookmarks')) || [];
    if(bookmarks.length === 0) {
        list.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold">目前沒有收藏貼文</div>`;
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
};

window.closeBookmarksModal = function() {
    const modal = document.getElementById('bookmarks-modal');
    if(!modal) return;
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

window.openOrdersModal = function() {
    toggleSettings();
    const modal = document.getElementById('orders-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
};

window.closeOrdersModal = function() {
    const modal = document.getElementById('orders-modal');
    if(!modal) return;
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

window.openContactModal = function() {
    toggleSettings();
    const modal = document.getElementById('contact-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
};

window.closeContactModal = function() {
    const modal = document.getElementById('contact-modal');
    if(!modal) return;
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
};

// ✨ 登出 (清除快取)
window.logoutUser = async function() {
    if (confirm("確定要登出帳號嗎？")) {
        await window.supabaseClient.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.cachedMyUserId = null;
        window.location.href = 'login.html'; 
    }
};

// ==========================================
// 全域狀態：動態更新下方導覽列紅點 (已加入 Cache 優化)
// ==========================================
window.updateGlobalMessageBadge = async function() {
    let userId = window.cachedMyUserId;
    if (!userId && window.supabaseClient) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        userId = session?.user?.id;
        window.cachedMyUserId = userId;
    }
    if (!userId || !window.supabaseClient) return;
    
    const msgBadge = document.getElementById('nav-msg-badge');
    if (!msgBadge) return;

    try {
        const { count } = await window.supabaseClient.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver', userId).eq('is_read', false);

        if (count > 0) {
            msgBadge.classList.remove('hidden');
        } else {
            msgBadge.classList.add('hidden');
        }
    } catch(e) {
        console.warn("更新全域訊息標記失敗", e);
    }
};

// ==========================================
// 實時推播監聽與初始化
// ==========================================
function setupGlobalRealtime(userId) {
    if (!window.supabaseClient) return;
    
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

// 應用程式初始化
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        window.cachedMyUserId = session.user.id; // ✨ 初始化時寫入快取
        const userId = session.user.id;
        
        if (typeof window.renderDiscovery === 'function') {
            window.renderDiscovery();
        }

        try {
            const { count } = await window.supabaseClient.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
            if (count > 0) document.getElementById('notification-badge').classList.remove('hidden');
            
            await window.updateGlobalMessageBadge();
        } catch(e) {
            console.warn("載入未讀標記失敗", e);
        }
        
        setupGlobalRealtime(userId);
    }
});

// ==========================================
// ✨ 全域分享功能 (Web Share API)
// ==========================================
window.handleShare = async function(postId, titleText) {
    const shareData = {
        title: 'SFY 推薦',
        text: titleText || '快來看看這則貼文！',
        url: window.location.origin + '?post=' + postId
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareData.url);
            alert('連結已複製到剪貼簿！');
        }
    } catch (err) {
        console.log('分享取消或發生錯誤', err);
    }
};

// ==========================================
// ✨ 觸覺反饋與長按全螢幕預覽 (Haptic Touch)
// ==========================================
window.longPressTimer = null;
window.isLongPressActive = false;

window.startLongPress = function(e, postId, mediaUrl) {
    if (!mediaUrl) return; 
    window.isLongPressActive = false;
    const card = e.currentTarget;
    card.style.transform = 'scale(0.96)'; 

    window.longPressTimer = setTimeout(() => {
        window.isLongPressActive = true;
        if (navigator.vibrate) navigator.vibrate(50); 
        window.showImagePreview(postId, mediaUrl);
    }, 400); 
};

window.cancelLongPress = function(e, postId) {
    clearTimeout(window.longPressTimer); 
    const card = e.currentTarget;
    if (card) card.style.transform = 'scale(1)'; 
};

window.showImagePreview = function(postId, mediaUrl) {
    let previewModal = document.getElementById('haptic-preview-modal');
    
    if (!previewModal) {
        previewModal = document.createElement('div');
        previewModal.id = 'haptic-preview-modal';
        previewModal.className = 'fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md hidden flex flex-col items-center justify-center p-4 transition-opacity duration-300 opacity-0 touch-none';
        
        previewModal.innerHTML = `
            <img id="haptic-preview-img" src="" class="max-w-full max-h-[85vh] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain transform scale-95 transition-transform duration-300 pointer-events-none">
        `;
        document.body.appendChild(previewModal);

        const closeHandler = (e) => {
            e.preventDefault();
            window.closeImagePreview();
        };
        previewModal.addEventListener('pointerup', closeHandler);
        previewModal.addEventListener('touchend', closeHandler);
        previewModal.addEventListener('pointercancel', closeHandler);
    }

    window.currentPreviewPostId = postId;
    const img = document.getElementById('haptic-preview-img');
    img.src = mediaUrl;

    previewModal.classList.remove('hidden');
    void previewModal.offsetWidth; 
    
    previewModal.classList.remove('opacity-0');
    img.classList.remove('scale-95');
    img.classList.add('scale-100');
};

window.closeImagePreview = function() {
    const previewModal = document.getElementById('haptic-preview-modal');
    if (previewModal && !previewModal.classList.contains('hidden')) {
        previewModal.classList.add('opacity-0');
        const img = document.getElementById('haptic-preview-img');
        img.classList.remove('scale-100');
        img.classList.add('scale-95');
        
        setTimeout(() => {
            previewModal.classList.add('hidden');
            img.src = '';
        }, 300); 
    }
};
