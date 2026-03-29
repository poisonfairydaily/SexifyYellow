let currentUser = {
    name: 'Chloe_Kim 🇺🇸🇰🇷',
    bio: '喜歡流汗的感覺 💦 健身房是我的第二個家。\n這裡是我的私密視角，訂閱解鎖更多訓練後的浴室自拍 🛁✨',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80',
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
};

window.mySubscriptions = [];

// 動態模擬粉絲資料
const mockFans = [
    { name: '小雨點', avatar: 'https://i.pravatar.cc/100?u=fan1' },
    { name: 'David99', avatar: 'https://i.pravatar.cc/100?u=fan2' },
    { name: '阿Ken', avatar: 'https://i.pravatar.cc/100?u=fan3' }
];

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
            <img src="${post.src}" class="w-full h-full object-cover hover:scale-110 transition duration-300">
        </div>
    `).join('');
}

function updateProfileUI() {
    document.getElementById('my-avatar').src = currentUser.avatar;
    document.getElementById('my-banner').src = currentUser.banner;
    document.getElementById('my-name').innerText = currentUser.name;
    document.getElementById('my-bio').innerText = currentUser.bio;
}

function openMyPost(id) {
    const post = userPosts.find(p => p.id === id);
    if (!post) return;

    if (typeof openDetail === 'function') {
        openDetail(post.src, post.user, post.avatar, post.title, post.likes, post.id, post.isPaid, post.price, post.type);
    }
}

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

function endPreview() { cancelPreview(); }
function cancelPreview() {
    clearTimeout(previewTimer);
    if (isPreviewing) { hidePreview(); isPreviewing = false; }
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

        previewEl.innerHTML = `<img src="${src}" style="max-width:90%; max-height:80%; border-radius:16px; transform:scale(0.95); transition:0.2s;">`;
        document.body.appendChild(previewEl);
    } else {
        previewEl.querySelector('img').src = src;
        previewEl.style.display = 'flex';
    }
}

function hidePreview() { if (previewEl) previewEl.style.display = 'none'; }

document.addEventListener('touchmove', cancelPreview);
document.addEventListener('touchend', cancelPreview);
document.addEventListener('touchcancel', cancelPreview);
document.addEventListener('mouseup', cancelPreview);
document.addEventListener('mouseleave', cancelPreview);
document.addEventListener('scroll', cancelPreview);

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

// 粉絲與訂閱用戶渲染
function renderSubsList() {
    const container = document.getElementById('subs-list');
    if(!container) return;
    if(window.mySubscriptions.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400">目前沒有訂閱任何人</p>`;
    } else {
        container.innerHTML = window.mySubscriptions.map(subName => `
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); setTimeout(()=>openOtherProfile('${subName}', 'https://i.pravatar.cc/150?u=${subName}'), 300)">
                <img src="https://i.pravatar.cc/150?u=${subName}" class="w-10 h-10 rounded-full object-cover">
                <span class="font-bold text-sm text-gray-800 flex-1">${subName}</span>
                <i class="fa-solid fa-chevron-right text-gray-300"></i>
            </div>
        `).join('');
    }
}

function renderFansList() {
    const container = document.getElementById('fans-list');
    if (!container) return;
    container.innerHTML = mockFans.map(fan => `
        <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); setTimeout(()=>openOtherProfile('${fan.name}', '${fan.avatar}'), 300)">
            <img src="${fan.avatar}" class="w-10 h-10 rounded-full object-cover">
            <span class="font-bold text-sm text-gray-800 flex-1">${fan.name}</span>
            <i class="fa-solid fa-chevron-right text-gray-300"></i>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    renderProfile();
});