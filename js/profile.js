// ==========================================
// js/profile.js - R2 儲存整合 + WebP 自動轉檔 + 頭像直覺手勢縮放平移 完整最終版
// ==========================================

if (typeof window.WORKER_URL === 'undefined') {
    window.WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";
}

// ✨ 全局狀態：手勢操作與圖片暫存
let currentAvatarImage = null; 
let avatarTransform = { zoom: 1, x: 0, y: 0 }; 
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let lastTouchDist = 0;
let isAvatarChanged = false; // 追蹤是否有修改，避免重複上傳

const AVATAR_CANVAS_SIZE = 600; // 頭像統一輸出解析度

window.escapeHTML = function(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m];
    });
};

async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

// 🚀 將圖片上傳至 R2，統一使用 .webp 命名
async function uploadToR2(base64Str, type = 'avatar') {
    try {
        const myId = await getAuthenticatedUserId();
        const res = await fetch(base64Str);
        const blob = await res.blob();
        
        const formData = new FormData();
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

// ------------------------------------------
// ✨ 頭像互動編輯系統 (Canvas + 滑鼠/觸控)
// ------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('avatar-editor-container');
    if (!canvasContainer) return;

    // 滑鼠拖曳 (Pan)
    canvasContainer.addEventListener('mousedown', e => { 
        isDragging = true; 
        lastMousePos = { x: e.clientX, y: e.clientY }; 
    });
    
    window.addEventListener('mousemove', e => {
        if (!isDragging || !currentAvatarImage) return;
        avatarTransform.x += (e.clientX - lastMousePos.x);
        avatarTransform.y += (e.clientY - lastMousePos.y);
        lastMousePos = { x: e.clientX, y: e.clientY };
        isAvatarChanged = true;
        window.drawAvatarCanvas();
    });
    window.addEventListener('mouseup', () => isDragging = false);

    // 滾輪縮放 (Zoom)
    canvasContainer.addEventListener('wheel', e => {
        if (!currentAvatarImage) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05; // 每次滾動縮放 5%
        avatarTransform.zoom = Math.min(Math.max(avatarTransform.zoom * delta, 0.5), 5); // 限制 0.5倍 ~ 5倍
        isAvatarChanged = true;
        window.drawAvatarCanvas();
    }, { passive: false });

    // 觸控拖曳與捏合縮放 (Touch Pan & Pinch)
    canvasContainer.addEventListener('touchstart', e => {
        isDragging = true;
        if (e.touches.length === 1) {
            lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    });

    canvasContainer.addEventListener('touchmove', e => {
        if (!isDragging || !currentAvatarImage) return;
        e.preventDefault(); // 防止手機畫面跟著滑動
        if (e.touches.length === 1) {
            avatarTransform.x += (e.touches[0].clientX - lastMousePos.x);
            avatarTransform.y += (e.touches[0].clientY - lastMousePos.y);
            lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            isAvatarChanged = true;
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const delta = dist / lastTouchDist;
            avatarTransform.zoom = Math.min(Math.max(avatarTransform.zoom * delta, 0.5), 5);
            lastTouchDist = dist;
            isAvatarChanged = true;
        }
        window.drawAvatarCanvas();
    }, { passive: false });

    canvasContainer.addEventListener('touchend', () => { 
        isDragging = false; 
        lastTouchDist = 0; 
    });
});

// 處理使用者選擇新頭像
window.handleAvatarFileSelect = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                currentAvatarImage = img;
                isAvatarChanged = true;
                window.resetAvatarTransform();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

// 重置位置與縮放
window.resetAvatarTransform = function() {
    if (!currentAvatarImage) return;
    avatarTransform = { zoom: 1, x: 0, y: 0 };
    window.drawAvatarCanvas();
};

// 實際繪製畫布邏輯
window.drawAvatarCanvas = function() {
    const canvas = document.getElementById('avatar-canvas');
    if (!canvas || !currentAvatarImage) return;

    canvas.width = AVATAR_CANVAS_SIZE;
    canvas.height = AVATAR_CANVAS_SIZE;
    const ctx = canvas.getContext('2d');

    const imgW = currentAvatarImage.width;
    const imgH = currentAvatarImage.height;

    // Cover 模式計算
    const baseScale = Math.max(AVATAR_CANVAS_SIZE / imgW, AVATAR_CANVAS_SIZE / imgH);
    const finalScale = baseScale * avatarTransform.zoom;

    const drawW = imgW * finalScale;
    const drawH = imgH * finalScale;

    // 置中並加上使用者拖曳的偏移量
    const offsetX = (AVATAR_CANVAS_SIZE - drawW) / 2 + avatarTransform.x;
    const offsetY = (AVATAR_CANVAS_SIZE - drawH) / 2 + avatarTransform.y;

    ctx.clearRect(0, 0, AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE);
    ctx.drawImage(currentAvatarImage, offsetX, offsetY, drawW, drawH);
};

// ------------------------------------------
// ✨ 背景圖專用預覽 (自動壓縮 WebP)
// ------------------------------------------
window.previewBannerImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1200;

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
                
                const displayImg = document.getElementById('edit-banner-preview');
                const placeholder = document.getElementById('banner-placeholder');
                
                if (displayImg) {
                    displayImg.src = canvas.toDataURL('image/webp', 0.8);
                    displayImg.classList.remove('hidden');
                }
                if (placeholder) {
                    placeholder.classList.add('hidden');
                }
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
    } catch(e) { console.error("無法載入個人中心資料", e); }
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
    
    try {
        const updatePublic = window.supabaseClient.from('profiles').update({ gender: document.getElementById('pc-gender').value }).eq('id', myId);
        const updatePrivate = window.supabaseClient.from('user_private_data').upsert({
            id: myId,
            contact_email: document.getElementById('pc-email').value.trim(),
            birthday: document.getElementById('pc-birthday').value,
            updated_at: new Date()
        });

        await Promise.all([updatePublic, updatePrivate]);
        alert('個人中心資料已更新！');
        closePersonalCenter();
    } catch(e) { alert('更新失敗: ' + e.message); } 
    finally { btn.innerText = "儲存"; btn.disabled = false; }
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

        const profile = profileRes.data;
        const myPosts = postsRes.data || [];
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name)}&background=random`;
        
        const bannerUrl = (profile.banner_url && profile.banner_url.startsWith('http')) ? profile.banner_url : null;
        const bannerHtml = bannerUrl 
            ? `<img src="${bannerUrl}" class="w-full h-40 object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><div class="hidden w-full h-40 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>` 
            : `<div class="w-full h-40 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400"></div>`;

        let html = `
            <div class="bg-white pb-4 shadow-sm relative">
                ${bannerHtml}
                <div class="px-5 relative -mt-12">
                    <div class="flex justify-between items-end mb-3">
                        <img src="${avatarUrl}" class="w-24 h-24 rounded-full border-4 border-white object-cover bg-white shadow-sm" onerror="this.src='https://ui-avatars.com/api/?name=U'">
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

    } catch (err) { container.innerHTML = `<div class="p-10 text-center text-red-500 mt-20">讀取失敗。</div>`; }
}

