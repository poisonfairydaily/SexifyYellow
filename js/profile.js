// ==========================================
// js/profile.js - 終極修復版 (單表結構 + 自動清理舊圖)
// ==========================================

// 1. 全域初始化：確保 DOM 加載完後執行
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Profile.js 啟動，讀取單一 profiles 表...");
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

// 3. 核心功能：加載個人檔案
async function loadProfileData() {
    const list = document.getElementById('creator-header');
    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) return;

        // 【核心修正】：只讀取 profiles 一張表，不再尋找 user_private_data
        let { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        // 容錯處理：如果資料庫裡沒有這筆資料 (PGRST116)，自動建立初始資料
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
            profile = newData;
        } else if (error) {
            throw error;
        }

        renderProfileUI(profile);
        fetchMyPosts(myId);

    } catch (e) {
        console.error("讀取失敗:", e);
        if (list) list.innerHTML = `<div class="text-center py-20 text-red-400 font-bold">讀取資料失敗，請重新整理頁面。</div>`;
    }
}

// 4. UI 渲染邏輯
function renderProfileUI(profile) {
    if (!profile) return;

    // A. 渲染頁面顯示文字 (防呆處理)
    const displayNameElem = document.getElementById('creator-display-name');
    const usernameElem = document.getElementById('creator-username');
    const bioElem = document.getElementById('creator-bio');
    const headerNameElem = document.getElementById('header-name');

    if (displayNameElem) displayNameElem.innerText = profile.display_name || '未命名用戶';
    if (usernameElem) usernameElem.innerText = `@${profile.username || 'user'}`;
    if (bioElem) bioElem.innerText = profile.bio || '尚未填寫簡介...';
    if (headerNameElem) headerNameElem.innerText = profile.display_name || '個人檔案';

    // B. 渲染圖片 (全域變數紀錄當前圖片，用於後續刪除判斷)
    window.currentAvatarUrl = profile.avatar_url;
    window.currentBannerUrl = profile.banner_url;

    const avatarElem = document.getElementById('creator-avatar');
    const bannerElem = document.getElementById('creator-banner');

    if (avatarElem) {
        avatarElem.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name || 'U'}`;
    }
    if (bannerElem && profile.banner_url) {
        bannerElem.src = profile.banner_url;
    }

    // C. 預填編輯彈窗表單
    const editName = document.getElementById('edit-display-name');
    const editUsername = document.getElementById('edit-username');
    const editBio = document.getElementById('edit-bio');
    const editBirthday = document.getElementById('edit-birthday');
    const editEmail = document.getElementById('edit-email');

    if (editName) editName.value = profile.display_name || '';
    if (editUsername) editUsername.value = profile.username || '';
    if (editBio) editBio.value = profile.bio || '';
    if (editBirthday) editBirthday.value = profile.birthday || ''; // 從 profiles 表讀取
    if (editEmail) editEmail.value = profile.contact_email || ''; // 根據 JSON 架構使用 contact_email
}

// 5. 檔案上傳與【舊圖自動清理】邏輯
async function handleFileUpload(file, bucket, oldUrl) {
    const myId = await getAuthenticatedUserId();
    
    // 檔名加上時間戳與替換特殊字元，防止上傳出錯
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${myId}/${Date.now()}_${safeFileName}`;
    
    // A. 上傳新圖片
    const { error: uploadError } = await window.supabaseClient.storage
        .from(bucket)
        .upload(fileName, file);
        
    if (uploadError) throw uploadError;

    // B. 獲取新圖片的公開網址
    const { data: { publicUrl } } = window.supabaseClient.storage
        .from(bucket)
        .getPublicUrl(fileName);

    // C. 刪除舊圖片 (安全防呆：確認有舊網址且屬於該 Bucket)
    if (oldUrl && oldUrl.includes(`/public/${bucket}/`)) {
        const oldPath = oldUrl.split(`/public/${bucket}/`)[1];
        if (oldPath) {
            // 背景執行刪除，不阻塞主流程
            window.supabaseClient.storage.from(bucket).remove([oldPath])
                .then(({ error: delErr }) => { 
                    if (delErr) console.warn(`舊檔案 ${oldPath} 刪除失敗:`, delErr); 
                    else console.log(`已成功清理舊檔案: ${oldPath}`);
                });
        }
    }

    return publicUrl;
}

