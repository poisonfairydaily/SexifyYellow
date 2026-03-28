let currentUser = {
    name: 'Chloe_Kim 🇺🇸🇰🇷',
    bio: '喜歡流汗的感覺 💦 健身房是我的第二個家。\n這裡是我的私密視角，訂閱解鎖更多訓練後的浴室自拍 🛁✨',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80',
    banner: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
};

// 訂閱名單狀態
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
    // 重置檔案選取框
    document.getElementById('edit-avatar-file').value = '';
    document.getElementById('edit-banner-file').value = '';
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
    
    // 電腦版/手機原生選擇檔案轉為 Base64 顯示 (Avatar)
    const avatarFile = document.getElementById('edit-avatar-file').files[0];
    if (avatarFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.avatar = e.target.result;
            updateProfileUI();
        }
        reader.readAsDataURL(avatarFile);
    }

    // 電腦版/手機原生選擇檔案轉為 Base64 顯示 (Banner)
    const bannerFile = document.getElementById('edit-banner-file').files[0];
    if (bannerFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.banner = e.target.result;
            updateProfileUI();
        }
        reader.readAsDataURL(bannerFile);
    }

    if (!avatarFile && !bannerFile) {
        updateProfileUI();
    }
    
    closeEditProfile();
}

// === 他人專頁與訂閱邏輯 ===
function openOtherProfile(username, avatarUrl) {
    const modal = document.getElementById('other-profile-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('other-name').innerText = username;
    document.getElementById('other-avatar').src = avatarUrl;
    document.getElementById('other-banner').src = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800'; 
    document.getElementById('other-bio').innerText = `這是 ${username} 的專屬空間。訂閱我解鎖更多私密內容！`;
    
    const btnSub = document.getElementById('btn-subscribe');
    const isSubbed = window.mySubscriptions.some(sub => sub.name === username);
    if(isSubbed) {
        btnSub.classList.replace('bg-sexify', 'bg-gray-200');
        btnSub.classList.replace('text-white', 'text-gray-800');
        btnSub.innerHTML = `<i class="fa-solid fa-check"></i> <span>${t('subscribed') || '已訂閱'}</span>`;
    } else {
        btnSub.classList.replace('bg-gray-200', 'bg-sexify');
        btnSub.classList.replace('text-gray-800', 'text-white');
        btnSub.innerHTML = `<i class="fa-solid fa-heart"></i> <span>${t('subscribe') || '訂閱'}</span>`;
    }

    const otherGrid = document.getElementById('other-gallery');
    otherGrid.innerHTML = sportsGallery.slice(0, 6).reverse().map(img => `<div class="aspect-square bg-gray-100 overflow-hidden"><img src="${img}" class="w-full h-full object-cover"></div>`).join('');

    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
}

function closeOtherProfile() {
    document.getElementById('other-profile-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('other-profile-modal').classList.add('hidden'), 300);
}

function toggleSubscribe(btn) {
    const username = document.getElementById('other-name').innerText;
    const avatar = document.getElementById('other-avatar').src;
    const index = window.mySubscriptions.findIndex(s => s.name === username);
    
    if(index > -1) {
        window.mySubscriptions.splice(index, 1);
        btn.classList.replace('bg-gray-200', 'bg-sexify');
        btn.classList.replace('text-gray-800', 'text-white');
        btn.innerHTML = `<i class="fa-solid fa-heart"></i> <span>${t('subscribe') || '訂閱'}</span>`;
    } else {
        window.mySubscriptions.push({ name: username, avatar: avatar });
        btn.classList.replace('bg-sexify', 'bg-gray-200');
        btn.classList.replace('text-white', 'text-gray-800');
        btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>${t('subscribed') || '已訂閱'}</span>`;
    }
}

function renderSubsList() {
    const container = document.getElementById('subs-list');
    if(window.mySubscriptions.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400">目前沒有訂閱任何人</p>`;
        return;
    }
    container.innerHTML = window.mySubscriptions.map(sub => `
        <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm cursor-pointer active:scale-95 transition" onclick="closeFansSubsModal(); setTimeout(()=>openOtherProfile('${sub.name}', '${sub.avatar}'), 300)">
            <img src="${sub.avatar}" class="w-10 h-10 rounded-full object-cover">
            <span class="font-bold text-sm text-gray-800 flex-1">${sub.name}</span>
            <i class="fa-solid fa-chevron-right text-gray-300"></i>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', updateProfileUI);