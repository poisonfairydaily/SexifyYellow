// ==========================================
// js/profile.js - 完整功能 & 自動修復版
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile 初始化...");
    await loadProfileData();
});

// 1. 獲取用戶 ID
async function getAuthenticatedUserId() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user ? user.id : null;
}

// 2. 主加載函數
async function loadProfileData() {
    const myId = await getAuthenticatedUserId();
    if (!myId) return;

    try {
        let { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        // 🚨 自動補救：如果資料庫還是沒這筆資料
        if (error && (error.code === 'PGRST116' || error.message.includes('JSON'))) {
            console.log("正在嘗試修復缺失的 Profile...");
            const { data: insData, error: insErr } = await window.supabaseClient
                .from('profiles')
                .insert([{ id: myId, display_name: '新用戶', username: 'user_' + myId.substring(0, 5) }])
                .select().single();
            if (insErr) throw insErr;
            data = insData;
        } else if (error) throw error;

        renderProfileUI(data);
        fetchMyPosts(myId); // 載入作品集

    } catch (e) {
        console.error("致命錯誤:", e);
        // 如果報錯，至少讓 UI 顯示出來，不要一片空白
        document.getElementById('creator-display-name').innerText = "載入中...";
    }
}

// 3. UI 渲染
function renderProfileUI(data) {
    if (!data) return;

    // 基礎文字
    document.getElementById('creator-display-name').innerText = data.display_name || '未命名';
    document.getElementById('creator-username').innerText = `@${data.username || 'user'}`;
    document.getElementById('creator-bio').innerText = data.bio || '尚未編輯簡介';
    
    // 圖片
    const avatarImg = document.getElementById('creator-avatar');
    if (data.avatar_url) avatarImg.src = data.avatar_url;
    else avatarImg.src = `https://ui-avatars.com/api/?name=${data.display_name || 'U'}`;

    if (data.banner_url) {
        document.getElementById('creator-banner').src = data.banner_url;
    }

    // 編輯彈窗資料同步
    const editName = document.getElementById('edit-display-name');
    if (editName) editName.value = data.display_name || '';
    
    const editBio = document.getElementById('edit-bio');
    if (editBio) editBio.value = data.bio || '';
}

// 4. 抓取我的貼文 (Masonry 佈局)
async function fetchMyPosts(uid) {
    const grid = document.getElementById('creator-posts-grid');
    if (!grid) return;

    const { data, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚無發佈作品</div>`;
        return;
    }

    grid.innerHTML = data.map(post => `
        <div class="masonry-item relative group shadow-sm rounded-xl overflow-hidden mb-2 bg-white">
            ${post.media_url.includes('video') || post.media_url.endsWith('.mp4') 
                ? `<video src="${post.media_url}" class="w-full h-auto"></video>` 
                : `<img src="${post.media_url}" class="w-full h-auto">`}
            ${post.is_paid ? `<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg">付費</div>` : ''}
        </div>
    `).join('');
}

// 5. 儲存功能 (含 Storage 管理)
window.saveProfile = async function() {
    const btn = document.querySelector('[onclick="saveProfile()"]');
    btn.disabled = true;
    btn.innerText = "儲存中...";

    try {
        const myId = await getAuthenticatedUserId();
        const { error } = await window.supabaseClient
            .from('profiles')
            .update({
                display_name: document.getElementById('edit-display-name').value,
                username: document.getElementById('edit-username').value,
                bio: document.getElementById('edit-bio').value,
                updated_at: new Date()
            })
            .eq('id', myId);

        if (error) throw error;
        alert("更新成功");
        location.reload();
    } catch (e) {
        alert("儲存失敗: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "儲存設定";
    }
}

// 6. 原有的彈窗與 UI 控制
window.openEditModal = () => document.getElementById('edit-profile-modal').classList.remove('hidden');
window.closeEditModal = () => document.getElementById('edit-profile-modal').classList.add('hidden');

window.loadFansAndSubs = (type) => {
    document.getElementById('fans-subs-title').innerText = type === 'fans' ? '我的粉絲' : '我的訂閱';
    document.getElementById('fans-subs-modal').classList.remove('hidden');
    document.getElementById('fans-subs-list').innerHTML = `<div class="py-10 text-center text-gray-400">尚無資料</div>`;
};
window.closeFansSubsModal = () => document.getElementById('fans-subs-modal').classList.add('hidden');
