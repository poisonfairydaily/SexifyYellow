/**
 * js/profile.js - Sexify 完整功能修復版
 * 功能：個人資料管理、圖片上傳清理、作品集抓取、粉絲彈窗
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile 系統啟動中...");
    await loadProfileData();
});

// 1. 安全獲取 User ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// 2. 載入資料 (包含自動建立機制)
async function loadProfileData() {
    const myId = await getAuthenticatedUserId();
    if (!myId) {
        document.getElementById('creator-header').innerHTML = `<div class="p-10 text-center"><a href="index.html" class="text-sexify font-bold">請先登入帳號</a></div>`;
        return;
    }

    try {
        let { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        // 🚨 自動補救：如果資料庫裡真的沒這筆 (PGRST116)，手動建立
        if (error && error.code === 'PGRST116') {
            const { data: insData, error: insErr } = await window.supabaseClient
                .from('profiles')
                .insert([{ id: myId, display_name: '新用戶', username: 'user_' + myId.substring(0,5) }])
                .select().single();
            if (insErr) throw insErr;
            data = insData;
        } else if (error) throw error;

        renderProfileUI(data);
        fetchMyPosts(myId); // 載入我的作品

    } catch (e) {
        console.error("載入失敗:", e);
        alert("讀取設定失敗，請檢查資料庫連結");
    }
}

// 3. UI 渲染 (對應 profile.html 所有 ID)
function renderProfileUI(data) {
    if (!data) return;

    // 顯示文字資訊
    document.getElementById('creator-display-name').innerText = data.display_name || '未命名';
    document.getElementById('creator-username').innerText = `@${data.username || 'user'}`;
    document.getElementById('creator-bio').innerText = data.bio || '尚未編輯簡介...';
    
    // 顯示頭像與橫幅
    const avatar = document.getElementById('creator-avatar');
    const banner = document.getElementById('creator-banner');
    
    if (data.avatar_url) avatar.src = data.avatar_url;
    if (data.banner_url) banner.src = data.banner_url;

    // 預填編輯彈窗
    document.getElementById('edit-display-name').value = data.display_name || '';
    document.getElementById('edit-username').value = data.username || '';
    document.getElementById('edit-bio').value = data.bio || '';
    document.getElementById('edit-avatar-preview').src = avatar.src;
    document.getElementById('edit-banner-preview').src = data.banner_url || '';
}

// 4. 抓取我的貼文作品集
async function fetchMyPosts(uid) {
    const grid = document.getElementById('creator-posts-grid');
    if (!grid) return;

    const { data, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">目前尚無作品</div>`;
        return;
    }

    grid.innerHTML = data.map(post => `
        <div class="masonry-item relative group shadow-sm">
            ${post.media_url.includes('video') || post.media_url.endsWith('.mp4') 
                ? `<video src="${post.media_url}" class="w-full object-cover rounded-xl"></video>` 
                : `<img src="${post.media_url}" class="w-full object-cover rounded-xl">`}
            ${post.is_paid ? `<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg"><i class="fa-solid fa-lock mr-1"></i>付費</div>` : ''}
        </div>
    `).join('');
}

// 5. 圖片預覽與 Canvas 壓縮
window.previewImage = function(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > 800) { h *= 800/w; w = 800; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                document.getElementById(imgId).src = canvas.toDataURL('image/jpeg', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 6. 儲存設定 (含 Storage 清理)
window.saveProfile = async function() {
    const btn = document.querySelector('[onclick="saveProfile()"]');
    btn.disabled = true; btn.innerText = "儲存中...";

    try {
        const myId = await getAuthenticatedUserId();
        let avatarUrl = document.getElementById('edit-avatar-preview').src;
        let bannerUrl = document.getElementById('edit-banner-preview').src;

        // 若有新圖片才上傳
        if (avatarUrl.startsWith('data:image')) avatarUrl = await uploadToStorage(myId, 'avatars', 'edit-avatar-input');
        if (bannerUrl.startsWith('data:image')) bannerUrl = await uploadToStorage(myId, 'banners', 'edit-banner-input');

        const { error } = await window.supabaseClient.from('profiles').update({
            display_name: document.getElementById('edit-display-name').value,
            username: document.getElementById('edit-username').value,
            bio: document.getElementById('edit-bio').value,
            avatar_url: avatarUrl,
            banner_url: bannerUrl,
            updated_at: new Date()
        }).eq('id', myId);

        if (error) throw error;
        alert("更新成功！");
        location.reload();
    } catch (e) {
        alert("儲存失敗: " + e.message);
    } finally {
        btn.disabled = false; btn.innerText = "儲 ct 儲存設定";
    }
}

// 7. 內部工具：上傳並清理舊檔案
async function uploadToStorage(userId, bucket, inputId) {
    const file = document.getElementById(inputId).files[0];
    if (!file) return null;

    const path = `${userId}/${Date.now()}.${file.name.split('.').pop()}`;
    
    // 清理舊圖
    const { data: list } = await window.supabaseClient.storage.from(bucket).list(userId);
    if (list && list.length > 0) {
        await window.supabaseClient.storage.from(bucket).remove(list.map(f => `${userId}/${f.name}`));
    }

    const { error } = await window.supabaseClient.storage.from(bucket).upload(path, file);
    if (error) throw error;

    return window.supabaseClient.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// 8. 彈窗控制
window.openEditModal = () => document.getElementById('edit-profile-modal').classList.remove('hidden');
window.closeEditModal = () => document.getElementById('edit-profile-modal').classList.add('hidden');

window.loadFansAndSubs = (type) => {
    document.getElementById('fans-subs-title').innerText = type === 'fans' ? '我的粉絲' : '我的訂閱';
    document.getElementById('fans-subs-modal').classList.remove('hidden');
    document.getElementById('fans-subs-list').innerHTML = `<div class="py-10 text-center text-gray-400">尚無資料</div>`;
}
window.closeFansSubsModal = () => document.getElementById('fans-subs-modal').classList.add('hidden');
