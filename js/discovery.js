// ==========================================
// js/discovery.js - 修復按讚同步、佈局、分享與分頁
// ==========================================

let discoveryMode = 'all'; // 'all' 或 'following'
window.currentViewedPostId = null;
window.currentViewedPostOwnerId = null;

// 1. 切換模式：推薦 vs 追蹤中
window.switchDiscoveryMode = function(mode) {
    discoveryMode = mode;
    
    // 更新 UI 狀態
    const tabRec = document.getElementById('tab-recommend');
    const tabFol = document.getElementById('tab-following');
    
    if (mode === 'all') {
        tabRec.classList.add('border-sexify', 'text-sexify');
        tabRec.classList.remove('border-transparent', 'text-gray-400');
        tabFol.classList.remove('border-sexify', 'text-sexify');
        tabFol.classList.add('border-transparent', 'text-gray-400');
    } else {
        tabFol.classList.add('border-sexify', 'text-sexify');
        tabFol.classList.remove('border-transparent', 'text-gray-400');
        tabRec.classList.remove('border-sexify', 'text-sexify');
        tabRec.classList.add('border-transparent', 'text-gray-400');
    }
    
    window.renderDiscovery();
};

// 2. 渲染首頁貼文
window.renderDiscovery = async function(filterKeyword = '') {
    const grid = document.getElementById('discovery-grid');
    if (!grid) return;
    
    grid.innerHTML = `<div class="col-span-2 text-center py-20 mt-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-3xl"></i></div>`;

    try {
        const myUserId = localStorage.getItem('userId');
        let query = window.supabaseClient
            .from('posts')
            .select('*, profiles(id, display_name, avatar_url, username)')
            .order('created_at', { ascending: false });

        // 處理 "追蹤中" 邏輯
        if (discoveryMode === 'following') {
            if (!myUserId) {
                grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">請先登入以查看追蹤動態</div>`;
                return;
            }
            const { data: subs } = await window.supabaseClient.from('subscriptions').select('creator_id').eq('follower_id', myUserId);
            const creatorIds = subs.map(s => s.creator_id);
            if (creatorIds.length === 0) {
                grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚未追蹤任何創作者</div>`;
                return;
            }
            query = query.in('user_id', creatorIds);
        }

        if (filterKeyword.trim() !== '') {
            query = query.ilike('caption', `%${filterKeyword}%`);
        }

        const { data: posts, error } = await query;
        if (error) throw error;

        // 獲取按讚狀態
        let myLikes = new Set();
        if (myUserId) {
            const { data: likeData } = await window.supabaseClient.from('post_likes').select('post_id').eq('user_id', myUserId);
            if (likeData) likeData.forEach(l => myLikes.add(l.post_id));
        }

        grid.innerHTML = posts.map(post => {
            const isLiked = myLikes.has(post.id);
            const isMine = post.user_id === myUserId;
            
            // 重要：將用戶名移至圖片下方
            return `
                <div class="masonry-item mb-4 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100" id="post-card-${post.id}">
                    <div class="relative group cursor-pointer" onclick="showPostDetail('${post.id}')">
                        ${post.media_url ? `
                            <img src="${post.media_url}" class="w-full object-cover max-h-[400px]" loading="lazy">
                        ` : '<div class="h-32 bg-gray-50"></div>'}
                        ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md">PAID</div>' : ''}
                    </div>
                    
                    <div class="p-3">
                        <div class="flex items-center gap-2 mb-2" onclick="viewOtherProfile('${post.profiles.id}')">
                            <img src="${post.profiles.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-6 h-6 rounded-full object-cover">
                            <span class="text-xs font-black truncate">${post.profiles.display_name}</span>
                        </div>
                        
                        <p class="text-[11px] text-gray-600 line-clamp-2 mb-3 px-1">${post.caption || ''}</p>
                        
                        <div class="flex items-center justify-between border-t pt-2 mt-1">
                            <div class="flex items-center gap-3">
                                <button onclick="toggleLike('${post.id}', event)" id="like-btn-${post.id}" class="transition active:scale-150 ${isLiked ? 'text-sexify' : 'text-gray-300'}">
                                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                                    <span class="text-[10px] font-bold ml-0.5" id="like-count-${post.id}">${post.likes_count || 0}</span>
                                </button>
                                <button onclick="showPostDetail('${post.id}')" class="text-gray-300">
                                    <i class="fa-regular fa-comment"></i>
                                    <span class="text-[10px] font-bold ml-0.5">${post.comments_count || 0}</span>
                                </button>
                            </div>
                            <button onclick="openShareModal('${post.id}', event)" class="text-gray-300 active:text-sexify transition">
                                <i class="fa-solid fa-share-nodes"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

    } catch (e) { console.error(e); }
};

// 3. 處理按讚 (修復同步問題)
window.toggleLike = async function(postId, event) {
    if (event) event.stopPropagation();
    const myUserId = localStorage.getItem('userId');
    if (!myUserId) return alert("請先登入");

    const btn = document.getElementById(`like-btn-${postId}`);
    const detailBtn = document.getElementById('detail-like-btn');
    const countEl = document.getElementById(`like-count-${postId}`);
    const detailCountEl = document.getElementById('detail-likes-count');
    
    const isCurrentlyLiked = btn && btn.classList.contains('text-sexify');
    let currentCount = parseInt(countEl ? countEl.innerText : (detailCountEl ? detailCountEl.innerText : 0));

    // UI 立即回饋
    const updateUI = (liked, count) => {
        [btn, detailBtn].forEach(el => {
            if (el) {
                el.className = `flex items-center gap-1.5 transition active:scale-125 ${liked ? 'text-sexify' : 'text-gray-300'}`;
                const icon = el.querySelector('i');
                if (icon) icon.className = liked ? 'fa-solid fa-heart text-xl' : 'fa-regular fa-heart text-xl';
            }
        });
        [countEl, detailCountEl].forEach(el => { if (el) el.innerText = count; });
    };

    try {
        if (isCurrentlyLiked) {
            updateUI(false, currentCount - 1);
            await window.supabaseClient.from('post_likes').delete().eq('post_id', postId).eq('user_id', myUserId);
            await window.supabaseClient.rpc('decrement_likes', { post_id_val: postId });
        } else {
            updateUI(true, currentCount + 1);
            await window.supabaseClient.from('post_likes').insert({ post_id: postId, user_id: myUserId });
            await window.supabaseClient.rpc('increment_likes', { post_id_val: postId });
        }
    } catch (err) {
        console.error("Like Error", err);
    }
};

// 4. 顯示貼文詳情
window.showPostDetail = async function(postId) {
    window.currentViewedPostId = postId;
    const modal = document.getElementById('post-detail-modal');
    modal.classList.remove('hidden');

    try {
        const { data: post, error } = await window.supabaseClient
            .from('posts')
            .select('*, profiles(*)')
            .eq('id', postId)
            .single();

        if (error) throw error;
        window.currentViewedPostOwnerId = post.user_id;

        // 填充資料
        document.getElementById('detail-avatar').src = post.profiles.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('detail-display-name').innerText = post.profiles.display_name;
        document.getElementById('detail-username').innerText = `@${post.profiles.username}`;
        document.getElementById('detail-caption').innerText = post.caption || '';
        document.getElementById('detail-likes-count').innerText = post.likes_count || 0;
        document.getElementById('detail-comments-count').innerText = post.comments_count || 0;

        const mediaContainer = document.getElementById('detail-media-container');
        mediaContainer.innerHTML = post.media_url ? `<img src="${post.media_url}" class="max-w-full max-h-full object-contain">` : '';

        // 更新詳情彈窗按讚狀態
        const myUserId = localStorage.getItem('userId');
        const { data: likeCheck } = await window.supabaseClient.from('post_likes').select('id').eq('post_id', postId).eq('user_id', myUserId).single();
        const isLiked = !!likeCheck;
        
        const dLikeBtn = document.getElementById('detail-like-btn');
        dLikeBtn.onclick = (e) => window.toggleLike(postId, e);
        dLikeBtn.className = `flex items-center gap-1.5 transition active:scale-125 ${isLiked ? 'text-sexify' : 'text-gray-400'}`;
        dLikeBtn.querySelector('i').className = isLiked ? 'fa-solid fa-heart text-xl' : 'fa-regular fa-heart text-xl';

        const dShareBtn = document.getElementById('detail-share-btn');
        dShareBtn.onclick = (e) => openShareModal(postId, e);

        renderComments();
    } catch (e) { console.error(e); }
};

// 5. 分享功能
window.openShareModal = function(postId, event) {
    if (event) event.stopPropagation();
    window.currentSharePostId = postId;
    const modal = document.getElementById('share-modal');
    const panel = document.getElementById('share-panel');
    modal.classList.remove('hidden');
    setTimeout(() => panel.classList.remove('translate-y-full'), 10);
};

window.closeShareModal = function() {
    const panel = document.getElementById('share-panel');
    panel.classList.add('translate-y-full');
    setTimeout(() => document.getElementById('share-modal').classList.add('hidden'), 300);
};

window.copyPostLink = function() {
    const url = `${window.location.origin}/profile-view.html?userId=${window.currentViewedPostOwnerId || ''}`;
    // 註：若有單獨貼文頁面可改為貼文 URL，目前引導至用戶個人專頁
    navigator.clipboard.writeText(url).then(() => {
        alert("連結已複製！");
        closeShareModal();
    });
};

window.shareToChatList = function() {
    alert("請選擇訊息中的對話進行發送（功能開發中，目前可手動複製連結）");
    closeShareModal();
};

// 6. 刪除貼文 (修復功能)
window.deletePostFromModal = async function(postId) {
    const myUserId = localStorage.getItem('userId');
    if (window.currentViewedPostOwnerId !== myUserId) {
        return alert("您沒有權限刪除此貼文");
    }

    if (!confirm("確定要永久刪除這則貼文嗎？此操作無法復原。")) return;

    try {
        const { error } = await window.supabaseClient
            .from('posts')
            .delete()
            .eq('id', postId)
            .eq('user_id', myUserId); // 雙重檢查

        if (error) throw error;

        alert("貼文已刪除");
        closePostDetail();
        window.renderDiscovery(); // 刷新首頁
        if (typeof renderProfile === 'function') renderProfile(); // 若在個人頁則刷新個人頁
    } catch (err) {
        console.error(err);
        alert("刪除失敗，請稍後再試。");
    }
};

window.closePostDetail = function() {
    document.getElementById('post-detail-modal').classList.add('hidden');
};

// 留言相關略 (保持原樣但確保調用正確)
async function renderComments() {
    const container = document.getElementById('comments-container');
    const { data: comments } = await window.supabaseClient
        .from('post_comments')
        .select('*, profiles(display_name, avatar_url)')
        .eq('post_id', window.currentViewedPostId)
        .order('created_at', { ascending: true });

    container.innerHTML = comments.map(c => `
        <div class="flex gap-3">
            <img src="${c.profiles.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-8 h-8 rounded-full object-cover border">
            <div class="flex-1 bg-gray-50 rounded-2xl p-3">
                <div class="font-bold text-[11px] mb-1">${c.profiles.display_name}</div>
                <div class="text-xs text-gray-600">${c.comment_text}</div>
            </div>
        </div>
    `).join('');
}

window.submitComment = async function() {
    const input = document.getElementById('comment-input');
    const text = input.value.trim();
    if (!text) return;
    const myUserId = localStorage.getItem('userId');

    try {
        await window.supabaseClient.from('post_comments').insert({
            post_id: window.currentViewedPostId,
            user_id: myUserId,
            comment_text: text
        });
        await window.supabaseClient.rpc('increment_comments', { post_id_val: window.currentViewedPostId });
        input.value = '';
        renderComments();
    } catch(e) { alert("發佈失敗"); }
};

document.addEventListener('DOMContentLoaded', () => {
    window.renderDiscovery();
});
