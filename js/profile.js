// ==========================
// 🔥 User Data
// ==========================
let currentUser = {
    name: 'Chloe_Kim 🇺🇸🇰🇷',
    bio: '喜歡流汗的感覺 💦 健身房是我的第二個家。\n這裡是我的私密視角，訂閱解鎖更多訓練後的浴室自拍 🛁✨',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80',
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
};

window.mySubscriptions = [];

// ==========================
// 🔥 原始圖片 → Post
// ==========================
const sportsGallery = [
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=400&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
    'https://images.unsplash.com/photo-1508215885820-4585e5610924?w=400&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80',
    'https://images.unsplash.com/photo-1526506190301-324707698501?w=400&q=80'
];

let userPosts = sportsGallery.map((img, i) => ({
    id: 'my-' + i,
    user: currentUser.name,
    avatar: currentUser.avatar,
    type: 'image',
    src: img,
    title: '我的貼文 ' + (i + 1),
    likes: Math.floor(Math.random() * 500),
    time: '剛剛',
    isPaid: false,
    price: 0
}));

// ==========================
// 🔥 Render Profile
// ==========================
function renderProfile() {
    updateProfileUI();

    const grid = document.getElementById('user-gallery');
    if (!grid) return;

    grid.innerHTML = userPosts.map(post => `
        <div class="aspect-square bg-gray-100 overflow-hidden relative"
            onmousedown="startPreview(event, '${post.src}')"
            onmouseup="endPreview()"
            onmouseleave="endPreview()"

            ontouchstart="startPreview(event, '${post.src}')"
            ontouchend="endPreview()"
            ontouchcancel="endPreview()"

            onclick="openMyPost('${post.id}')">

            <img src="${post.src}" 
                class="w-full h-full object-cover hover:scale-110 transition duration-300">
        </div>
    `).join('');
}

// ==========================
// 🔥 Profile UI
// ==========================
function updateProfileUI() {
    document.getElementById('my-avatar').src = currentUser.avatar;
    document.getElementById('my-banner').src = currentUser.banner;
    document.getElementById('my-name').innerText = currentUser.name;
    document.getElementById('my-bio').innerText = currentUser.bio;
}

// ==========================
// 🔥 打開貼文（Discovery UI）
// ==========================
function openMyPost(id) {
    const post = userPosts.find(p => p.id === id);
    if (!post) return;

    openDetail(
        post.src,
        post.user,
        post.avatar,
        post.title,
        post.likes,
        post.id,
        post.isPaid,
        post.price,
        post.type
    );

    // 🔥 加刪除
    setTimeout(() => {
        const detail = document.getElementById('post-detail');
        if (!detail) return;

        let delBtn = detail.querySelector('.delete-btn');
        if (!delBtn) {
            delBtn = document.createElement('button');
            delBtn.innerText = '刪除';
            delBtn.className = 'delete-btn text-red-500 text-xs ml-2';

            delBtn.onclick = () => {
                if (confirm('確定刪除？')) {
                    deletePost(id);
                    closeDetail();
                }
            };

            document.getElementById('detail-username').appendChild(delBtn);
        }
    }, 100);
}

// ==========================
// 🔥 刪除貼文
// ==========================
function deletePost(id) {
    const index = userPosts.findIndex(p => p.id === id);
    if (index > -1) {
        userPosts.splice(index, 1);
        renderProfile();
    }
}

// ==========================
// 🔥 Preview（完整穩定版）
// ==========================
let previewTimer;
let previewEl;
let isPreviewing = false;

function startPreview(e, src) {
    cancelPreview();

    previewTimer = setTimeout(() => {
        isPreviewing = true;
        showPreview(src);
    }, 400);
}

function endPreview() {
    cancelPreview();
}

function cancelPreview() {
    clearTimeout(previewTimer);

    if (isPreviewing) {
        hidePreview();
        isPreviewing = false;
    }
}

function showPreview(src) {
    if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.style.position = 'fixed';
        previewEl.style.inset = '0';
        previewEl.style.background = 'rgba(0,0,0,0.85)';
        previewEl.style.zIndex = '9999';
        previewEl.style.display = 'flex';
        previewEl.style.alignItems = 'center';
        previewEl.style.justifyContent = 'center';

        previewEl.innerHTML = `
            <img src="${src}" 
                style="max-width:90%; max-height:80%; border-radius:16px; transform:scale(0.95); transition:0.2s;">
        `;

        document.body.appendChild(previewEl);
    } else {
        previewEl.querySelector('img').src = src;
        previewEl.style.display = 'flex';
    }
}

function hidePreview() {
    if (previewEl) previewEl.style.display = 'none';
}

// ==========================
// 🔥 全局事件（解決卡住問題）
// ==========================
document.addEventListener('touchmove', cancelPreview);
document.addEventListener('touchend', cancelPreview);
document.addEventListener('touchcancel', cancelPreview);
document.addEventListener('mouseup', cancelPreview);
document.addEventListener('mouseleave', cancelPreview);
document.addEventListener('scroll', cancelPreview);

// ==========================
// 🔥 Edit Profile（保留）
// ==========================
function openEditProfile() {
    document.getElementById('edit-name').value = currentUser.name;
    document.getElementById('edit-bio').value = currentUser.bio;
    document.getElementById('edit-profile-modal').classList.remove('hidden');
}

function closeEditProfile() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

function saveProfile() {
    currentUser.name = document.getElementById('edit-name').value || currentUser.name;
    currentUser.bio = document.getElementById('edit-bio').value || currentUser.bio;
    updateProfileUI();
    closeEditProfile();
}

// ==========================
// 初始化
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    renderProfile();
});
