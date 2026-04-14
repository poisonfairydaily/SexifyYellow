// ==========================================
// js/profile.js - 完整功能強化版
// ==========================================

// 1. 內部工具：獲取當前登入者 ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// 2. 圖片預覽與 Canvas 壓縮 (防止手機上傳太大的圖導致報錯)
window.previewImage = function(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 800; // 最大尺寸

                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                document.getElementById(imgId).src = canvas.toDataURL('image/jpeg', 0.8);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 3. 核心功能：加載個人檔案資料
async function loadProfileData() {
    const myId = await getAuthenticatedUserId();
    if (!myId) return;

    try {
        let { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        // 如果資料不存在 (PGRST116)，主動建立一筆，防止頁面空白
        if (error && error.code === 'PGRST116') {
            const { data: newData, error: insertError } = await window.supabaseClient
                .from('profiles')
                .insert([{ 
                    id: myId, 
                    display_name: '新用戶', 
                    username: 'user_' + myId.substring(0, 5) 
                }])
                .select()
                .single();
            
            if (insertError) throw insertError;
            data = newData;
        } else if (error) {
            throw error;
        }

        renderProfileUI(data);
    } catch (e) {
        console.error("載入失敗:", e);
    }
}

// 4. UI 渲染邏輯
function renderProfileUI(data) {
    if (!data) return;

    // 填寫基礎資訊
    document.getElementById('creator-display-name').innerText = data.display_name || '未命名';
    document.getElementById('creator-username').innerText = `@${data.username || 'user'}`;
    document.getElementById('creator-bio').innerText = data.bio || '這傢伙很懶，什麼都沒寫...';
    
    // 設定頭像與橫幅 (若無則使用預設圖)
    if (data.avatar_url) document.getElementById('creator-avatar').src = data.avatar_url;
    if (data.banner_url) document.getElementById('creator-banner').src = data.banner_url;

    // 同步到編輯彈窗
    document.getElementById('edit-display-name').value = data.display_name || '';
    document.getElementById('edit-username').value = data.username || '';
    document.getElementById('edit-bio').value = data.bio || '';
    document.getElementById('edit-avatar-preview').src = data.avatar_url || 'https://ui-avatars.com/api/?name=U';
    document.getElementById('edit-banner-preview').src = data.banner_url || '';
}

// 5. 儲存個人檔案 (包含 Storage 刪除與上傳邏輯)
window.saveProfile = async function() {
    const btn = document.querySelector('[onclick="saveProfile()"]');
    btn.disabled = true;
    btn.innerText = "儲存中...";

    try {
        const myId = await getAuthenticatedUserId();
        const newDisplayName = document.getElementById('edit-display-name').value;
        const newUsername = document.getElementById('edit-username').value;
        const newBio = document.getElementById('edit-bio').value;

        let avatarUrl = document.getElementById('edit-avatar-preview').src;
        let bannerUrl = document.getElementById('edit-banner-preview').src;

        // 處理頭像上傳 (若是 Base64 則代表有新選圖片)
        if (avatarUrl.startsWith('data:image')) {
            avatarUrl = await uploadToStorage(myId, 'avatars', 'edit-avatar-input');
        }

        // 處理橫幅上傳
        if (bannerUrl.startsWith('data:image')) {
            bannerUrl = await uploadToStorage(myId, 'banners', 'edit-banner-input');
        }

        const { error } = await window.supabaseClient
            .from('profiles')
            .update({
                display_name: newDisplayName,
                username: newUsername,
                bio: newBio,
                avatar_url: avatarUrl,
                banner_url: bannerUrl,
                updated_at: new Date()
            })
            .eq('id', myId);

        if (error) throw error;

        alert("更新成功！");
        location.reload();
    } catch (e) {
        alert("儲存失敗: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "儲存設定";
    }
}

// 6. 輔助：上傳至 Storage (符合你設定的 RLS 路徑規範)
async function uploadToStorage(userId, bucket, inputId) {
    const file = document.getElementById(inputId).files[0];
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    // A. 刪除該用戶舊的資料夾內容 (符合 DELETE RLS 政策)
    // 這裡我們先列出資料夾內檔案再刪除，確保空間整潔
    const { data: oldFiles } = await window.supabaseClient.storage.from(bucket).list(userId);
    if (oldFiles && oldFiles.length > 0) {
        const filesToRemove = oldFiles.map(f => `${userId}/${f.name}`);
        await window.supabaseClient.storage.from(bucket).remove(filesToRemove);
    }

    // B. 上傳新檔案
    const { error: uploadError } = await window.supabaseClient.storage
        .from(bucket)
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = window.supabaseClient.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return publicUrl;
}

// 7. 粉絲與訂閱列表彈窗
window.loadFansAndSubs = async function(type) {
    const list = document.getElementById('fans-subs-list');
    const title = document.getElementById('fans-subs-title');
    title.innerText = type === 'fans' ? '我的粉絲' : '我的訂閱';
    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-2xl text-gray-300"></i></div>`;
    
    document.getElementById('fans-subs-modal').classList.remove('hidden');

    const myId = await getAuthenticatedUserId();
    // 這裡根據你的 profiles 表進行簡單查詢 (假設你有一個 subscriptions 表)
    // 如果目前還沒做這張表，先顯示暫無資料
    list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前尚無${type === 'fans' ? '粉絲' : '訂閱'}資料</div>`;
}

window.closeFansSubsModal = function() {
    document.getElementById('fans-subs-modal').classList.add('hidden');
}

// 初始化
document.addEventListener('DOMContentLoaded', loadProfileData);
