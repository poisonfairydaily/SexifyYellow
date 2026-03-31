// ==========================================
// js/messages.js - 完整全替換式 (文字+圖片雙軌版)
// ==========================================

// 1. 全域變數與防衝突宣告
window.activeChatId = window.activeChatId || null;
window.realtimeChannel = window.realtimeChannel || null;
let selectedImageFile = null; // 儲存待發送的圖片檔案

// 模擬的對話對象列表 (保留介面用)
window.chatList = [
    { id: 'global-room-1', user: '🔥 Sexify 測試大廳', avatar: 'https://i.pravatar.cc/100?u=sexify-lobby', lastMsg: '點擊開始跨視窗連網測試...', time: '現在' }
];

// 初始化使用者暱稱
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("【首次測試】請輸入你的聊天暱稱：", "匿名朋友" + Math.floor(Math.random() * 1000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 2. 渲染左側訊息列表
function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = window.chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer" onclick="openChat('${chat.user}', '${chat.avatar}', '${chat.id}')">
            <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover flex-shrink-0">
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-0.5">
                    <h4 class="font-bold text-sm truncate text-gray-800">${chat.user}</h4>
                    <span class="text-[10px] text-gray-400 flex-shrink-0">${chat.time}</span>
                </div>
                <p class="text-xs text-gray-500 truncate leading-relaxed">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

// 3. 打開對話框的核心邏輯
async function openChat(username, avatarUrl, id) {
    window.activeChatId = id;
    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;
    
    // 顯示視窗
    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    // 初始化訊息區域
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400" id="chat-loading-status">連線中...</div>';

    if (!window.supabaseClient) {
        alert("資料庫尚未連線，請檢查 supabase-config.js");
        return;
    }

    // A. 抓取歷史訊息
    const { data, error } = await window.supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true }); // 由舊到新

    // 隱藏連線中狀態
    const statusEl = document.getElementById('chat-loading-status');
    if(statusEl) statusEl.remove();

    if (!error && data) {
        // 歷史訊息由舊到新放入 flex-col-reverse 的容器中，需要反轉陣列
        data.reverse().forEach(msg => { appendMessageToUI(msg, false); }); 
    }

    // B. 🔥 啟動即時監聽器
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
    }

    window.realtimeChannel = window.supabaseClient
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            console.log('收到新訊息!', payload.new);
            // 新訊息直接 prepend 到 flex-col-reverse 的最底部
            appendMessageToUI(payload.new, true); 
        })
        .subscribe();
}

// 4. 訊息氣泡生成邏輯 (升級：整合圖片渲染)
function appendMessageToUI(msg, isNewMessage) {
    const chatContainer = document.getElementById('chat-messages');
    const isMe = msg.sender_name === myChatName;
    
    // UI 樣式設定
    const alignClass = isMe ? "justify-end flex-row-reverse" : "justify-start";
    const bgClass = isMe ? "bg-sexify text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100";
    const avatar = isMe ? `https://i.pravatar.cc/100?u=me-${myChatName}` : `https://i.pravatar.cc/100?u=${msg.sender_name}`;
    const nameColor = isMe ? "text-pink-100" : "text-gray-400";

    // 處理圖片內容
    let mediaHtml = '';
    if (msg.image_url) {
        mediaHtml = `
            <div class="relative max-w-sm rounded-xl overflow-hidden mb-2 mt-1 shadow-inner image-loading" style="aspect-ratio: 16/9; min-width: 150px;">
                <img src="${msg.image_url}" class="w-full h-full object-cover opacity-0 transition-opacity duration-300" onload="this.parentElement.classList.remove('image-loading'); this.classList.remove('opacity-0');">
            </div>
        `;
    }

    // 處理純文字內容 (如果沒有圖片也沒有文字，就顯示內容為空)
    const textHtml = msg.content ? `<div>${msg.content}</div>` : (msg.image_url ? '' : '<div class="italic text-gray-300">內容已存入</div>');

    const msgHtml = `
        <div class="flex ${alignClass} gap-3 mb-2 animate-fade-in ${isMe ? 'ml-auto' : 'mr-auto'} max-w-[85%]">
            <img src="${avatar}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover shadow-sm">
            <div class="${bgClass} p-3 rounded-2xl text-sm shadow-sm leading-relaxed">
                <div class="text-[9px] ${nameColor} mb-1 font-bold">${isMe ? '我' : msg.sender_name}</div>
                ${mediaHtml}
                ${textHtml}
            </div>
        </div>
    `;

    // 插入畫面的核心邏輯
    if (isNewMessage) {
        // 新訊息利用 prepend 放到 flex-col-reverse 容器的最底部
        chatContainer.prepend(msgHtml);
    } else {
        // 歷史訊息使用 insertAdjacentHTML 依序放到最上方 (最底部)
        chatContainer.insertAdjacentHTML('beforeend', msgHtml);
    }
}

