let currentChatRoomId = null;
let chatSubscription = null;
let currentRoomMessages = [];
let isUploadingImage = false;
let selectedImageFile = null;

// --- 1. Inbox (訊息列表) ---
async function renderMessages(searchQuery = '') {
    const listEl = document.getElementById('messages-list');
    if (!listEl) return;
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
        listEl.innerHTML = '<div class="p-8 text-center text-gray-400">請先登入</div>';
        return;
    }

    // 為了避免沒有 rooms 表時整個網頁崩潰，加上 try-catch 保護機制
    try {
        const { data: rooms, error } = await window.supabaseClient
            .from('rooms') 
            .select('*')
            .limit(20);
            
        if (error) throw error;
        
        // 如果有真實資料，這裡可以實作真實的 rooms 渲染迴圈
        // 目前先提供一個示範的入口，確保 UI 完整
        listEl.innerHTML = `
            <div class="p-4 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer" onclick="openChat('demo-room-1', '系統客服', 'https://ui-avatars.com/api/?name=Admin&background=random')">
                <img src="https://ui-avatars.com/api/?name=Admin&background=random" class="w-12 h-12 rounded-full object-cover shadow-sm">
                <div class="flex-1 overflow-hidden">
                    <div class="flex justify-between items-center mb-1">
                        <h3 class="font-bold text-gray-800 text-sm">系統客服</h3>
                        <span class="text-[10px] text-gray-400">剛剛</span>
                    </div>
                    <p class="text-xs text-gray-500 truncate">歡迎來到 SEXIFY，有任何問題都可以在此詢問！</p>
                </div>
            </div>
        `;

    } catch(err) {
        console.log("找不到對應的聊天室資料表，使用預設 UI 展示。");
        listEl.innerHTML = `
            <div class="p-4 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer" onclick="openChat('demo-room-1', '系統管理員', 'https://ui-avatars.com/api/?name=Admin&background=random')">
                <img src="https://ui-avatars.com/api/?name=Admin&background=random" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1 overflow-hidden">
                    <div class="flex justify-between items-center mb-1">
                        <h3 class="font-bold text-gray-800 text-sm">系統管理員</h3>
                        <span class="text-[10px] text-gray-400">剛剛</span>
                    </div>
                    <p class="text-xs text-gray-500 truncate">您好，歡迎使用！</p>
                </div>
            </div>
        `;
    }
}

// --- 2. Chat Modal 控制 ---
function openChat(roomId, chatName, avatarUrl) {
    currentChatRoomId = roomId;
    document.getElementById('chat-name').innerText = chatName || '聊天室';
    document.getElementById('chat-avatar').src = avatarUrl || 'https://ui-avatars.com/api/?name=User';
    
    toggleModal('chat-modal', 'open');
    
    // 初始化狀態
    document.getElementById('chat-messages').innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400">載入中...</div>';
    currentRoomMessages = [];
    cancelImageSelection(); // 清除之前的圖片選擇
    
    loadChatMessages(roomId);
    subscribeToRoom(roomId);
}

function closeChat() {
    toggleModal('chat-modal', 'close');
    currentChatRoomId = null;
    if (chatSubscription) {
        window.supabaseClient.removeChannel(chatSubscription);
        chatSubscription = null;
    }
}

// --- 3. 核心：讀取與渲染訊息 ---
async function loadChatMessages(roomId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false }) // 必須是 false，讓最新訊息在陣列前方，配合 flex-col-reverse
            .limit(50);

        if (error) throw error;
        
        currentRoomMessages = data || [];
        renderChatUI();
    } catch (err) {
        console.error('Load messages error:', err);
        currentRoomMessages = [];
        renderChatUI();
    }
}

function renderChatUI(keyword = '') {
    const container = document.getElementById('chat-messages');
    const userId = localStorage.getItem('userId');
    
    // 【修復核心 1】徹底清空容器！這保證了舊訊息不會疊加，也不會出現重複的對話框
    container.innerHTML = '';
    
    if (currentRoomMessages.length === 0) {
        container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-xs text-gray-400">尚無訊息，打個招呼吧！</div>';
        return;
    }

    let filteredMessages = currentRoomMessages;
    if (keyword) {
        filteredMessages = currentRoomMessages.filter(m => m.content && m.content.includes(keyword));
    }

    // 因為 container 是 flex-col-reverse，依序 append 時，最新的會貼在畫面最底部
    filteredMessages.forEach(msg => {
        const isMe = msg.sender_id === userId;
        const msgEl = document.createElement('div');
        msgEl.className = `flex ${isMe ? 'justify-end' : 'justify-start'} w-full mb-4`;
        
        let contentHtml = '';
        
        if (msg.is_recalled) {
            // 已收回狀態
            contentHtml = `<div class="bg-gray-100 border border-gray-200 text-gray-400 text-xs px-4 py-2 rounded-full italic shadow-sm">此訊息已收回</div>`;
        } else {
            // 正常顯示狀態
            let mediaHtml = msg.image_url ? `<img src="${msg.image_url}" class="rounded-xl max-w-[200px] mb-2 cursor-pointer border border-gray-100 shadow-sm" onclick="window.open('${msg.image_url}')">` : '';
            let textHtml = msg.content ? `<p class="text-sm whitespace-pre-wrap leading-relaxed">${msg.content}</p>` : '';
            let recallBtnHtml = isMe ? `<button onclick="recallMessage('${msg.id}')" class="text-[10px] text-gray-400 mt-1 hover:text-sexify transition ml-auto block active:scale-95">收回</button>` : '';
            
            contentHtml = `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]">
                    <div class="${isMe ? 'bg-sexify text-white' : 'bg-white border border-gray-100 text-gray-800'} px-4 py-2.5 rounded-2xl shadow-sm">
                        ${mediaHtml}
                        ${textHtml}
                    </div>
                    ${recallBtnHtml}
                </div>
            `;
        }
        
        msgEl.innerHTML = contentHtml;
        container.appendChild(msgEl);
    });
}

