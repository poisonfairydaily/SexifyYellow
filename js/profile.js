// ==========================================
// js/profile.js - R2 儲存整合 + WebP 自動轉檔 + 安全強化最終完整版
// ==========================================

// ✨ 配置：R2 Uploader Worker 網址
if (typeof window.WORKER_URL === 'undefined') {
    window.WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";
}

// 🛡️ 內部工具：防止 XSS 攻擊
window.escapeHTML = function(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
};

// 🔐 內部工具：獲取當前真實經過驗證的 User ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// 🚀 ✨ 修改：將圖片上傳至 R2，並統一使用 .webp 命名
async function uploadToR2(base64Str, type = 'avatar') {
    try {
        const myId = await getAuthenticatedUserId();
        const res = await fetch(base64Str);
        const blob = await res.blob();
        
        const formData = new FormData();
        // 檔名規則：類型_ID_時間戳.webp
        const fileName = `${type}_${myId}_${Date.now()}.webp`;
        formData.append('file', blob, fileName);

        const response = await fetch(`${window.WORKER_URL}/`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.url) return result.url;
        throw new Error("Worker 回傳網址失敗");
    } catch (err) {
        console.error("R2 Upload Error:", err);
        throw err;
    }
}

// 🖼️ ✨ 修改：圖片預覽並強制在 Canvas 轉換為 WebP
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

                // 等比例縮放
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
                
                const displayImg = document.getElementById(imgId);
                // ✨ 這裡將格式改為 image/webp，品質設定為 0.8
                displayImg.src = canvas.toDataURL('image/webp', 0.8);
                displayImg.classList.remove('hidden');
            };
            img.src = event.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// ------------------------------------------
// 1. 個人中心模組 (處理私密數據)
// ------------------------------------------

window.openPersonalCenter = async function() {
    try {
        if(typeof toggleSettings === 'function') toggleSettings(); 
        const modal = document.getElementById('personal-center-modal');
        if(!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => modal.classList.remove('translate-y-full'), 10);

        const myId = await getAuthenticatedUserId();
        if (!myId) return;

        const [profRes, privRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('gender').eq('id', myId).single(),
            window.supabaseClient.from('user_private_data').select('birthday, contact_email').eq('id', myId).maybeSingle()
        ]);

        if (privRes.data) {
            const emailInput = document.getElementById('pc-email');
            const bdayInput = document.getElementById('pc-birthday');
            if(emailInput) emailInput.value = privRes.data.contact_email || '';
            if(bdayInput) bdayInput.value = privRes.data.birthday || '';
        }
        
        if (profRes.data) {
            const genderInput = document.getElementById('pc-gender');
            if(genderInput) genderInput.value = profRes.data.gender || 'Unspecified';
        }
    } catch(e) {
        console.error("無法載入個人中心資料", e);
    }
}