window.openEditProfile = async function() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;

    try {
        const myId = await getAuthenticatedUserId();
        if (!myId) return alert('請先登入');

        const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', myId).single();

        document.getElementById('edit-display-name').value = profile.display_name || '';
        document.getElementById('edit-bio').value = profile.bio || '';
        
        // ✨ 頭像防破圖：加入 crossOrigin="anonymous" 允許跨域讀取，才能在 Canvas 上調整並轉存
        isAvatarChanged = false;
        if (profile.avatar_url && profile.avatar_url.startsWith('http')) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                currentAvatarImage = img;
                window.resetAvatarTransform();
                isAvatarChanged = false; // 載入時不視為更動
            };
            img.src = profile.avatar_url;
        } else {
            currentAvatarImage = null;
            const canvas = document.getElementById('avatar-canvas');
            if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // 處理背景預覽
        const bannerPreview = document.getElementById('edit-banner-preview');
        const placeholder = document.getElementById('banner-placeholder');
        if (profile.banner_url && profile.banner_url.startsWith('http')) {
            if(bannerPreview) { bannerPreview.src = profile.banner_url; bannerPreview.classList.remove('hidden'); }
            if(placeholder) placeholder.classList.add('hidden');
        } else {
            if(bannerPreview) { bannerPreview.src = ''; bannerPreview.classList.add('hidden'); }
            if(placeholder) placeholder.classList.remove('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (err) { alert("無法讀取個人資料"); }
};

window.closeEditProfile = function() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.saveProfileData = async function() {
    const btn = document.getElementById('save-profile-btn');
    const myId = await getAuthenticatedUserId();
    if (!myId) return alert('請登入');

    btn.innerText = "轉檔上傳中..."; btn.disabled = true;
    
    try {
        const updateData = {
            display_name: document.getElementById('edit-display-name').value.trim(),
            bio: document.getElementById('edit-bio').value.trim(),
        };

        // ✨ 效能優化：只在頭像被拖曳或更換時，才重新上傳 R2
        if (isAvatarChanged && currentAvatarImage) {
            const canvas = document.getElementById('avatar-canvas');
            const base64 = canvas.toDataURL('image/webp', 0.8);
            updateData.avatar_url = await uploadToR2(base64, 'avatar');
        }

        // 處理背景
        let bannerSrc = document.getElementById('edit-banner-preview').src;
        if (bannerSrc.startsWith('data:image')) {
            updateData.banner_url = await uploadToR2(bannerSrc, 'banner');
        } else if (bannerSrc && bannerSrc.startsWith('http')) {
            updateData.banner_url = bannerSrc;
        } else {
            updateData.banner_url = null;
        }

        const { error } = await window.supabaseClient.from('profiles').update(updateData).eq('id', myId);
        if (error) throw error;

        localStorage.setItem('myChatName', updateData.display_name);
        closeEditProfile();
        renderProfile();
    } catch (err) { alert("更新失敗：" + err.message); } 
    finally { btn.innerText = "儲存修改"; btn.disabled = false; }
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
