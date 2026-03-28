// js/profile.js
let currentUser = {
    name: 'Chloe_Kim 🇺🇸🇰🇷',
    bio: '喜歡流汗的感覺 💦 健身房是我的第二個家。\n這裡是我的私密視角，訂閱解鎖更多訓練後的浴室自拍 🛁✨',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80',
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
};

// 全域訂閱清單狀態管理
window.mySubscriptions = [];

const sportsGallery = [
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=400&q=80',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
    'https://images.unsplash.com/photo-1508215885820-4585e5610924?w=400&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80',
    'https://images.unsplash.com/photo-1526506190301-324707698501?w=400&q=80',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80',
    'https://images.unsplash.com/photo-1507398941214-572c25f4b1dc?w=400&q=80',
    'https://images.unsplash.com/photo-1533681904393-9ab6efa9e466?w=400&q=80' 
];

function renderProfile() {
    updateProfileUI();
    const grid = document.getElementById('user-gallery');
    if(grid.innerHTML !== "") return; 
    grid.innerHTML = sportsGallery.map(img => `<div class="aspect-square bg-gray-100 overflow-hidden"><img src="${img}" class="w-full h-full object-cover hover:scale-110 transition duration-300"></div>`).join('');
}

function updateProfileUI() {
    document.getElementById('my-avatar').src = currentUser.avatar;
    document.getElementById('my-banner').src = currentUser.banner;
    document.getElementById('my-name').innerText = currentUser.name;
    document.getElementById('my-bio').innerText = currentUser.bio;
}

function openEditProfile() {
    document.getElementById('edit-name').value = currentUser.name;
    document.getElementById('edit-bio').value = currentUser.bio;
    document.getElementById('edit-avatar-url').value = currentUser.avatar;
    document.getElementById('edit-banner-url').value = currentUser.banner;
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('edit-profile-panel').classList.remove('translate-y-full'), 10);
}

function closeEditProfile() {
    document.getElementById('edit-profile-panel').classList.add('translate-y-full');
    setTimeout(() => document.getElementById('edit-profile-modal').classList.add('hidden'), 300);
}

function saveProfile() {
    currentUser.name = document.getElementById('edit-name').value || currentUser.name;
    currentUser.bio = document.getElementById('edit-bio').value || currentUser.bio;
    
    // 儲存頭像與橫幅
    const newAvatar = document.getElementById('edit-avatar-url').value.trim();
    if(newAvatar) currentUser.avatar = newAvatar;
    
    const newBanner = document.getElementById('edit-banner-url').value.trim();
    if(newBanner) currentUser.banner = newBanner;

    updateProfileUI();
    closeEditProfile();
}

function openOtherProfile(username, avatarUrl) {
    const modal = document.getElementById('other-profile-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('other-name').innerText = username;
    document.getElementById('other-avatar').src = avatarUrl;
    document.getElementById('other-banner').src = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800'; 
    document.getElementById('other-bio').innerText = `這是 ${username} 的專屬空間。訂閱我解鎖更多私密內容！`;
    
    // 初始化訂閱按鈕狀態
    const btnSub = document.getElementById('btn-subscribe');
    const isSubbed = window.mySubscriptions.includes(username);
    if(isSubbed) {
        btnSub.classList.replace('bg-sexify', 'bg-gray-200');
        btnSub.classList.replace('text-white', 'text-gray-800');
        btnSub.innerHTML = `<i class="fa-solid fa-check"></i> <span data-i18n="subscribed">${t('subscribed') || '已訂閱'}</span>`;
    } else {
        btnSub.classList.replace('bg-gray-200', 'bg-sexify');
        btnSub.classList.replace('text-gray-800', 'text-white');
        btnSub.innerHTML = `<i class="fa-solid fa-heart"></i> <span data-i18n="subscribe">${t('subscribe') || '訂閱'}</span>`;
    }

    const otherGrid = document.getElementById('other-gallery');
    otherGrid.innerHTML = sportsGallery.slice(0, 6).reverse().map(img => `<div class="aspect-square bg-gray-100 overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>`).join('');

    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
}

function closeOtherProfile() {
    document.getElementById('other-profile-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('other-profile-modal').classList.add('hidden'), 300);
}

// 切換訂閱狀態功能
function toggleSubscribe(btn) {
    const username = document.getElementById('other-name').innerText;
    const index = window.mySubscriptions.indexOf(username);
    
    if(index > -1) {
        // 取消訂閱
        window.mySubscriptions.splice(index, 1);
        btn.classList.replace('bg-gray-200', 'bg-sexify');
        btn.classList.replace('text-gray-800', 'text-white');
        btn.innerHTML = `<i class="fa-solid fa-heart"></i> <span data-i18n="subscribe">${t('subscribe') || '訂閱'}</span>`;
    } else {
        // 加入訂閱
        window.mySubscriptions.push(username);
        btn.classList.replace('bg-sexify', 'bg-gray-200');
        btn.classList.replace('text-white', 'text-gray-800');
        btn.innerHTML = `<i class="fa-solid fa-check"></i> <span data-i18n="subscribed">${t('subscribed') || '已訂閱'}</span>`;
    }
}

document.addEventListener('DOMContentLoaded', updateProfileUI);