// ==========================================
// 🔥 圖片發送相關邏輯 (新增)
// ==========================================

// 1. 處理圖片選擇
function handleImageSelection(input) {
    const file = input.files[0];
    if (!file) return;

    // 檔案大小限制 (測試階段限制在 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("為了測試速度，請上傳小於 5MB 的圖片喔！");
        input.value = '';
        return;
    }

    selectedImageFile = file;
    const preview = document.getElementById('chat-image-preview');
    const container = document.getElementById('chat-image-preview-container');

    // 讀取檔案做預覽
    const reader = new FileReader();
    reader.onload = function(e) {
        preview.src = e.target.result;
        container.classList.remove('hidden'); // 顯示預覽
    }
    reader.readAsDataURL(file);
}

// 2. 取消圖片選擇
function cancelImageSelection() {
    selectedImageFile = null;
    document.getElementById('chat-image-input').value = '';
    document.getElementById('chat-image-preview-container').classList.add('hidden');
}

// 3. 處理「發送」按鈕的主邏輯
async function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    // 防呆：如果什麼都沒有
    if (!text && !selectedImageFile) return;

    // 顯示上傳進度
    const progress = document.getElementById('chat-upload-progress');
    if(selectedImageFile) progress.classList.remove('hidden').classList.add('flex');

    // 為了流暢，先隱藏預覽框和文字輸入
    cancelImageSelection(); // 此時會清空 selectedImageFile，我們要在這之前把檔案變數抓下來用
    const fileToUpload = selectedImageFile; 
    selectedImageFile = null; // 重設，防止重複發送
    input.value = ''; // 先清空文字框

    if (!window.supabaseClient) {
        alert("Supabase 資料庫連線失敗！");
        return;
    }

    try {
        let imageUrl = null;

        // A. 如果有選圖片，先將圖片上傳到 Storage
        if (fileToUpload) {
            // 建立一個獨一無二的文件名 (用戶暱稱_時間戳_原檔名)
            const cleanFileName = fileToUpload.name.replace(/[^\w.]/g, ''); // 只保留英數字與 .
            const storagePath = `public/${Date.now()}_${cleanFileName}`;

            // 上傳到你剛剛建立的 'message-images' bucket
            const { data: uploadData, error: uploadError } = await window.supabaseClient
                .storage
                .from('message-images')
                .upload(storagePath, fileToUpload);

            if (uploadError) {
                console.error("圖片上傳失敗:", uploadError.message);
                alert("圖片上傳失敗了，請檢查 Supabase Storage 的 RLS 權限或是桶名！");
                return; // 中斷發送
            }

            // 上傳成功，取得圖片的公開網址
            const { data: publicUrlData } = window.supabaseClient
                .storage
                .from('message-images')
                .getPublicUrl(storagePath);
            
            imageUrl = publicUrlData.publicUrl;
        }

        // B. 將資料 (文字+圖片URL) 寫入 messages 資料表
        const { error: dbError } = await window.supabaseClient
            .from('messages')
            .insert([{ 
                content: text, 
                sender_name: myChatName,
                image_url: imageUrl // 如果沒有圖片，就是 null
            }]);

        if (dbError) {
            console.error("文字發送失敗:", dbError.message);
            alert("發送失敗！圖片成功存入 Storage 但無法存入 Table。");
        }
        // 發送成功後，不需要手動畫畫面，由 Listener 監聽後處理。

    } catch (err) {
        console.error("unexpected_error:", err);
    } finally {
        // 隱藏上傳進度圈
        if(progress) progress.classList.add('hidden').classList.remove('flex');
    }
}

// ==========================================

// 關閉對話
function closeChat() {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
    
    // 斷開監聽，節省效能
    if (window.realtimeChannel) {
        window.supabaseClient.removeChannel(window.realtimeChannel);
        window.realtimeChannel = null;
    }
}

// 支援鍵盤按 Enter 發送文字
document.addEventListener('DOMContentLoaded', () => {
    renderMessages();
    setTimeout(() => {
        const chatInput = document.getElementById('chat-input');
        if(chatInput) {
            chatInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    handleSendAction();
                }
            });
        }
    }, 1000);
});