// ==========================================
// js/profile-view.js
// 負責處理「查看他人主頁」的邏輯
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 解析網址參數 (例如 ?userId=xxxxxx)
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');

    if (!targetUserId) {
        alert("無效的用戶 ID");
        window.location.href = 'index.html';
        return;
    }

    // 2. 初始化資料
    await fetchCreatorProfile(targetUserId);
    await fetchCreatorPosts(targetUserId);
});

/**
 * 抓取創作者基本資料
 */
async function fetchCreatorProfile(uid) {
    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

    if (error || !data) {
        console.error("抓取 Profiles 失敗:", error);
        return;
    }

    // 渲染 UI
    document.getElementById('header-name').innerText = data.display_name || '創作者';
    document.getElementById('creator-display-name').innerText = data.display_name || '未命名用戶';
    document.getElementById('creator-username').innerText = `@${data.username || 'unknown'}`;
    document.getElementById('creator-avatar').src = data.avatar_url || 'https://ui-avatars.com/api/?background=random';
    document.getElementById('creator-bio').innerText = data.bio || '這位創作者很神秘，還沒寫下自我介紹。';
}

/**
 * 抓取該位創作者的所有貼文
 */
async function fetchCreatorPosts(uid) {
    const grid = document.getElementById('creator-posts-grid');
    
    const { data, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("抓取貼文失敗:", error);
        return;
    }

    if (!data || data.length === 0) {
        grid.innerHTML = `<div class="w-full text-center py-20 text-gray-300 col-span-2">尚無發佈任何內容</div>`;
        return;
    }

    // 清空並渲染貼文
    grid.innerHTML = data.map(post => `
        <div class="masonry-item relative group" onclick="viewPostDetail('${post.id}')">
            ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-md z-10"><i class="fa-solid fa-lock mr-1"></i>付費內容</div>' : ''}
            <img src="${post.media_url}" class="w-full h-auto ${post.is_paid ? 'blur-md' : ''}" loading="lazy">
            <div class="p-2">
                <p class="text-xs text-gray-700 line-clamp-2">${post.caption || ''}</p>
            </div>
        </div>
    `).join('');
}