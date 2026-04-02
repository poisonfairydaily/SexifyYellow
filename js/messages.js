// 全域狀態管理
let currentChatUserId = null;
let currentChatType = 'private'; // 'private' 或是 'group'
let currentGroupId = null;
let allMessageThreads = []; // 用於快取原有列表，搜尋恢復時使用
let isComposingChinese = false; // 阻擋中文注音輸入期間的搜尋觸發

// 初始化載入
document.addEventListener('DOMContentLoaded', () => {
    loadMessageList();
    setupSearchListener();
});

// 1. 完美修復：搜尋列表與中文鍵盤衝突
function setupSearchListener() {
    const searchInput = document.getElementById('msg-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('compositionstart', () => {
        isComposingChinese = true;
    });

    searchInput.addEventListener('compositionend', (e) => {
        isComposingChinese = false;
        handleMessageSearch(e.target.value);
    });

    searchInput.addEventListener('input', (e) => {
        if (isComposingChinese) return; // 正在打中文時不執行過濾，防止鍵盤收起
        handleMessageSearch(e.target.value);
    });
}

function handleMessageSearch(keyword) {
    keyword = keyword.trim().toLowerCase();
    
    // 如果搜尋框為空，完美恢復原始列表
    if (!keyword) {
        renderMessagesList(allMessageThreads);
        return;
    }

    // 過濾搜尋結果
    const filtered = allMessageThreads.filter(thread => 
        thread.name.toLowerCase().includes(keyword) || 
        thread.lastMessage.toLowerCase().includes(keyword)
    );
    renderMessagesList(filtered);
}

// 模擬獲取訊息列表資料 (實際請替換為你的 Supabase fetch)
async function loadMessageList() {
    // 假設這是從 Supabase 拿到的所有對話
    allMessageThreads = [
        { id: 1, type: 'private', name: 'Alice', avatar: 'https://i.pravatar.cc/150?u=1', lastMessage: '今晚有空嗎？', unread: 2 },
        { id: 2, type: 'private', name: 'Bob', avatar: 'https://i.pravatar.cc/150?u=2', lastMessage: '影片看完了，超讚！', unread: 0 },
        { id: 'g1', type: 'group', name: 'VIP 粉絲福利群', avatar: 'https://i.pravatar.cc/150?u=99', lastMessage: '歡迎新成員加入！', unread: 5 }
    ];
    renderMessagesList(allMessageThreads);
}