// 6. 儲存設定 (核心更新邏輯)
window.saveProfile = async function() {
    const btn = document.querySelector('[onclick="saveProfile()"]');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "正在儲存中...";
    }

    try {
        const myId = await getAuthenticatedUserId();
        const avatarFile = document.getElementById('avatar-input')?.files[0];
        const bannerFile = document.getElementById('banner-input')?.files[0];

        let newAvatarUrl = window.currentAvatarUrl;
        let newBannerUrl = window.currentBannerUrl;

        // 如果使用者有選擇新圖片，則執行上傳與清理邏輯
        if (avatarFile) {
            newAvatarUrl = await handleFileUpload(avatarFile, 'avatars', window.currentAvatarUrl);
        }
        if (bannerFile) {
            newBannerUrl = await handleFileUpload(bannerFile, 'banners', window.currentBannerUrl);
        }

        // 收集表單資料
        const updates = {
            display_name: document.getElementById('edit-display-name')?.value || '',
            username: document.getElementById('edit-username')?.value || '',
            bio: document.getElementById('edit-bio')?.value || '',
            birthday: document.getElementById('edit-birthday')?.value || '',
            contact_email: document.getElementById('edit-email')?.value || '',
            avatar_url: newAvatarUrl,
            banner_url: newBannerUrl,
            updated_at: new Date()
        };

        // 【核心修正】：一次更新所有欄位至 profiles 表
        const { error: updateError } = await window.supabaseClient
            .from('profiles')
            .update(updates)
            .eq('id', myId);

        if (updateError) throw updateError;

        alert("✨ 個人資料更新成功！");
        location.reload(); // 重新整理頁面以顯示最新資料

    } catch (e) {
        alert("儲存失敗: " + e.message);
        console.error("儲存過程發生錯誤:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "儲存設定";
        }
    }
};

// 7. 圖片預覽與 Canvas 壓縮 (解決手機上傳大圖卡頓)
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
                
                const previewImg = document.getElementById(imgId);
                if (previewImg) previewImg.src = canvas.toDataURL('image/jpeg', 0.8);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// 8. 抓取我的貼文作品集 (Masonry 瀑布流)
async function fetchMyPosts(uid) {
    const grid = document.getElementById('creator-posts-grid');
    if (!grid) return;

    const { data, error } = await window.supabaseClient
        .from('posts')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 font-bold">尚無發佈任何作品</div>`;
        return;
    }

    grid.innerHTML = data.map(post => {
        const isVideo = post.media_url && (post.media_url.includes('video') || post.media_url.endsWith('.mp4'));
        const mediaTag = isVideo 
            ? `<video src="${post.media_url}" class="w-full h-auto object-cover rounded-xl" muted autoplay loop></video>` 
            : `<img src="${post.media_url}" class="w-full h-auto object-cover rounded-xl">`;
        
        const paidTag = post.is_paid 
            ? `<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg"><i class="fa-solid fa-lock mr-1"></i>付費</div>` 
            : '';

        return `
        <div class="masonry-item relative group shadow-sm bg-white rounded-xl overflow-hidden mb-2">
            ${mediaTag}
            ${paidTag}
        </div>`;
    }).join('');
}

// 9. UI 彈窗控制與粉絲列表 (完整保留)
window.openEditModal = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeEditModal = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) modal.classList.add('hidden');
};

window.loadFansAndSubs = async function(type) {
    const modal = document.getElementById('fans-subs-modal');
    const title = document.getElementById('fans-subs-title');
    const list = document.getElementById('fans-subs-list');

    if (modal) modal.classList.remove('hidden');
    if (title) title.innerText = type === 'fans' ? '我的粉絲' : '我追蹤的人';
    if (list) list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-2xl"></i></div>`;

    const myId = await getAuthenticatedUserId();
    if (!myId) return;

    if (type === 'subs') {
        try {
            // 讀取 subscriptions 表，並關聯 profiles 取得對方頭像與名字
            const { data: subs, error } = await window.supabaseClient
                .from('subscriptions')
                .select('*, profiles!subscriptions_target_id_fkey(id, display_name, avatar_url)')
                .eq('follower_id', myId);

            if (error) throw error;

            if (!subs || subs.length === 0) {
                list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm font-bold">尚未追蹤任何人</div>`;
                return;
            }

            list.innerHTML = subs.map(sub => {
                const user = sub.profiles;
                if (!user) return '';
                const safeName = window.escapeHTML ? window.escapeHTML(user.display_name || '未命名用戶') : (user.display_name || '未命名用戶');
                const safeAvatar = user.avatar_url || `https://ui-avatars.com/api/?name=${safeName}`;
                
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); if(typeof viewOtherProfile === 'function') viewOtherProfile('${user.id}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${safeName}</div>
                    <button onclick="event.stopPropagation(); unfollowUserFromList('${sub.id}', this)" class="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-bold active:scale-90 transition hover:bg-red-100 hover:text-red-600">取消</button>
                </div>`;
            }).join('');
        } catch(e) {
            console.error(e);
            list.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">列表讀取失敗</div>`;
        }
    } else {
        // 粉絲列表暫未實作對應關聯
        list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前尚無粉絲資料</div>`;
    }
};

window.unfollowUserFromList = async function(subscriptionId, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    try {
        const { error } = await window.supabaseClient
            .from('subscriptions')
            .delete()
            .eq('id', subscriptionId);

        if (error) throw error;
        // 成功後將該項目從畫面上移除
        const itemDiv = btn.closest('.flex');
        if (itemDiv) itemDiv.remove();
    } catch (e) {
        alert("操作失敗，請稍後再試。");
    }
};

window.closeFansSubsModal = function() {
    const modal = document.getElementById('fans-subs-modal');
    if (modal) modal.classList.add('hidden');
};
