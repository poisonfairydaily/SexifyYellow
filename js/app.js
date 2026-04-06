function verifyAge() {
    document.getElementById('age-gate').classList.add('opacity-0');
    setTimeout(() => { 
        document.getElementById('age-gate').style.display = 'none'; 
        document.getElementById('app-content').classList.remove('blur-2xl', 'pointer-events-none'); 
    }, 500);
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active'); 
        b.classList.add('text-gray-400'); 
    });
    
    if(btn) { 
        btn.classList.add('nav-active'); 
        btn.classList.remove('text-gray-400'); 
    }
    
    if(tabId === 'shop-tab' && typeof renderShop === 'function') renderShop();
    if(tabId === 'profile-tab' && typeof renderProfile === 'function') renderProfile();
    if(tabId === 'messages-tab' && typeof renderMessages === 'function') renderMessages();
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const panel = document.getElementById('settings-panel');
    
    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('-translate-x-full'), 10);
    } else {
        panel.classList.add('-translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

// 初始化所有 UI 交互事件
function initUIEvents() {
    // 綁定登出按鈕事件
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("確定要登出帳號嗎？")) {
                if (typeof logoutUser === 'function') {
                    logoutUser();
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initUIEvents();
});

// 其他導航功能
function openNotifications() { toggleSettings(); /* 邏輯... */ }
function openPersonalCenter() { toggleSettings(); /* 邏輯... */ }
function openFansSubsModal() {
    toggleSettings();
    if(typeof renderSubsList === 'function') renderSubsList();
    if(typeof renderFansList === 'function') renderFansList();
}