// --- 4. 核心：發送訊息 ---
async function handleSendAction() {
    if (!currentChatRoomId) return;
    
    const inputEl = document.getElementById('chat-input');
    const text = inputEl.value.trim();
    const userId = localStorage.getItem('userId');
    
    if (!text && !selectedImageFile) return;
    if (!userId) return alert('請先登入！');

    // 【修復核心 2】發送前先鎖定 UI。不使用假的 innerHTML="發送中" 來污染畫面，改為按鈕狀態提示
    const sendBtn = inputEl.nextElementSibling;
    const originalBtnText = sendBtn.innerText;
    
    inputEl.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerText = '發送中...';

    try {
        let imageUrl = null;
        if (selectedImageFile) {
            imageUrl = await uploadChatImage(selectedImageFile);
        }

        const { error } = await window.supabaseClient.from('messages').insert({
            room_id: currentChatRoomId,
            sender_id: userId,
            content: text,
            image_url: imageUrl,
            is_recalled: false
        });

        if (error) throw error;
        
        // 發送成功後：清空輸入框與圖片
        inputEl.value = '';
        cancelImageSelection();
        
        // 【修復核心 3】資料庫寫入成功後，強制重新讀取一次最新資料並清空重繪，徹底杜絕卡住的可能
        await loadChatMessages(currentChatRoomId);
        
    } catch (err) {
        console.error('Send message error:', err);
        alert('發送失敗，請稍後再試。');
    } finally {
        // 解除 UI 鎖定
        inputEl.disabled = false;
        sendBtn.disabled = false;
        sendBtn.innerText = originalBtnText;
        inputEl.focus();
    }
}

// --- 5. 核心：收回訊息 ---
async function recallMessage(msgId) {
    if (!confirm('確定要收回這則訊息嗎？')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .update({ is_recalled: true, content: '', image_url: null })
            .eq('id', msgId);
            
        if (error) throw error;
        
        // 【修復核心 4】收回成功後，重新拉取確保畫面更新。因為 renderChatUI 會先清空畫面，所以舊訊息絕對不會再彈出來。
        await loadChatMessages(currentChatRoomId);
    } catch (err) {
        console.error('Recall error:', err);
        alert('收回失敗，可能網路異常或該訊息已不存在。');
    }
}

// --- 6. Realtime 訂閱 ---
function subscribeToRoom(roomId) {
    // 預防重複訂閱
    if (chatSubscription) {
        window.supabaseClient.removeChannel(chatSubscription);
    }

    chatSubscription = window.supabaseClient
        .channel(`room:${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, payload => {
            // 只要偵測到該房間有任何變動（別人傳訊息、或別人收回），就直接重拉最新 50 筆重繪
            loadChatMessages(roomId);
        })
        .subscribe();
}

// --- 7. 圖片處理邏輯 ---
function handleImageSelection(input) {
    if (input.files && input.files[0]) {
        selectedImageFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('chat-image-preview').src = e.target.result;
            document.getElementById('chat-image-preview-container').classList.remove('hidden');
            document.getElementById('chat-image-preview-container').classList.add('flex');
        }
        reader.readAsDataURL(selectedImageFile);
    }
}

function cancelImageSelection() {
    selectedImageFile = null;
    const input = document.getElementById('chat-image-input');
    if(input) input.value = '';
    const container = document.getElementById('chat-image-preview-container');
    if(container) {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
    const img = document.getElementById('chat-image-preview');
    if(img) img.src = '';
}

async function uploadChatImage(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `chat_images/${fileName}`;
    
    const progressEl = document.getElementById('chat-upload-progress');
    if (progressEl) {
        progressEl.classList.remove('hidden');
        progressEl.classList.add('flex');
    }

    try {
        const { error: uploadError } = await window.supabaseClient.storage
            .from('media') // 確保 Supabase Storage 有建立 'media' 這個 Bucket
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = window.supabaseClient.storage
            .from('media')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Image upload failed:', error);
        throw error;
    } finally {
        if (progressEl) {
            progressEl.classList.add('hidden');
            progressEl.classList.remove('flex');
        }
    }
}

function filterRoomMessages(keyword) {
    renderChatUI(keyword);
}

// --- UI 觸發事件綁定 ---
function createGroup() { alert('即將開放建立群組功能！'); }
function addFriend() { alert('即將開放新增好友功能！'); }

// 初始化渲染 Inbox (等待 auth.js 廣播)
window.addEventListener('authReady', () => {
    renderMessages();
});
