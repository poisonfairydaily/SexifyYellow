// ==========================================
// js/profile.js - 存儲優化與分表相容版
// 1. 安全性：所有私密欄位 (Birthday, Email) 改從 user_private_data 讀寫
// 2. 效能：合併讀取 profiles 與 user_private_data
// 3. 存儲優化：更新頭像/封面前自動刪除舊檔案，防止空間浪費
// 4. 原生體驗：保留 Masonry 佈局與所有彈窗動畫
// ==========================================

// 內部工具：獲取當前真實經過驗證的 User ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

/**
 * 核心工具：從 URL 中提取 Supabase Storage 的路徑
 * 用於刪除舊檔案
 */
function extractStoragePath(url, bucketName) {
    if (!url || !url.includes(bucketName)) return null;
    try {
        // 假設 URL 格式為: https://.../storage/v1/object/public/bucketName/path/to/file.jpg
        const parts = url.split(`${bucketName}/`);
        if (parts.length > 1) {
            return parts[1];
        }
    } catch (e) {
        console.error("解析路徑失敗:", e);
    }
    return null;
}

/**
 * 核心工具：執行檔案刪除
 */
async function deleteOldFileFromStorage(bucketName, url) {
    const filePath = extractStoragePath(url, bucketName);
    if (!filePath) return; // 如果不是該 bucket 的檔案或是預設圖片，則跳過

    console.log(`正在清理舊檔案: ${bucketName}/${filePath}`);
    const { error } = await window.supabaseClient.storage
        .from(bucketName)
        .remove([filePath]);

    if (error) {
        console.warn("舊檔案刪除失敗或已被手動刪除:", error.message);
    } else {
        console.log("舊檔案清理成功");
    }
}

/**
 * 圖片壓縮與預覽邏輯 (Canvas 驅動)
 */
