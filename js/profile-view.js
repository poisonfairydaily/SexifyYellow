// ==========================================
// js/profile-view.js
// 負責：查看他人主頁、載入他內容、處理關注訂閱按鈕
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUserId = urlParams.get('userId');

    if (!targetUserId) {
        alert("無效的用戶 ID");
        window.location.href = 'index.html';
        return;
    }

    // 防止自己看自己，如果是自己就跳回首頁的「我」
    if(targetUserId === localStorage.getItem('userId')) {
        window.location.href = 'index.html';
        return;
    }

    await fetchCreatorProfile(targetUserId);
    await fetchCreatorPosts(targetUserId);
});

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

    const avatarUrl = data.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random';
    const displayName = data.display_name || '未命名用戶';

    document.getElementById('header-name').innerText = displayName;
    document.getElementById('creator-display-name').innerText = displayName;
    document.getElementById('creator-username').innerText = `@${data.username || uid.substring(0,6)}`;
    document.getElementById('creator-avatar').src = avatarUrl;
    document.getElementById('creator-bio').innerText = data.bio || '這位創作者很神秘，還沒寫下自我介紹。';

    // 處理關注按鈕邏輯
    const followBtn = document.getElementById('follow-btn');
    const mySubscriptions = JSON.parse(localStorage.getItem('mySubscriptions')) || [];
    const isSubscribed = mySubscriptions.find(s => s.id === uid);

    if (isSubscribed) {
        followBtn.innerText = '已關注';
        followBtn.classList.replace('bg-sexify', 'bg-gray-200');
        followBtn.classList.replace('text-white', 'text-gray-700');
    } else {
        followBtn.onclick = () => {
            // 加入本地訂閱陣列 (由 profile.js 提供的 addSubscription 如果不在同一個 scope，我們直接實作)
            mySubscriptions.push({ id: uid, name: displayName, avatar: avatarUrl });
            localStorage.setItem('mySubscriptions', JSON.stringify(mySubscriptions));
            
            alert(`🎉 成功關注 ${displayName}！`);
            
            // 更新按鈕狀態
            followBtn.innerText = '已關注';
            followBtn.classList.replace('bg-sexify', 'bg-gray-200');
            followBtn.classList.replace('text-white', 'text-gray-700');
            followBtn.onclick = null;
        };
    }
}

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
        grid.innerHTML = `<div class="w-full text-center py-20 text-gray-400 col-span-2">這名創作者尚無發佈任何內容</div>`;
        return;
    }

    grid.innerHTML = data.map(post => `
        <div class="masonry-item relative shadow-sm border border-gray-100">
            ${post.is_paid ? '<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-md z-10"><i class="fa-solid fa-lock mr-1"></i>付費</div>' : ''}
            <img src="${post.media_url}" class="w-full h-auto object-cover rounded-t-xl ${post.is_paid ? 'blur-md' : ''}" loading="lazy">
            <div class="p-2 bg-white rounded-b-xl">
                <p class="text-xs text-gray-700 line-clamp-2">${post.caption || ''}</p>
            </div>
        </div>
    `).join('');
}