window.closePersonalCenter = function() {
    const modal = document.getElementById('personal-center-modal');
    if (!modal) return;
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

window.savePersonalCenter = async function() {
    const btn = document.getElementById('save-personal-btn');
    const myId = await getAuthenticatedUserId();
    if (!myId) return alert('請先登入');

    btn.innerText = "處理中..."; btn.disabled = true;

    const newEmail = document.getElementById('pc-email').value.trim();
    const newGender = document.getElementById('pc-gender').value;
    const newBirthday = document.getElementById('pc-birthday').value;
    
    try {
        const updatePublic = window.supabaseClient.from('profiles').update({ gender: newGender }).eq('id', myId);
        const updatePrivate = window.supabaseClient.from('user_private_data').upsert({
            id: myId,
            contact_email: newEmail,
            birthday: newBirthday,
            updated_at: new Date()
        });

        const [res1, res2] = await Promise.all([updatePublic, updatePrivate]);
        if (res1.error) throw res1.error;
        if (res2.error) throw res2.error;

        alert('個人中心資料已更新！');
        closePersonalCenter();
    } catch(e) {
        alert('更新失敗: ' + e.message);
    } finally {
        btn.innerText = "儲存"; btn.disabled = false;
    }
}

// ------------------------------------------
// 2. 個人專頁與編輯資料模組
// ------------------------------------------

window.renderProfile = async function() {
    const container = document.getElementById('my-profile-container');
    if (!container) return;

    const myId = await getAuthenticatedUserId();
    if (!myId) { 
        container.innerHTML = `<div class="p-10 text-center text-gray-400 mt-20">請先登入</div>`; 
        return; 
    }

    container.innerHTML = `<div class="p-10 text-center mt-20"><i class="fa-solid fa-spinner fa-spin text-2xl text-sexify"></i></div>`;

    try {
        const [profileRes, postsRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', myId).single(),
            window.supabaseClient.from('posts').select('*').eq('user_id', myId).order('created_at', { ascending: false })
        ]);

        if (profileRes.error) throw profileRes.error;
        
        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&background=random`;
        const bannerUrl = profile.banner_url || '';

        const bannerHtml = bannerUrl ? `<img src="${bannerUrl}" class="w-full h-40 object-cover">` : `<div class="w-full h-40 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>`;

        let html = `
            <div class="bg-white pb-4 shadow-sm relative">
                ${bannerHtml}
                <div class="px-5 relative -mt-12">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button onclick="openEditProfile()" class="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold active:scale-95 transition shadow-sm mb-2">編輯資料</button>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900">${window.escapeHTML(profile.display_name || '未命名')}</h2>
                        <p class="text-xs text-sexify font-bold mt-0.5 mb-2">@${window.escapeHTML(profile.username || 'unknown')}</p>
                        <p class="text-sm text-gray-600 whitespace-pre-line">${window.escapeHTML(profile.bio || '尚未填寫簡介')}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 pt-3 pb-32 min-h-[300px]"><div class="masonry-grid px-2">`;
        
        if (myPosts.length > 0) {
            html += myPosts.map(p => `
                <div class="masonry-item relative shadow-sm border border-gray-100 bg-white p-2 rounded-xl mb-3 break-inside-avoid" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字內容</div>`}
                    <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed mt-1">${window.escapeHTML(p.caption || '')}</p>
                </div>
            `).join('');
        } else {
            html += `<div class="col-span-2 text-center py-20 text-gray-400 w-full">尚無發佈貼文</div>`;
        }
        container.innerHTML = html + `</div></div>`;

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="p-10 text-center text-red-500 mt-20">讀取失敗。</div>`;
    }
}

// ✨ 開啟編輯資料彈窗邏輯
window.openEditProfile = async function() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;

    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) return alert('請先登入');

        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', myId)
            .single();

        if (error) throw error;

        // 填入資料到編輯框
        const editName = document.getElementById('edit-display-name');
        const editBio = document.getElementById('edit-bio');
        if (editName) editName.value = profile.display_name || '';
        if (editBio) editBio.value = profile.bio || '';
        
        const avatarPreview = document.getElementById('edit-avatar-preview');
        if (avatarPreview) avatarPreview.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}`;
        
        const bannerPreview = document.getElementById('edit-banner-preview');
        if (bannerPreview && profile.banner_url) {
            bannerPreview.src = profile.banner_url;
            bannerPreview.classList.remove('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (err) {
        console.error(err);
        alert("無法讀取個人資料");
    }
};

// ✨ 關閉編輯資料彈窗
window.closeEditProfile = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// ✨ 儲存個人資料 (整合 R2 + WebP)
window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const myId = await getAuthenticatedUserId();
    if (!myId) return alert('請登入');

    btn.innerText = "轉檔上傳中..."; btn.disabled = true;
    
    try {
        let avatarSrc = document.getElementById('edit-avatar-preview').src;
        let bannerSrc = document.getElementById('edit-banner-preview').src;

        // 若圖片是剛選擇的 WebP Base64 數據，則上傳至 R2
        if (avatarSrc.startsWith('data:image')) {
            avatarSrc = await uploadToR2(avatarSrc, 'avatar');
        }
        if (bannerSrc.startsWith('data:image')) {
            bannerSrc = await uploadToR2(bannerSrc, 'banner');
        }

        const updateData = {
            display_name: document.getElementById('edit-display-name').value.trim(),
            bio: document.getElementById('edit-bio').value.trim(),
            avatar_url: avatarSrc,
            banner_url: (bannerSrc && bannerSrc.includes('http')) ? bannerSrc : null
        };

        const { error } = await window.supabaseClient.from('profiles').update(updateData).eq('id', myId);
        if (error) throw error;

        localStorage.setItem('myChatName', updateData.display_name);
        
        closeEditProfile();
        renderProfile();
    } catch (err) {
        alert("更新失敗：" + err.message);
    } finally {
        btn.innerText = "儲存"; btn.disabled = false;
    }
}

// ------------------------------------------
// 3. 他人主頁模組
// ------------------------------------------

window.viewOtherProfile = async function(userId) {
    const myId = await getAuthenticatedUserId();
    if (userId === myId) {
        if (typeof switchTab === 'function') switchTab('profile-tab', document.querySelectorAll('.nav-btn')[3]);
        return;
    }

    const modal = document.getElementById('other-profile-modal');
    if(!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data: user, error } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;

        const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=random`;
        document.getElementById('other-header-name').innerText = user.display_name;
        document.getElementById('other-display-name').innerText = user.display_name;
        document.getElementById('other-username').innerText = `@${user.username}`;
        document.getElementById('other-bio').innerText = user.bio || '尚未寫下簡介。';
        document.getElementById('other-avatar').src = avatar;

        const bannerImg = document.getElementById('other-banner');
        if (user.banner_url) { bannerImg.src = user.banner_url; bannerImg.classList.remove('hidden'); } 
        else { bannerImg.classList.add('hidden'); }

        document.getElementById('other-msg-btn').onclick = () => {
            closeOtherProfile();
            if(typeof openChat === 'function') openChat(userId, user.display_name, avatar);
        };

        const followBtn = document.getElementById('other-follow-btn');
        const { data: subData } = await window.supabaseClient.from('subscriptions').select('id').eq('subscriber_id', myId).eq('creator_id', userId);
        const isSubbed = subData && subData.length > 0;

        if (isSubbed) {
            followBtn.innerText = "已追蹤";
            followBtn.className = "bg-gray-200 text-gray-700 px-6 py-2 rounded-full text-xs font-bold";
            followBtn.onclick = null;
        } else {
            followBtn.innerText = "追蹤";
            followBtn.className = "bg-sexify text-white px-6 py-2 rounded-full text-xs font-bold";
            followBtn.onclick = async () => {
                followBtn.innerText = "處理中...";
                try {
                    await window.supabaseClient.from('subscriptions').insert({ subscriber_id: myId, creator_id: userId });
                    await window.supabaseClient.from('notifications').insert({ user_id: userId, actor_id: myId, type: 'subscribe' });
                    followBtn.innerText = "已追蹤";
                    followBtn.className = "bg-gray-200 text-gray-700 px-6 py-2 rounded-full text-xs font-bold";
                    followBtn.onclick = null;
                } catch(e) { followBtn.innerText = "追蹤失敗"; }
            };
        }

        const { data: posts } = await window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const grid = document.getElementById('other-posts-grid');
        if (!posts || posts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚無內容</div>`;
        } else {
            grid.innerHTML = posts.map(p => `
                <div class="masonry-item cursor-pointer bg-white p-2 border border-gray-100 rounded-xl mb-3 break-inside-avoid" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字</div>`}
                    <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed mt-1">${window.escapeHTML(p.caption || '')}</p>
                </div>
            `).join('');
        }
    } catch (err) { console.error(err); }
}