window.previewImage = function(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 800;

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
                
                // 將壓縮後的 DataURL 賦值給預覽圖
                document.getElementById(imgId).src = canvas.toDataURL('image/jpeg', 0.8);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * 載入個人資料邏輯
 */
window.loadMyProfile = async function() {
    const myId = await getAuthenticatedUserId();
    if (!myId) return;

    try {
        // 1. 同時從兩個表讀取資料
        const { data: profile, error: pError } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        const { data: privateData, error: pvError } = await window.supabaseClient
            .from('user_private_data')
            .select('*')
            .eq('id', myId)
            .single();

        if (pError) throw pError;

        // 2. 渲染 UI
        const avatarImg = document.getElementById('my-avatar');
        const bannerImg = document.getElementById('my-banner');
        
        if (avatarImg) avatarImg.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name || 'U'}`;
        if (bannerImg && profile.banner_url) bannerImg.src = profile.banner_url;

        document.getElementById('display-name-text').innerText = profile.display_name || "未設定名稱";
        document.getElementById('username-text').innerText = "@" + (profile.username || "user");
        document.getElementById('bio-text').innerText = profile.bio || "這傢伙很懶，什麼都沒留下...";
        
        // 填充編輯表單
        document.getElementById('edit-display-name').value = profile.display_name || "";
        document.getElementById('edit-bio').value = profile.bio || "";
        
        if (privateData) {
            document.getElementById('edit-email').value = privateData.email || "";
            document.getElementById('edit-birthday').value = privateData.birthday || "";
        }

    } catch (e) {
        console.error("載入資料失敗:", e);
    }
}

/**
 * 儲存個人資料 (含 Storage 清理邏輯)
 */
window.saveProfile = async function() {
    const btn = document.getElementById('save-profile-btn');
    const originalText = btn.innerText;
    btn.innerText = "儲存中...";
    btn.disabled = true;

    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) throw new Error("未授權");

        // 0. 先獲取目前的舊資料，用於後續檔案清理判斷
        const { data: oldProfile } = await window.supabaseClient
            .from('profiles')
            .select('avatar_url, banner_url')
            .eq('id', myId)
            .single();

        let newAvatarUrl = oldProfile?.avatar_url;
        let newBannerUrl = oldProfile?.banner_url;

        // 1. 處理頭像上傳 (如果有新選擇的頭像)
        const avatarFile = document.getElementById('avatar-input').files[0];
        if (avatarFile) {
            // A. 先刪除舊檔案
            if (oldProfile?.avatar_url) {
                await deleteOldFileFromStorage('avatars', oldProfile.avatar_url);
            }
            // B. 上傳新檔案
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${myId}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await window.supabaseClient.storage
                .from('avatars')
                .upload(fileName, avatarFile, { upsert: true });
            
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = window.supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            newAvatarUrl = publicUrl;
        }

        // 2. 處理封面圖上傳
        const bannerFile = document.getElementById('banner-input').files[0];
        if (bannerFile) {
            // A. 先刪除舊檔案
            if (oldProfile?.banner_url) {
                await deleteOldFileFromStorage('banners', oldProfile.banner_url);
            }
            // B. 上傳新檔案
            const fileExt = bannerFile.name.split('.').pop();
            const fileName = `${myId}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await window.supabaseClient.storage
                .from('banners')
                .upload(fileName, bannerFile, { upsert: true });
            
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = window.supabaseClient.storage.from('banners').getPublicUrl(fileName);
            newBannerUrl = publicUrl;
        }

        // 3. 更新 profiles 表 (公有資料)
        const displayName = document.getElementById('edit-display-name').value.trim();
        const bio = document.getElementById('edit-bio').value.trim();

        const { error: pUpdateError } = await window.supabaseClient
            .from('profiles')
            .update({
                display_name: window.escapeHTML(displayName),
                bio: window.escapeHTML(bio),
                avatar_url: newAvatarUrl,
                banner_url: newBannerUrl,
                updated_at: new Date()
            })
            .eq('id', myId);

        if (pUpdateError) throw pUpdateError;

        // 4. 更新 user_private_data 表 (私有資料)
        const email = document.getElementById('edit-email').value.trim();
        const birthday = document.getElementById('edit-birthday').value;

        const { error: pvUpdateError } = await window.supabaseClient
            .from('user_private_data')
            .update({
                email: email,
                birthday: birthday,
                updated_at: new Date()
            })
            .eq('id', myId);

        if (pvUpdateError) throw pvUpdateError;

        alert("✨ 個人資料更新成功！");
        window.closeEditProfile();
        window.loadMyProfile();

    } catch (e) {
        alert("儲存失敗: " + e.message);
        console.error(e);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

/**
 * 粉絲與訂閱列表管理
 */
window.openFansSubsModal = async function(type) {
    const modal = document.getElementById('fans-subs-modal');
    const title = document.getElementById('fans-subs-title');
    const list = document.getElementById('fans-subs-list');

    if (modal) modal.classList.remove('hidden');
    title.innerText = type === 'fans' ? '我的粉絲' : '我追蹤的人';
    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-2xl"></i></div>`;

    const myId = await getAuthenticatedUserId();
    if (!myId) return;

    if (type === 'subs') {
        try {
            const { data: subs, error } = await window.supabaseClient
                .from('subscriptions')
                .select('*, profiles!subscriptions_target_id_fkey(id, display_name, avatar_url)')
                .eq('follower_id', myId);

            if (error) throw error;

            if (!subs || subs.length === 0) {
                list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">尚未追蹤任何人</div>`;
                return;
            }

            list.innerHTML = subs.map(sub => {
                const user = sub.profiles;
                const safeName = window.escapeHTML(user.display_name || '未命名用戶');
                const safeAvatar = window.escapeHTML(user.avatar_url || `https://ui-avatars.com/api/?name=${safeName}`);
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${safeName}</div>
                    <button onclick="event.stopPropagation(); unfollowUserFromList('${sub.id}', this)" class="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-bold active:scale-90 transition">取消追蹤</button>
                </div>`;
            }).join('');
        } catch(e) {
            list.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">讀取失敗</div>`;
        }
    }
}

window.unfollowUserFromList = async function(subscriptionId, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    try {
        const { error } = await window.supabaseClient
            .from('subscriptions')
            .delete()
            .eq('id', subscriptionId);

        if (error) throw error;
        btn.closest('div').parentElement.removeChild(btn.closest('div'));
    } catch (e) {
        alert("操作失敗");
    }
}

window.closeFansSubsModal = function() {
    const modal = document.getElementById('fans-subs-modal');
    if (modal) modal.classList.add('hidden');
}

window.openEditProfile = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.remove('hidden');
}

window.closeEditProfile = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.add('hidden');
}
