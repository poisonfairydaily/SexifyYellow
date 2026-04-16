// ==========================================
// js/profile-view.js - 關注與取消關注完備版
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');
    const myId = localStorage.getItem('userId');

    if (!targetUserId) {
        alert("無效的用戶 ID");
        window.location.href = 'index.html';
        return;
    }

    if(targetUserId === myId) {
        window.location.href = 'index.html';
        return;
    }

    await fetchCreatorProfile(targetUserId);
    await fetchCreatorPosts(targetUserId);
    await checkFollowStatus(targetUserId);
});

async function fetchCreatorProfile(uid) {
    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

    if (error || !data) return;

    const displayName = data.display_name || data.username || '未命名用戶';
    const avatarUrl = data.avatar_url || `https://ui-avatars.com/api/?name=${displayName}`;

    document.getElementById('header-name').innerText = displayName;
    document.getElementById('creator-display-name').innerText = displayName;
    document.getElementById('creator-username').innerText = '@' + data.username;
    document.getElementById('creator-avatar').src = avatarUrl;
    document.getElementById('creator-bio').innerText = data.bio || "這名創作者很懶，什麼都沒寫...";
}

// ------------------------------------------
// 核心：檢查關注狀態
// ------------------------------------------
async function checkFollowStatus(targetUid) {
    const followBtn = document.getElementById('follow-btn');
    const myId = localStorage.getItem('userId');
    if (!myId || !followBtn) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('follows')
            .select('*')
            .eq('follower_id', myId)
            .eq('following_id', targetUid)
            .maybeSingle();

        if (data) {
            updateFollowButtonUI(true);
        } else {
            updateFollowButtonUI(false);
        }
        
        followBtn.onclick = () => toggleFollowAction(targetUid);
    } catch (e) {
        console.error("檢查關注失敗", e);
    }
}

function updateFollowButtonUI(isFollowing) {
    const followBtn = document.getElementById('follow-btn');
    if (isFollowing) {
        followBtn.innerText = '已關注';
        followBtn.classList.remove('bg-sexify', 'text-white');
        followBtn.classList.add('bg-gray-200', 'text-gray-700');
    } else {
        followBtn.innerText = '關注';
        followBtn.classList.add('bg-sexify', 'text-white');
        followBtn.classList.remove('bg-gray-200', 'text-gray-700');
    }
}

// ------------------------------------------
// 核心：執行 關注/取消 動作
// ------------------------------------------
async function toggleFollowAction(targetUid) {
    const myId = localStorage.getItem('userId');
    if (!myId) return alert('請先登入！');

    const followBtn = document.getElementById('follow-btn');
    const isCurrentlyFollowing = followBtn.innerText === '已關注';

    followBtn.disabled = true;

    try {
        if (isCurrentlyFollowing) {
            // 取消關注
            const { error } = await window.supabaseClient
                .from('follows')
                .delete()
                .eq('follower_id', myId)
                .eq('following_id', targetUid);
            if (error) throw error;
            updateFollowButtonUI(false);
        } else {
            // 新增關注
            const { error } = await window.supabaseClient
                .from('follows')
                .insert([{ follower_id: myId, following_id: targetUid }]);
            if (error) throw error;
            updateFollowButtonUI(true);
        }
    } catch (err) {
        console.error("操作失敗:", err);
        alert("操作失敗，請稍後再試");
    } finally {
        followBtn.disabled = false;
    }
}

async function fetchCreatorPosts(uid) {
    const grid = document.getElementById('creator-posts-grid');
    if (!grid) return;
    
    const { data, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

    if (error) return;

    if (!data || data.length === 0) {
        grid.innerHTML = `<div class="w-full text-center py-20 text-gray-400 col-span-2">這名創作者尚無發佈任何內容</div>`;
        return;
    }

    grid.innerHTML = data.map(post => `
        <div class="masonry-item relative shadow-sm border border-gray-100" onclick="viewPostDetail('${post.id}')">
            ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-md z-10">付費</div>' : ''}
            ${post.media_url ? `<img src="${post.media_url}" class="w-full h-auto object-cover">` : '<div class="p-4 bg-gray-50 text-xs text-gray-400">純文字內容</div>'}
            <div class="p-2">
                <p class="text-[10px] text-gray-600 line-clamp-2">${window.escapeHTML(post.caption)}</p>
            </div>
        </div>
    `).join('');
}

function viewPostDetail(postId) {
    window.location.href = `index.html?postId=${postId}`;
}
