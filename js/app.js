// ==========================================
// js/app.js - 全域邏輯與「離手即關閉」的 Haptic Touch
// ==========================================

// ... (這上面保留你原本的 app.js 代碼：切換Tab、設定抽屜、通知抽屜、Modal控制、個人資料儲存 等) ...
// (因為長度關係，上面第 1~5 點的核心功能請照舊保留，我們專注在底部的 Haptic Touch 替換)

// ==========================================
// ✨ 全域分享功能 (Web Share API)
// ==========================================
window.handleShare = async function(postId, titleText) {
    const shareData = {
        title: 'SEXIFY 推薦',
        text: titleText || '快來看看這則貼文！',
        url: window.location.origin + '?post=' + postId
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareData.url);
            alert('連結已複製到剪貼簿！');
        }
    } catch (err) {
        console.log('分享取消或發生錯誤', err);
    }
};

// ==========================================
// ✨ 觸覺反饋與長按全螢幕預覽 (Haptic Touch - 離手即關閉)
// ==========================================
window.longPressTimer = null;
window.isLongPressActive = false;

window.startLongPress = function(e, postId, mediaUrl) {
    if (!mediaUrl) return; // 純文字不觸發預覽
    window.isLongPressActive = false;
    const card = e.currentTarget;
    card.style.transform = 'scale(0.96)'; // 點擊時微縮小

    window.longPressTimer = setTimeout(() => {
        window.isLongPressActive = true;
        if (navigator.vibrate) navigator.vibrate(50); // Haptic Touch 輕微震動
        window.showImagePreview(postId, mediaUrl);
    }, 400); // 按住 0.4 秒觸發大圖
};

window.cancelLongPress = function(e, postId) {
    clearTimeout(window.longPressTimer); // 取消計時
    const card = e.currentTarget;
    if (card) card.style.transform = 'scale(1)'; // 恢復卡片大小

    // 注意：如果是長按狀態，關閉的邏輯已經交由下方 Modal 自身的放開事件來處理了。
    // 這個 function 只是確保手指滑掉或放開時，卡片外觀能恢復正常。
};

// 動態注入全螢幕大圖 Modal (綁定手指放開事件)
window.showImagePreview = function(postId, mediaUrl) {
    let previewModal = document.getElementById('haptic-preview-modal');
    
    // 第一次觸發時動態建立 Modal
    if (!previewModal) {
        previewModal = document.createElement('div');
        previewModal.id = 'haptic-preview-modal';
        // 加入 touch-none 防止螢幕滾動，確保事件不被吃掉
        previewModal.className = 'fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md hidden flex flex-col items-center justify-center p-4 transition-opacity duration-300 opacity-0 touch-none';
        
        // 為了達到最原生的體驗，預覽畫面拿掉所有干擾按鈕，純看圖
        previewModal.innerHTML = `
            <img id="haptic-preview-img" src="" class="max-w-full max-h-[85vh] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain transform scale-95 transition-transform duration-300 pointer-events-none">
        `;
        document.body.appendChild(previewModal);

        // ✨ 關鍵邏輯：只要手指一離開螢幕或滑掉，強制觸發關閉！
        const closeHandler = (e) => {
            e.preventDefault();
            window.closeImagePreview();
        };
        previewModal.addEventListener('pointerup', closeHandler);
        previewModal.addEventListener('touchend', closeHandler);
        previewModal.addEventListener('pointercancel', closeHandler);
    }

    window.currentPreviewPostId = postId;
    const img = document.getElementById('haptic-preview-img');
    img.src = mediaUrl;

    previewModal.classList.remove('hidden');
    // 強制瀏覽器重繪，以啟動 CSS 動畫
    void previewModal.offsetWidth; 
    
    previewModal.classList.remove('opacity-0');
    img.classList.remove('scale-95');
    img.classList.add('scale-100');
};

window.closeImagePreview = function() {
    const previewModal = document.getElementById('haptic-preview-modal');
    if (previewModal && !previewModal.classList.contains('hidden')) {
        previewModal.classList.add('opacity-0');
        const img = document.getElementById('haptic-preview-img');
        img.classList.remove('scale-100');
        img.classList.add('scale-95');
        
        setTimeout(() => {
            previewModal.classList.add('hidden');
            img.src = '';
        }, 300); // 等待淡出動畫結束
    }
};
