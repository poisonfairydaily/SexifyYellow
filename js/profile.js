// ==========================================
// js/profile.js - Sexify 完整功能終極版
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile 系統啟動...");
    await loadProfileData();
});

// 獲取當前登入者 ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// 加載個人檔案資料
async function loadProfileData() {
    const myId = await getAuthenticatedUserId();
    if (!myId) {
        console.error("未登入");
        return;
    }

    try {
        let { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        // 容錯處理：如果 SQL 觸發器沒跑成功導致沒資料，前端手動補一筆
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
        console.error("加載失敗:", e);
    }
}

// UI 渲染
function renderProfileUI(data) {
    if (!data) return;

    // 頁面顯示
    document.getElementById('creator-display-name').innerText = data.display_name || '未命名';
    document.getElementById('creator-username').innerText = `@${data.username || 'user'}`;
    document.getElementById('creator-bio').innerText = data.bio || '這傢伙很懶，什麼都沒寫...';
    
    const avatarImg = document.getElementById('creator-avatar');
    const bannerImg = document.getElementById('creator-banner');
    
    if (data.avatar_url) avatarImg.src = data.avatar_url;
    if (data.banner_url) bannerImg.src = data.banner_url;

    // 編輯彈窗預填
    document.getElementById('edit-display-name').value = data.display_name || '';
    document.getElementById('edit-username').value = data.username || '';
    document.getElementById('edit-bio').value = data.bio || '';
    document.getElementById('edit-avatar-preview').src = avatarImg.src;
    document.getElementById('edit-banner-preview').src = data.banner_url || '';
}

// 儲存設定 (包含清理 Storage)
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

        // 處理圖片上傳
        if (avatarUrl.startsWith('data:image')) {
            avatarUrl = await uploadAndClean(myId, 'avatars', 'edit-avatar-input');
        }
        if (bannerUrl.startsWith('data:image')) {
            bannerUrl = await uploadAndClean(myId, 'banners', 'edit-banner-input');
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
        alert("儲存成功！");
        location.reload();
    } catch (e) {
        alert("儲存失敗: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "儲存設定";
    }
}

// 上傳與清理舊圖
async function uploadAndClean(userId, bucket, inputId) {
    const file = document.getElementById(inputId).files[0];
    if (!file) return null;

    const filePath = `${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    // 清理舊檔案
    const { data: oldFiles } = await window.supabaseClient.storage.from(bucket).list(userId);
    if (oldFiles && oldFiles.length > 0) {
        const toDelete = oldFiles.map(f => `${userId}/${f.name}`);
        await window.supabaseClient.storage.from(bucket).remove(toDelete);
    }

    // 上傳新圖
    const { error } = await window.supabaseClient.storage.from(bucket).upload(filePath, file);
    if (error) throw error;

    return window.supabaseClient.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
}

// 圖片預覽
window.previewImage = function(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById(imgId).src = e.target.result;
        reader.readAsDataURL(input.files[0]);
    }
}

// 彈窗與分頁控制
window.openEditModal = () => document.getElementById('edit-profile-modal').classList.remove('hidden');
window.closeEditModal = () => document.getElementById('edit-profile-modal').classList.add('hidden');

window.loadFansAndSubs = (type) => {
    document.getElementById('fans-subs-title').innerText = type === 'fans' ? '我的粉絲' : '我的訂閱';
    document.getElementById('fans-subs-modal').classList.remove('hidden');
    document.getElementById('fans-subs-list').innerHTML = '<div class="py-10 text-center text-gray-400">尚無資料</div>';
}

window.closeFansSubsModal = () => document.getElementById('fans-subs-modal').classList.add('hidden');