window.closeOtherProfile = function() {
    const modal = document.getElementById('other-profile-modal');
    if(!modal) return;
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

// ------------------------------------------
// 4. 粉絲與訂閱清單模組
// ------------------------------------------

window.openFansSubsModal = function() {
    if(typeof toggleSettings === 'function') toggleSettings(); 
    const modal = document.getElementById('fans-subs-modal');
    if(!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    switchFansTab('subs'); 
}

window.closeFansSubsModal = function() {
    const modal = document.getElementById('fans-subs-modal');
    if(!modal) return;
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

window.switchFansTab = async function(tab) {
    const btnFans = document.getElementById('tab-fans');
    const btnSubs = document.getElementById('tab-subs');
    const list = document.getElementById('fans-subs-list');
    const myId = await getAuthenticatedUserId();

    if(!list) return;
    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-gray-300 text-2xl"></i></div>`;

    if (tab === 'fans') {
        btnFans.classList.add('text-sexify', 'border-sexify');
        btnFans.classList.remove('text-gray-400', 'border-transparent');
        btnSubs.classList.add('text-gray-400', 'border-transparent');
        btnSubs.classList.remove('text-sexify', 'border-sexify');

        try {
            const { data: subs, error } = await window.supabaseClient.from('subscriptions').select('*').eq('creator_id', myId);
            if (error) throw error;
            if (!subs || subs.length === 0) {
                list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前還沒有粉絲</div>`;
                return;
            }
            const subIds = [...new Set(subs.map(s => s.subscriber_id).filter(Boolean))];
            let profMap = {};
            if (subIds.length > 0) {
                const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', subIds);
                if (profs) profs.forEach(p => profMap[p.id] = p);
            }
            list.innerHTML = subs.map(sub => {
                const user = profMap[sub.subscriber_id];
                if(!user) return '';
                const safeName = window.escapeHTML(user.display_name || '未命名用戶');
                const safeAvatar = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}`;
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${safeName}</div>
                </div>`;
            }).join('');
        } catch(e) { list.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">讀取失敗</div>`; }
    } else {
        btnSubs.classList.add('text-sexify', 'border-sexify');
        btnSubs.classList.remove('text-gray-400', 'border-transparent');
        btnFans.classList.add('text-gray-400', 'border-transparent');
        btnFans.classList.remove('text-sexify', 'border-sexify');

        try {
            const { data: subs, error } = await window.supabaseClient.from('subscriptions').select('*').eq('subscriber_id', myId);
            if (error) throw error;
            if (!subs || subs.length === 0) {
                list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">尚未訂閱任何用戶</div>`;
                return;
            }
            const creatorIds = [...new Set(subs.map(s => s.creator_id).filter(Boolean))];
            let profMap = {};
            if (creatorIds.length > 0) {
                const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', creatorIds);
                if (profs) profs.forEach(p => profMap[p.id] = p);
            }
            list.innerHTML = subs.map(sub => {
                const user = profMap[sub.creator_id];
                if(!user) return '';
                const safeName = window.escapeHTML(user.display_name || '未命名用戶');
                const safeAvatar = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}`;
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${safeName}</div>
                    <button onclick="event.stopPropagation(); unfollowUserFromList('${sub.id}', this)" class="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-bold active:scale-90 transition">取消追蹤</button>
                </div>`;
            }).join('');
        } catch(e) { list.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">讀取失敗</div>`; }
    }
}

window.unfollowUserFromList = async function(subscriptionId, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('subscriptions').delete().eq('id', subscriptionId);
        if(error) throw error;
        const item = btn.closest('.flex');
        item.classList.add('opacity-0', 'scale-95');
        setTimeout(() => item.remove(), 200);
    } catch(e) { alert("取消失敗"); }
}

// ------------------------------------------
// ✨ 初始化渲染
// ------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.renderProfile === 'function') {
        window.renderProfile();
    }
});
