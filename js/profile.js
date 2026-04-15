// ==========================================
// js/profile.js - 終極修復版 (自動清理舊圖 + 正確 Bucket 指向)
// ==========================================

// 1. 全域初始化：確保 DOM 加載完後執行
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile.js 啟動，正在載入個人檔案...");
    await loadProfileData();
});

// 2. 內部工具：獲取當前經過驗證的 User ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) {
        console.error("未找到登入狀態");
        return null;
    }
    return user.id;
}

// 3. 核心功能：載入個人檔案
async function loadProfileData() {
    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) return;

        let { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        // 容錯處理：如果資料庫中沒有資料，則自動建立
        if (error && error.code === 'PGRST116') {
            const { data: newUser, error: createError } = await window.supabaseClient
                .from('profiles')
                .insert([{ id: myId, display_name: '新用戶', username: `user_${Math.floor(Math.random()*10000)}` }])
                .select()
                .single();
            if (createError) throw createError;
            profile = newUser;
        } else if (error) {
            throw error;
        }

        // 渲染資料到 UI
        const avatarEl = document.getElementById('my-avatar');
        const bannerEl = document.getElementById('my-banner');
        const nameEl = document.getElementById('display-name');
        const usernameEl = document.getElementById('username-display');
        const bioEl = document.getElementById('bio-display');

        if (avatarEl) avatarEl.src = profile.avatar_url || 'https://ui-avatars.com/api/?name=U';
        if (bannerEl) bannerEl.style.backgroundImage = profile.banner_url ? `url('${profile.banner_url}')` : 'none';
        if (nameEl) nameEl.innerText = profile.display_name || '未命名';
        if (usernameEl) usernameEl.innerText = `@${profile.username || 'unknown'}`;
        if (bioEl) bioEl.innerText = profile.bio || '尚未填寫簡介';

    } catch (e) {
        console.error("載入失敗:", e);
    }
}

/**
 * 4. 核心功能：上傳檔案並清理舊圖
 * @param {File} file 檔案物件
 * @param {string} type 類型 ('avatar' 或 'banner')
 */
async function handleImageUpdate(file, type) {
    if (!file) return;

    const myId = await getAuthenticatedUserId();
    if (!myId) return alert("請先登入");

    // 根據類型設定正確的 Bucket 和資料欄位
    const bucketName = type === 'avatar' ? 'avatars' : 'banners';
    const dbColumn = type === 'avatar' ? 'avatar_url' : 'banner_url';

    try {
        // A. 獲取舊的圖片 URL 以便稍後刪除
        const { data: oldProfile } = await window.supabaseClient
            .from('profiles')
            .select(dbColumn)
            .eq('id', myId)
            .single();

        const oldUrl = oldProfile ? oldProfile[dbColumn] : null;

        // B. 上傳新圖片 (路徑格式: userId/timestamp_filename)
        const fileExt = file.name.split('.').pop();
        const fileName = `${myId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
            .from(bucketName)
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        // C. 獲取新圖片的公開網址
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        // D. 更新資料庫
        const { error: updateError } = await window.supabaseClient
            .from('profiles')
            .update({ [dbColumn]: publicUrl })
            .eq('id', myId);

        if (updateError) throw updateError;

        // E. 【核心功能】清理舊圖：如果資料庫更新成功，且原本有舊圖片，則刪除舊檔案
        if (oldUrl && oldUrl.includes(bucketName)) {
            try {
                // 從 URL 中解析出檔案路徑 (userId/filename)
                const urlParts = oldUrl.split(`${bucketName}/`);
                if (urlParts.length > 1) {
                    const oldFilePath = urlParts[1];
                    await window.supabaseClient.storage
                        .from(bucketName)
                        .remove([oldFilePath]);
                    console.log(`已從 ${bucketName} 刪除舊圖: ${oldFilePath}`);
                }
            } catch (delError) {
                console.warn("舊圖刪除失敗（可能檔案已被手動移除）:", delError);
            }
        }

        alert("更新成功！");
        await loadProfileData(); // 重新載入畫面

    } catch (err) {
        console.error("更新過程中出錯:", err);
        alert("上傳失敗：" + err.message);
    }
}

// 5. 事件監聽：頭像上傳
window.triggerAvatarUpload = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleImageUpdate(e.target.files[0], 'avatar');
    input.click();
};

// 6. 事件監聽：背景橫幅上傳
window.triggerBannerUpload = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleImageUpdate(e.target.files[0], 'banner');
    input.click();
};

// 7. 編輯其他資料 (姓名、簡介)
window.editProfileInfo = async function() {
    const newName = prompt("請輸入新的暱稱:");
    const newBio = prompt("請輸入個人簡介:");
    
    if (newName === null) return;

    const myId = await getAuthenticatedUserId();
    const { error } = await window.supabaseClient
        .from('profiles')
        .update({ 
            display_name: newName,
            bio: newBio 
        })
        .eq('id', myId);

    if (error) alert("更新失敗");
    else await loadProfileData();
};
