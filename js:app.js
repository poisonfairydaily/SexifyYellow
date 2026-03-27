// 年齡驗證邏輯
function verifyAge() {
    document.getElementById('age-gate').classList.add('opacity-0');
    setTimeout(() => { 
        document.getElementById('age-gate').style.display = 'none'; 
        document.getElementById('app-content').classList.remove('blur-2xl', 'pointer-events-none'); 
    }, 500);
}

// 底部 Tab 切換邏輯
function switchTab(tabId, btn) {
    // 1. 隱藏所有分頁內容，只顯示點擊的那一個
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // 2. 重置所有導航按鈕顏色為灰色
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.classList.remove('nav-active'); 
        b.classList.add('text-gray-400'); 
    });
    
    // 3. 將當前點擊的按鈕設為高亮（黑色）
    if(btn) { 
        btn.classList.add('nav-active'); 
        btn.classList.remove('text-gray-400'); 
    }
    
    // 4. 依據對應的模組觸發渲染 (避免重複加載)
    if(tabId === 'shop-tab' && typeof renderShop === 'function') renderShop();
    if(tabId === 'profile-tab' && typeof renderProfile === 'function') renderProfile();
    
    // ⭐ 消息模組在這裡塞入 ⭐
    if(tabId === 'messages-tab' && typeof renderMessages === 'function') {
        renderMessages();
    }
}