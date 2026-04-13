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
                
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                const displayImg = document.getElementById(imgId);
                displayImg.src = compressedBase64;
                displayImg.classList.remove('hidden');
            };
            img.src = event.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// 核心功能：將 Base64 圖片上傳至 Supabase Storage (media 儲存桶)
async function uploadBase64ToSupabase(base64Str, path) {
    try {
        const res = await fetch(base64Str);
        const blob = await res.blob();
        
        const { data, error } = await window.supabaseClient.storage
            .from('media')
            .upload(path, blob, { upsert: true, contentType: blob.type });
            
        if (error) throw error;
        
        const { data: publicData } = window.supabaseClient.storage
            .from('media')
            .getPublicUrl(path);
            
        return publicData.publicUrl;
    } catch (err) {
        console.error("上傳圖片至 Supabase 失敗:", err);
        throw err;
    }
}

// 1. 個人中心 
window.openPersonalCenter = async function() {
    toggleSettings(); 
    const modal = document.getElementById('personal-center-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);

    try {
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
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

window.savePersonalCenter = async function() {
    const btn = document.getElementById('save-personal-btn');
    btn.innerText = "處理中..."; btn.disabled = true;

    const newEmail = document.getElementById('pc-email').value.trim();
    const newGender = document.getElementById('pc-gender').value;
    const newBirthday = document.getElementById('pc-birthday').value;
    
    try {
        const updates = { data: { birthday: newBirthday } };
        if (newEmail) updates.email = newEmail;
        const { error: authErr } = await window.supabaseClient.auth.updateUser(updates);
        if (authErr) throw authErr;

        const userId = localStorage.getItem('userId');
        const { error: profErr } = await window.supabaseClient.from('profiles').update({ gender: newGender }).eq('id', userId);
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
    const userId = localStorage.getItem('userId');
    if (!userId) { container.innerHTML = `<div class="p-10 text-center text-gray-400 mt-20">請先登入</div>`; return; }

    container.innerHTML = `<div class="p-10 text-center mt-20"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;

    try {
        const [profileRes, postsRes] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', userId).single(),
            window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        if (profileRes.error) throw profileRes.error;
        
        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=random`;
        
        const bannerUrl = profile.banner_url || '';

        document.getElementById('edit-display-name').value = profile.display_name || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        document.getElementById('edit-social-ig').value = profile.social_ig || '';
        document.getElementById('edit-social-x').value = profile.social_x || '';
        document.getElementById('edit-avatar-preview').src = avatarUrl;
        
        if (bannerUrl) {
            document.getElementById('edit-banner-preview').src = bannerUrl;
            document.getElementById('edit-banner-preview').classList.remove('hidden');
        } else {
            document.getElementById('edit-banner-preview').src = '';
            document.getElementById('edit-banner-preview').classList.add('hidden');
        }

        const bannerHtml = bannerUrl ? `<img src="${bannerUrl}" class="w-full h-40 object-cover">` : `<div class="w-full h-40 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>`;

        let html = `
            <div class="bg-white pb-4 shadow-sm relative">
                ${bannerHtml}
                <div class="px-5 relative -mt-12">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm">
                        <button onclick="openEditProfile()" data-i18n="edit_profile" class="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold active:scale-95 transition shadow-sm mb-2">
                            編輯資料
                        </button>
                    </div>
                    <div>
                        <h2 class="text-xl font-black text-gray-900">${profile.display_name || '未命名'}</h2>
                        <p class="text-xs text-sexify font-bold mt-0.5 mb-2">@${profile.username || 'unknown'}</p>
                        <p class="text-sm text-gray-600 whitespace-pre-line">${profile.bio || '尚未填寫簡介'}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-50 pt-2 min-h-[300px]"><div class="masonry-grid px-2">`;
        
        if (myPosts.length > 0) {
            html += myPosts.map(p => `
                <div class="masonry-item relative shadow-sm border border-gray-100 bg-white p-2 rounded-xl" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字內容</div>`}
                    <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed">${p.caption || ''}</p>
                </div>
            `).join('');
        } else {
            html += `<div class="col-span-2 text-center py-20 text-gray-400" data-i18n="no_content">尚無發佈貼文</div>`;
        }
        container.innerHTML = html + `</div></div>`;

    } catch (err) {
        container.innerHTML = `<div class="p-10 text-center text-red-500 mt-20">讀取失敗。提示：若發生欄位錯誤，請確保已在 Supabase 建立對應欄位。</div>`;
    }
}

// 核心修復：正確將頭像與 Banner 圖片上傳至 Supabase Storage
window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const userId = localStorage.getItem('userId');
    btn.innerText = "處理中..."; btn.disabled = true;
    
    try {
        let avatarSrc = document.getElementById('edit-avatar-preview').src;
        let bannerSrc = document.getElementById('edit-banner-preview').src;

        // 如果圖片是新選取的 (Base64 格式)，則上傳到 Supabase Storage
        if (avatarSrc.startsWith('data:image')) {
            avatarSrc = await uploadBase64ToSupabase(avatarSrc, `avatars/${userId}_${Date.now()}.jpg`);
        }
        if (bannerSrc.startsWith('data:image')) {
            bannerSrc = await uploadBase64ToSupabase(bannerSrc, `banners/${userId}_${Date.now()}.jpg`);
        }

        const updateData = {
            display_name: document.getElementById('edit-display-name').value.trim(),
            bio: document.getElementById('edit-bio').value.trim(),
            social_ig: document.getElementById('edit-social-ig').value.trim(),
            social_x: document.getElementById('edit-social-x').value.trim(),
            avatar_url: avatarSrc,
            banner_url: bannerSrc.includes('http') ? bannerSrc : null
        };

        const { error } = await window.supabaseClient.from('profiles').update(updateData).eq('id', userId);
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

// 3. 他人主頁控制與追蹤/訊息按鈕邏輯
window.viewOtherProfile = async function(userId) {
    if (userId === localStorage.getItem('userId')) return switchTab('profile-tab', document.querySelectorAll('.nav-btn')[3]);

    const modal = document.getElementById('other-profile-modal');
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
        document.getElementById('other-bio').innerText = user.bio || '這名創作者很神秘，尚未寫下簡介。';
        document.getElementById('other-avatar').src = avatar;

        document.getElementById('other-msg-btn').onclick = () => {
            closeOtherProfile();
            if(typeof openChat === 'function') openChat(userId, false, user.display_name, avatar);
        };

        const followBtn = document.getElementById('other-follow-btn');
        let subs = JSON.parse(localStorage.getItem('mySubscriptions')) || [];
        if (subs.find(s => s.id === userId)) {
            followBtn.innerText = "已追蹤";
            followBtn.classList.replace('bg-sexify', 'bg-gray-200');
            followBtn.classList.replace('text-white', 'text-gray-700');
        } else {
            followBtn.innerText = "追蹤";
            followBtn.classList.replace('bg-gray-200', 'bg-sexify');
            followBtn.classList.replace('text-gray-700', 'text-white');
            followBtn.onclick = () => {
                subs.push({ id: userId, name: user.display_name, avatar: avatar });
                localStorage.setItem('mySubscriptions', JSON.stringify(subs));
                followBtn.innerText = "已追蹤";
                followBtn.classList.replace('bg-sexify', 'bg-gray-200');
                followBtn.classList.replace('text-white', 'text-gray-700');
                alert(`成功追蹤 ${user.display_name}！`);
            };
        }

        const { data: posts } = await window.supabaseClient.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const grid = document.getElementById('other-posts-grid');
        if (!posts || posts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚無內容</div>`;
        } else {
            grid.innerHTML = posts.map(p => `
                <div class="masonry-item cursor-pointer bg-white p-2 border border-gray-100 rounded-xl" onclick="viewPost('${p.id}')">
                    ${p.media_url ? `<img src="${p.media_url}" class="w-full rounded-lg mb-2 object-cover">` : `<div class="p-4 text-center text-gray-400 bg-gray-50 rounded-lg mb-2 text-xs italic">純文字內容</div>`}
                    <p class="text-xs text-gray-800 line-clamp-2 leading-relaxed">${p.caption || ''}</p>
                </div>
            `).join('');
        }

    } catch (err) {
        console.error("讀取他人主頁失敗", err);
    }
}

window.closeOtherProfile = function() {
    const modal = document.getElementById('other-profile-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

// 4. 粉絲與訂閱用戶面板邏輯
window.openFansSubsModal = function() {
    toggleSettings(); 
    const modal = document.getElementById('fans-subs-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    switchFansTab('subs'); 
}

window.closeFansSubsModal = function() {
    const modal = document.getElementById('fans-subs-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
}

window.switchFansTab = function(tab) {
    const btnFans = document.getElementById('tab-fans');
    const btnSubs = document.getElementById('tab-subs');
    const list = document.getElementById('fans-subs-list');

    if (tab === 'fans') {
        btnFans.classList.replace('text-gray-400', 'text-sexify');
        btnFans.classList.replace('border-transparent', 'border-sexify');
        btnSubs.classList.replace('text-sexify', 'text-gray-400');
        btnSubs.classList.replace('border-sexify', 'border-transparent');
        list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">目前還沒有粉絲</div>`;
    } else {
        btnSubs.classList.replace('text-gray-400', 'text-sexify');
        btnSubs.classList.replace('border-transparent', 'border-sexify');
        btnFans.classList.replace('text-sexify', 'text-gray-400');
        btnFans.classList.replace('border-sexify', 'border-transparent');

        const subs = JSON.parse(localStorage.getItem('mySubscriptions')) || [];
        if (subs.length === 0) {
            list.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">尚未訂閱任何用戶</div>`;
        } else {
            list.innerHTML = subs.map(user => `
                <div class="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); viewOtherProfile('${user.id}')">
                    <img src="${user.avatar}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1 overflow-hidden">
                        <div class="font-bold text-gray-800 text-sm truncate">${user.name}</div>
                    </div>
                    <button onclick="event.stopPropagation(); unfollowUser('${user.id}', this)" class="bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full font-bold active:scale-90 transition">取消追蹤</button>
                </div>
            `).join('');
        }
    }
}

window.unfollowUser = function(userId, btn) {
    if (!confirm("確定要取消追蹤此用戶嗎？")) return;
    let subs = JSON.parse(localStorage.getItem('mySubscriptions')) || [];
    subs = subs.filter(s => s.id !== userId);
    localStorage.setItem('mySubscriptions', JSON.stringify(subs));
    
    btn.parentElement.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        btn.parentElement.remove();
        if (subs.length === 0) {
            document.getElementById('fans-subs-list').innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">尚未訂閱任何用戶</div>`;
        }
    }, 200);
}
