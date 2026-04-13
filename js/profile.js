// ==========================================
// js/profile.js - 個人資料與 Storage 優化版
// ==========================================

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
                
                const compressed = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById(imgId).src = compressed;
                document.getElementById(imgId).classList.remove('hidden');
            };
            img.src = event.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadBase64ToStorage(base64Str, bucket, fileName) {
    try {
        const res = await fetch(base64Str);
        const blob = await res.blob();
        const { data, error } = await window.supabaseClient.storage
            .from(bucket)
            .upload(fileName, blob, { upsert: true });
        if (error) throw error;
        const { data: { publicUrl } } = window.supabaseClient.storage.from(bucket).getPublicUrl(fileName);
        return publicUrl;
    } catch (e) {
        console.error("Storage 上傳失敗:", e);
        return base64Str;
    }
}

window.saveProfile = async function() {
    const userId = localStorage.getItem('userId');
    const displayName = document.getElementById('edit-display-name').value.trim();
    const username = document.getElementById('edit-username').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatarData = document.getElementById('edit-avatar-preview').src;
    const bannerData = document.getElementById('edit-banner-preview').src;
    
    const saveBtn = document.querySelector('#edit-profile-modal button.bg-sexify');
    saveBtn.innerText = "正在保存...";
    saveBtn.disabled = true;

    try {
        let finalAvatarUrl = avatarData;
        let finalBannerUrl = bannerData;

        if (avatarData.startsWith('data:image')) {
            finalAvatarUrl = await uploadBase64ToStorage(avatarData, 'avatars', `avatar_${userId}_${Date.now()}.jpg`);
        }
        if (bannerData.startsWith('data:image')) {
            finalBannerUrl = await uploadBase64ToStorage(bannerData, 'avatars', `banner_${userId}_${Date.now()}.jpg`);
        }

        const { error } = await window.supabaseClient.from('profiles').update({
            display_name: displayName,
            username: username,
            bio: bio,
            avatar_url: finalAvatarUrl,
            banner_url: finalBannerUrl
        }).eq('id', userId);

        if (error) throw error;
        alert("資料已更新！");
        closeEditProfile();
        renderProfile();
    } catch (e) {
        alert("更新失敗：" + e.message);
    } finally {
        saveBtn.innerText = "保存修改";
        saveBtn.disabled = false;
    }
}

window.renderProfile = async function() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
        const { data: profile, error } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;

        document.getElementById('profile-display-name').innerText = profile.display_name || '未設置名稱';
        document.getElementById('profile-username').innerText = '@' + (profile.username || 'user');
        document.getElementById('profile-bio').innerText = profile.bio || '尚未填寫自我介紹';
        document.getElementById('profile-avatar').src = profile.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('profile-banner').src = profile.banner_url || '';

        // 更新編輯彈窗預設值
        document.getElementById('edit-display-name').value = profile.display_name || '';
        document.getElementById('edit-username').value = profile.username || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-avatar-preview').src = profile.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('edit-banner-preview').src = profile.banner_url || '';

        // 載入貼文
        renderMyPosts(userId);
    } catch (e) {}
}

async function renderMyPosts(uid) {
    const grid = document.getElementById('profile-posts-grid');
    const { data: posts } = await window.supabaseClient.from('posts').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    
    if (!posts || posts.length === 0) {
        grid.innerHTML = `<div class=\"col-span-2 text-center py-10 text-gray-400\">尚無發佈任何貼文</div>`;
        return;
    }

    grid.innerHTML = posts.map(p => `
        <div class="masonry-item relative group" onclick="viewPostDetail('${p.id}')">
            <img src="${p.media_url}" class="w-full object-cover">
            ${p.is_paid ? '<div class="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">付費限定</div>' : ''}
        </div>
    `).join('');
}

window.openEditProfile = () => document.getElementById('edit-profile-modal').classList.remove('hidden');
window.closeEditProfile = () => document.getElementById('edit-profile-modal').classList.add('hidden');

window.openFansSubsModal = async function(type) {
    const modal = document.getElementById('fans-subs-modal');
    const title = document.getElementById('fans-subs-title');
    const list = document.getElementById('fans-subs-list');
    const myUserId = localStorage.getItem('userId');
    
    modal.classList.remove('hidden');
    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-2xl text-gray-300"></i></div>`;

    if (type === 'fans') {
        title.innerText = '我的粉絲';
        try {
            const { data: fans } = await window.supabaseClient.from('subscriptions').select('subscriber_id').eq('creator_id', myUserId);
            if (!fans || fans.length === 0) { list.innerHTML = `<div class="text-center py-10 text-gray-400">目前還沒有粉絲</div>`; return; }
            const ids = fans.map(f => f.subscriber_id);
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', ids);
            list.innerHTML = profs.map(p => `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <img src="${p.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 font-bold text-gray-800 text-sm">${p.display_name}</div>
                </div>
            `).join('');
        } catch(e) { list.innerHTML = `<div class="text-center py-10 text-red-400">載入失敗</div>`; }
    } else {
        title.innerText = '我的追蹤';
        try {
            const { data: subs } = await window.supabaseClient.from('subscriptions').select('id, creator_id').eq('subscriber_id', myUserId);
            if (!subs || subs.length === 0) { list.innerHTML = `<div class="text-center py-10 text-gray-400">尚未追蹤任何人</div>`; return; }
            const ids = subs.map(s => s.creator_id);
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', ids);
            const profMap = {}; profs.forEach(p => profMap[p.id] = p);
            list.innerHTML = subs.map(sub => {
                const user = profMap[sub.creator_id];
                if(!user) return '';
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${user.display_name}</div>
                    <button onclick="event.stopPropagation(); unfollowUserFromList('${sub.id}', this)" class="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-bold active:scale-90 transition">取消追蹤</button>
                </div>`;
            }).join('');
        } catch(e) { list.innerHTML = `<div class="text-center py-10 text-red-400">載入失敗</div>`; }
    }
}

window.unfollowUserFromList = async function(subscriptionId, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('subscriptions').delete().eq('id', subscriptionId);
        if (error) throw error;
        btn.parentElement.remove();
    } catch (e) { alert("操作失敗"); }
}

window.closeFansSubsModal = () => document.getElementById('fans-subs-modal').classList.add('hidden');
