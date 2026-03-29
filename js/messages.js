window.chatList = [
    { id: 1, user: 'Mina_米娜', avatar: 'https://i.pravatar.cc/100?u=mina', lastMsg: '收到了嗎？那張照片...', time: '14:20', unread: 2 },
    { id: 2, user: '官方小助手', avatar: 'https://i.pravatar.cc/100?u=admin', lastMsg: '歡迎加入 Sexify，開啟你的專屬美好。', time: '昨天', unread: 0 },
    { id: 3, user: 'Xaiver_Fitness', avatar: 'https://i.pravatar.cc/100?u=xaiver', lastMsg: '下次一起出來喝一杯？', time: '週三', unread: 0 }
];

function renderMessages() {
    const container = document.getElementById('messages-list');
    if (!container) return;

    container.innerHTML = window.chatList.map(chat => `
        <div class="flex items-center gap-4 p-4 active:bg-gray-50 transition border-b border-gray-50 cursor-pointer" onclick="openChat('${chat.user}', '${chat.avatar}', ${chat.id})">
            <div class="relative flex-shrink-0">
                <img src="${chat.avatar}" class="w-12 h-12 rounded-full border border-gray-100 object-cover">
                ${chat.unread > 0 ? `
                    <span class="absolute -top-1 -right-1 bg-sexify text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white font-bold">
                        ${chat.unread}
                    </span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-0.5">
                    <h4 class="font-bold text-sm truncate text-gray-800">${chat.user}</h4>
                    <span class="text-[10px] text-gray-400 font-medium">${chat.time}</span>
                </div>
                <p class="text-xs text-gray-400 truncate leading-relaxed">${chat.lastMsg}</p>
            </div>
        </div>
    `).join('');
}

let activeChatId = null;

function openChatFromProfile() {
    const name = document.getElementById('other-name').innerText;
    const avatar = document.getElementById('other-avatar').src;
    openChat(name, avatar, null);
}

function openChat(username, avatarUrl, id) {
    activeChatId = id;
    document.getElementById('chat-name').innerText = username;
    document.getElementById('chat-avatar').src = avatarUrl;
    
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div class="text-center text-xs text-gray-400 my-4">今天</div>
        <div class="flex gap-2 max-w-[85%]">
            <img src="${avatarUrl}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover">
            <div class="bg-white p-3 rounded-2xl rounded-tl-sm text-sm text-gray-800 shadow-sm leading-relaxed">
                嗨！很高興認識你 🥰
            </div>
        </div>
    `;

    document.getElementById('chat-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('chat-modal').classList.remove('translate-x-full'), 10);
}

function closeChat() {
    document.getElementById('chat-modal').classList.add('translate-x-full');
    setTimeout(() => document.getElementById('chat-modal').classList.add('hidden'), 300);
    activeChatId = null;
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML += `
        <div class="flex gap-2 justify-end mt-4 max-w-[85%] self-end ml-auto flex-row-reverse">
            <img src="${currentUser.avatar}" class="w-8 h-8 rounded-full flex-shrink-0 object-cover">
            <div class="bg-sexify text-white p-3 rounded-2xl rounded-tr-sm text-sm shadow-sm leading-relaxed">
                ${text}
            </div>
        </div>
    `;

    if(activeChatId !== null) {
        const chatItem = window.chatList.find(c => c.id === activeChatId);
        if(chatItem) {
            chatItem.lastMsg = text;
            chatItem.time = '剛剛';
            chatItem.unread = 0; 
            renderMessages();
        }
    }

    input.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;
}