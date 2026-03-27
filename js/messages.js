// js/profile.js
// 歐美系白人混血風格、愛韓妝、健身瑜珈服、鏡子自拍設定
let currentUser = {
    name: 'Chloe_Kim 🇺🇸🇰🇷',
    bio: '喜歡流汗的感覺 💦 健身房是我的第二個家。\n這裡是我的私密視角，訂閱解鎖更多訓練後的浴室自拍 🛁✨',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80', // 歐美系質感大頭貼
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80' // 健身房全景橫幅
};

// 精選 9 張：歐美白人、瑜珈服、Bra Top、鏡子自拍、健身房
const sportsGallery = [
    'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=400&q=80', // 健身自拍
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80', // 舉重房自拍
    'https://images.unsplash.com/photo-1508215885820-4585e5610924?w=400&q=80', // 瑜珈服
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80', // Bra top 訓練
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80', // 伸展
    'https://images.unsplash.com/photo-1526506190301-324707698501?w=400&q=80', // 健身房鏡子
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&q=80', // 瑜珈自拍
    'https://images.unsplash.com/photo-1507398941214-572c25f4b1dc?w=400&q=80', // 運動背心
    'https://images.unsplash.com/photo-1533681904393-9ab6efa9e466?w=400&q=80'  // 身材展示
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
    currentUser.banner = document.getElementById('edit-banner-url').value || currentUser.banner;
    updateProfileUI();
    closeEditProfile();
}

// === 開啟他人主頁邏輯 ===
function openOtherProfile(username, avatarUrl) {
    const modal = document.getElementById('other-profile-modal');
    modal.classList.remove('hidden');
    
    // 動態填入資料 (模擬)
    document.getElementById('other-name').innerText = username;
    document.getElementById('other-avatar').src = avatarUrl;
    document.getElementById('other-banner').src = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800'; // 預設漸層橫幅
    document.getElementById('other-bio').innerText = `這是 ${username} 的專屬空間。訂閱我解鎖更多私密內容！`;
    
    // 渲染假圖庫
    const otherGrid = document.getElementById('other-gallery');
    otherGrid.innerHTML = sportsGallery.slice(0, 6).reverse().map(img => `<div class="aspect-square bg-gray-100 overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>`).join('');

    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
}

function closeOtherProfile() {
    document.getElementById('other-profile-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('other-profile-modal').classList.add('hidden'), 300);
}

document.addEventListener('DOMContentLoaded', updateProfileUI);
