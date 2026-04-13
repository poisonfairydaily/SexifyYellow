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

// 核心功能：將 Base64 轉為 Blob 並上傳至 Supabase Storage
async function uploadToStorage(base64Str, bucket, path) {
    try {
        // 1. 將 Base64 轉為 Blob
        const response = await fetch(base64Str);
        const blob = await response.blob();
        
        // 2. 執行上傳 (使用 upsert: true 防止重複上傳出錯)
        const { data, error } = await window.supabaseClient.storage
            .from(bucket)
            .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

        if (error) throw error;

        // 3. 獲取公開 URL
        const { data: { publicUrl } } = window.supabaseClient.storage
            .from(bucket)
            .getPublicUrl(path);

        return publicUrl;
    } catch (err) {
        console.error(`Storage Upload Error (${bucket}):`, err);
        throw err;
    }
}

window.saveProfileChanges = async function() {
    const userId = localStorage.getItem('userId');
    if (!userId) return alert('請先登入');

    const btn = document.querySelector('button[onclick="saveProfileChanges()"]');
    btn.disabled = true;
    btn.innerText = '儲存中...';

    const displayName = document.getElementById('edit-display-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatarData = document.getElementById('avatar-preview').src;
    const bannerData = document.getElementById('banner-preview').src;

    try {
        let updateData = {
            display_name: displayName,
            bio: bio,
            updated_at: new Date()
        };

        // 如果頭像有變動 (是 Base64)
        if (avatarData.startsWith('data:image')) {
            const fileName = `${userId}/avatar_${Date.now()}.jpg`;
            updateData.avatar_url = await uploadToStorage(avatarData, 'avatars', fileName);
        }

        // 如果橫幅有變動 (是 Base64)
        if (bannerData.startsWith('data:image')) {
            const fileName = `${userId}/banner_${Date.now()}.jpg`;
            updateData.banner_url = await uploadToStorage(bannerData, 'avatars', fileName);
        }

        const { error } = await window.supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;

        alert('個人資料已更新！');
        location.reload();
    } catch (err) {
        alert('儲存失敗：' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = '儲存變更';
    }
}

window.renderProfile = async function() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        document.getElementById('my-avatar').src = profile.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('my-display-name').innerText = profile.display_name || '未命名用戶';
        document.getElementById('my-username').innerText = '@' + (profile.username || 'user');
        document.getElementById('my-bio').innerText = profile.bio || '尚未填寫簡介';

        // 預填編輯欄位
        document.getElementById('edit-display-name').value = profile.display_name || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('avatar-preview').src = profile.avatar_url || 'https://ui-avatars.com/api/?name=U';
        document.getElementById('banner-preview').src = profile.banner_url || '';
        
        if(profile.banner_url) document.getElementById('banner-preview').classList.remove('hidden');

    } catch (err) {
        console.error('加載資料失敗:', err);
    }
}

window.openFansSubsModal = async function(type) {
    const userId = localStorage.getItem('userId');
    const modal = document.getElementById('fans-subs-modal');
    const title = document.getElementById('fans-subs-title');
    const list = document.getElementById('fans-subs-list');

    modal.classList.remove('hidden');
    list.innerHTML = `<div class=\"text-center py-10\"><i class=\"fa-solid fa-spinner fa-spin text-2xl text-gray-300\"></i></div>`;

    if (type === 'fans') {
        title.innerText = '我的粉絲';
        try {
            const { data: fans, error } = await window.supabaseClient
                .from('subscriptions')
                .select('id, follower_id')
                .eq('creator_id', userId);

            if (error) throw error;
            if (fans.length === 0) { list.innerHTML = `<div class=\"text-center py-10 text-gray-400\">尚無粉絲</div>`; return; }

            const uids = fans.map(f => f.follower_id);
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', uids);
            const profMap = {}; profs.forEach(p => profMap[p.id] = p);

            list.innerHTML = fans.map(fan => {
                const user = profMap[fan.follower_id];
                if(!user) return '';
                return `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden font-bold text-gray-800 text-sm truncate">${user.display_name}</div>
                    <div class="text-gray-400 text-xs">粉絲</div>
                </div>`;
            }).join('');
        } catch(e) {
            list.innerHTML = `<div class="text-center py-10 text-red-400">讀取失敗</div>`;
        }
    } else {
        title.innerText = '已關注創作者';
        try {
            const { data: subs, error } = await window.supabaseClient
                .from('subscriptions')
                .select('id, creator_id')
                .eq('follower_id', userId);

            if (error) throw error;
            if (subs.length === 0) { list.innerHTML = `<div class=\"text-center py-10 text-gray-400\">尚未關注任何人</div>`; return; }

            const uids = subs.map(s => s.creator_id);
            const { data: profs } = await window.supabaseClient.from('profiles').select('id, display_name, avatar_url').in('id', uids);
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
        } catch(e) {
            list.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">讀取失敗，請確認 RLS 權限。</div>`;
        }
    }
}

window.unfollowUserFromList = async function(subscriptionId, btn) {
    if (!confirm("確定要取消追蹤嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('subscriptions').delete().eq('id', subscriptionId);
        if (error) throw error;
        btn.parentElement.remove();
    } catch(e) {
        alert("操作失敗");
    }
}

window.closeFansSubsModal = function() {
    document.getElementById('fans-subs-modal').classList.add('hidden');
}
