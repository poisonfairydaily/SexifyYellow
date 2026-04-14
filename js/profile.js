// ==========================================
// js/profile.js - 個人檔案與安全性強化完整版
// 1. 修復身分偽造漏洞：使用 supabase.auth.getUser() 替代 localStorage
// 2. 強化安全性：所有資料存取均通過驗證後的 UID
// 3. 保持原 UI：保留 Masonry 佈局與所有彈窗動畫
// ==========================================

// 內部工具：獲取當前真實經過驗證的 User ID
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

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
                const displayImg = document.getElementById(imgId);
                displayImg.src = canvas.toDataURL('image/jpeg', 0.7);
                displayImg.classList.remove('hidden');
            };
            img.src = event.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadBase64ToSupabase(base64Str, path) {
    try {
        const res = await fetch(base64Str);
        const blob = await res.blob();
        
        const { data, error } = await window.supabaseClient.storage.from('media').upload(path, blob, { upsert: true, contentType: blob.type });
        if (error) throw error;
        
        const { data: publicData } = window.supabaseClient.storage.from('media').getPublicUrl(path);
        return publicData.publicUrl;
    } catch (err) { throw err; }
}

// 1. 個人中心
window.openPersonalCenter = async function() {
    try {
        if(typeof toggleSettings === 'function') toggleSettings(); 
        const modal = document.getElementById('personal-center-modal');
        if(!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => modal.classList.remove('translate-y-full'), 10);

        // 安全取得 User
        const myId = await getAuthenticatedUserId();
        if (!myId) return;

        const { data: { user } } = await window.supabaseClient.auth.getUser();

        if (user) {
            document.getElementById('pc-email').value = user.email || '';
            document.getElementById('pc-birthday').value = user.user_metadata?.birthday || '';
            
            const { data: profile } = await window.supabaseClient.from('profiles').select('gender').eq('id', user.id).single();
            if (profile) {
                document.getElementById('pc-gender').value = profile.gender || 'Unspecified';
            }
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
        const updates = { data: { birthday: newBirthday } };
        if (newEmail) updates.email = newEmail;
        const { error: authErr } = await window.supabaseClient.auth.updateUser(updates);
        if (authErr) throw authErr;

        const { error: profErr } = await window.supabaseClient.from('profiles').update({ gender: newGender }).eq('id', myId);
        if (profErr) throw profErr;

        alert('個人中心資料已更新！\n若修改了信箱，請至新信箱收取確認信。');
        closePersonalCenter();
    } catch(e) {
        alert('更新失敗: ' + e.message);
    } finally {
        btn.innerText = "儲存"; btn.disabled = false;
    }
}

// 2. 個人專頁與編輯資料
window.renderProfile = async function() {
    const container = document.getElementById('my-profile-container');
    const myId = await getAuthenticatedUserId();
    if (!myId) { 
        container.innerHTML = `<div class="p-10 text-center text-gray-400 mt-20">請先登入</div>`; 
        return; 
    }

    container.innerHTML = `<div class="p-10 text-center mt-20"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const [profileRes, postsRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', myId).single(),
            window.supabaseClient.from('posts').select('*').eq('user_id', myId).order('created_at', { ascending: false })
        ]);

        if (profileRes.error) throw profileRes.error;
        
        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=random`;
        const bannerUrl = profile.banner_url || '';

        // 更新編輯欄位
        const editName = document.getElementById('edit-display-name');
        const editBio = document.getElementById('edit-bio');
        if(editName) editName.value = profile.display_name || '';
        if(editBio) editBio.value = profile.bio || '';
        
        const avatarPreview = document.getElementById('edit-avatar-preview');
        if(avatarPreview) avatarPreview.src = avatarUrl;
        
        const bannerPreview = document.getElementById('edit-banner-preview');
        if (bannerPreview && bannerUrl) {
            bannerPreview.src = bannerUrl;
            bannerPreview.classList.remove('hidden');
        }

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
            <div class="bg-gray-50 pt-2 min-h-[300px]"><div class="masonry-grid px-2">`;
        
        if (myPosts.length > 0) {
            html += myPosts.map(p => `
                <div class="masonry-item relative shadow-sm border border-gray-100 bg-white p-2 rounded-xl" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字內容</div>`}
                    <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed">${window.escapeHTML(p.caption || '')}</p>
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

window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const myId = await getAuthenticatedUserId();
    if (!myId) return alert('請登入');

    btn.innerText = "處理中..."; btn.disabled = true;
    
    try {
        let avatarSrc = document.getElementById('edit-avatar-preview').src;
        let bannerSrc = document.getElementById('edit-banner-preview').src;

        if (avatarSrc.startsWith('data:image')) avatarSrc = await uploadBase64ToSupabase(avatarSrc, `avatars/${myId}_${Date.now()}.jpg`);
        if (bannerSrc.startsWith('data:image')) bannerSrc = await uploadBase64ToSupabase(bannerSrc, `banners/${myId}_${Date.now()}.jpg`);

        const updateData = {
            display_name: document.getElementById('edit-display-name').value.trim(),
            bio: document.getElementById('edit-bio').value.trim(),
            avatar_url: avatarSrc,
            banner_url: (bannerSrc && bannerSrc.includes('http')) ? bannerSrc : null
        };

        const { error } = await window.supabaseClient.from('profiles').update(updateData).eq('id', myId);
        if (error) throw error;

        // 更新本地存儲緩存（僅用於非安全顯示）
        localStorage.setItem('myChatName', updateData.display_name);
        
        if(typeof closeEditProfile === 'function') closeEditProfile();
        renderProfile();
    } catch (err) {
        alert("更新失敗：" + err.message);
    } finally {
        btn.innerText = "儲存"; btn.disabled = false;
    }
}

// 他人主頁
window.viewOtherProfile = async function(userId) {
    const myId = await getAuthenticatedUserId();
    if (userId === myId) return switchTab('profile-tab', document.querySelectorAll('.nav-btn')[3]);

    const modal = document.getElementById('other-profile-modal');
    if(!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data: user, error } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;

        const avatar = user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=random`;
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
            followBtn.classList.add('bg-gray-200', 'text-gray-700');
            followBtn.classList.remove('bg-sexify', 'text-white');
        } else {
            followBtn.innerText = "追蹤";
            followBtn.classList.add('bg-sexify', 'text-white');
            followBtn.classList.remove('bg-gray-200', 'text-gray-700');
            followBtn.onclick = async () => {
                followBtn.innerText = "處理中...";
                try {
                    await window.supabaseClient.from('subscriptions').insert({ subscriber_id: myId, creator_id: userId });
                    await window.supabaseClient.from('notifications').insert({ user_id: userId, actor_id: myId, type: 'subscribe' });
                    followBtn.innerText = "已追蹤";
                    followBtn.classList.replace('bg-sexify', 'bg-gray-200');
                    followBtn.classList.replace('text-white', 'text-gray-700');
                    followBtn.onclick = null;
                } catch(e) { followBtn.innerText = "追蹤失敗"; }
            };
        }

        const { data: posts } = await window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const grid = document.getElementById('other-posts-grid');
        if (!posts || posts.length === 0) grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚無內容</div>`;
        else {
            grid.innerHTML = posts.map(p => `
                <div class="masonry-item cursor-pointer bg-white p-2 border border-gray-100 rounded-xl" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字</div>`}
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

// 3. 粉絲與訂閱面板
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
        btnFans.classList.replace('text-gray-400', 'text-sexify');
        btnFans.classList.replace('border-transparent', 'border-sexify');
        btnSubs.classList.replace('text-sexify', 'text-gray-400');
        btnSubs.classList.replace('border-sexify', 'border-transparent');

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
                const safeAvatar = window.escapeHTML(user.avatar_url || `https://ui-avatars.com/api/?name=${safeName}`);
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover" onerror="this.src='https://ui-avatars.com/api/?name=U'">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${safeName}</div>
                </div>`;
            }).join('');
        } catch(e) {
            list.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">讀取失敗</div>`;
        }

    } else {
        btnSubs.classList.replace('text-gray-400', 'text-sexify');
        btnSubs.classList.replace('border-transparent', 'border-sexify');
        btnFans.classList.replace('text-sexify', 'text-gray-400');
        btnFans.classList.replace('border-sexify', 'border-transparent');

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
        const { error } = await window.supabaseClient.from('subscriptions').delete().eq('id', subscriptionId);
        if(error) throw error;
        btn.parentElement.classList.add('opacity-0', 'scale-95');
        setTimeout(() => btn.parentElement.remove(), 200);
    } catch(e) {
        alert("取消失敗");
    }
}