function renderMessagesList(threads) {
    const container = document.getElementById('messages-list');
    container.innerHTML = '';

    if (threads.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-gray-400 text-sm">找不到相關訊息或用戶</div>`;
        return;
    }

    threads.forEach(thread => {
        const item = document.createElement('div');
        item.className = 'p-4 flex items-center gap-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer';
        item.onclick = () => openChat(thread.id, thread.name, thread.avatar, thread.type);
        
        const unreadBadge = thread.unread > 0 
            ? `<span class="bg-sexify text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">${thread.unread}</span>` 
            : '';

        item.innerHTML = `
            <div class="relative">
                <img src="${thread.avatar}" class="w-12 h-12 rounded-full object-cover shadow-sm">
                ${thread.type === 'group' ? `<div class="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5"><i class="fa-solid fa-users text-sexify text-xs"></i></div>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-1">
                    <h3 class="font-bold text-gray-900 truncate">${thread.name}</h3>
                    <span class="text-[10px] text-gray-400">10:42 AM</span>
                </div>
                <p class="text-sm text-gray-500 truncate">${thread.lastMessage}</p>
            </div>
            ${unreadBadge}
        `;
        container.appendChild(item);
    });
}

// 開啟聊天室
function openChat(id, name, avatar, type) {
    currentChatUserId = id;
    currentChatType = type;
    
    document.getElementById('chat-name').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    
    // 群組功能判斷：顯示或隱藏加人按鈕
    const addBtn = document.getElementById('add-to-group-btn');
    if (type === 'group') {
        currentGroupId = id;
        addBtn.classList.remove('hidden');
    } else {
        addBtn.classList.add('hidden');
    }

    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    loadChatHistory();
}

function closeChat() {
    const modal = document.getElementById('chat-modal');
    modal.classList.add('translate-x-full');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// 載入聊天紀錄
function loadChatHistory() {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = ''; // 清空
    
    // 模擬載入對話 (實際由 Supabase 載入)
    const mockMessages = [
        { id: 101, text: '嗨！', isMe: false },
        { id: 102, text: '很高興認識你', isMe: false },
        { id: 103, text: '我也是！這是我剛傳的影片', isMe: true }
    ];

    mockMessages.forEach(msg => appendMessageToDOM(msg.id, msg.text, msg.isMe));
}

// 將訊息推入 DOM，並綁定收回功能
function appendMessageToDOM(msgId, text, isMe) {
    const chatBox = document.getElementById('chat-messages');
    const msgEl = document.createElement('div');
    
    // 綁定 ID 以便後續即時收回
    msgEl.id = `msg-${msgId}`;
    msgEl.className = `flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 group relative`;

    // 收回按鈕 (僅自己的訊息會顯示)
    const revokeBtnHtml = isMe 
        ? `<button onclick="revokeMessage(${msgId})" class="absolute top-1/2 -translate-y-1/2 -left-8 text-red-400 opacity-0 group-hover:opacity-100 transition p-1"><i class="fa-solid fa-trash-can text-sm"></i></button>`
        : '';

    msgEl.innerHTML = `
        ${isMe ? revokeBtnHtml : ''}
        <div class="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-sexify text-white rounded-br-sm shadow-md shadow-sexify/20' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}">
            ${text}
        </div>
    `;
    
    // 因為 flex-col-reverse 所以用 prepend
    chatBox.prepend(msgEl);
}

// 2. 完美修復：即時收回訊息功能 (不需重整頁面)
async function revokeMessage(msgId) {
    if(!confirm('確定要收回這條訊息嗎？')) return;
    
    // TODO: 在這裡呼叫 Supabase 刪除指令
    // const { error } = await supabase.from('messages').delete().eq('id', msgId);
    // if(error) return alert('收回失敗');

    // 即時 DOM 移除 (核心修復點)
    const targetMsg = document.getElementById(`msg-${msgId}`);
    if (targetMsg) {
        targetMsg.style.transform = 'scale(0.9)';
        targetMsg.style.opacity = '0';
        targetMsg.style.transition = 'all 0.2s ease-out';
        setTimeout(() => {
            targetMsg.remove();
        }, 200); // 動畫結束後移除 DOM
    }
}

function handleSendAction() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // 模擬發送並獲得新 ID (請替換為 Supabase insert)
    const newMsgId = Date.now(); 
    appendMessageToDOM(newMsgId, text, true);
    input.value = '';
}

// 3. 新功能：群組加人彈窗邏輯
function openAddGroupMemberModal() {
    const modal = document.getElementById('add-member-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-y-full'), 10);
    
    renderAvailableUsersForGroup();
}

function closeAddGroupMemberModal() {
    const modal = document.getElementById('add-member-modal');
    modal.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function renderAvailableUsersForGroup() {
    const container = document.getElementById('add-member-list');
    container.innerHTML = '';
    
    // 模擬可以加入的用戶清單 (實際請從 Supabase 撈取排除已在群組內的用戶)
    const availableUsers = [
        { id: 3, name: 'Cindy', avatar: 'https://i.pravatar.cc/150?u=3' },
        { id: 4, name: 'David', avatar: 'https://i.pravatar.cc/150?u=4' }
    ];

    availableUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-xl';
        item.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="${user.avatar}" class="w-10 h-10 rounded-full object-cover">
                <span class="font-bold text-sm">${user.name}</span>
            </div>
            <button onclick="addUserToGroup(${user.id}, '${user.name}')" class="bg-sexify/10 text-sexify px-4 py-1.5 rounded-full text-xs font-bold active:scale-95 transition">加入</button>
        `;
        container.appendChild(item);
    });
}

async function addUserToGroup(userId, userName) {
    if(!confirm(`確定要將 ${userName} 加入群組嗎？`)) return;
    
    // TODO: Supabase Insert 至群組成員關聯表
    // await supabase.from('group_members').insert([{ group_id: currentGroupId, user_id: userId }]);
    
    alert(`${userName} 已成功加入群組！`);
    closeAddGroupMemberModal();
    
    // 模擬發送一條系統加入訊息
    appendMessageToDOM(Date.now(), `系統：已邀請 ${userName} 加入群組`, false);
}
