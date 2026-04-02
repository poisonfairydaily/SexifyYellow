// ==========================================
// js/messages.js - 終極功能版 (搜尋、回收、群組、時間)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.isGroup = false;        // 是否為群組模式
window.roomChannel = null;     
window.globalChannel = null;   
let selectedImageFile = null;
let currentChatMessages = [];  // 用於搜尋功能的快取

// 1. 初始化
let myChatName = localStorage.getItem('myChatName');
if (!myChatName) {
    let name = prompt("請輸入你的專屬帳號：", "User_" + Math.floor(Math.random() * 10000));
    localStorage.setItem('myChatName', name || "神秘使用者");
    myChatName = localStorage.getItem('myChatName');
}

// 2. 好友與群組管理 (保存在 LocalStorage 簡化流程)
function getFriends() { return JSON.parse(localStorage.getItem('myFriends')) || []; }
function getGroups() { return JSON.parse(localStorage.getItem('myGroups')) || []; }

window.addFriend = function() {
    const name = prompt("請輸入要新增的好友帳號：");
    if (name && name.trim() !== myChatName) {
        let f = getFriends();
        if(!f.includes(name.trim())) {
            f.push(name.trim());
            localStorage.setItem('myFriends', JSON.stringify(f));
            renderMessages();
        }
    }
};

window.createGroup = function() {
    const gName = prompt("請輸入群組名稱：");
    if (!gName) return;
    const members = (prompt("輸入成員帳號(用逗號隔開):") || "").split(',').map(m => m.trim()).filter(m => m);
    members.push(myChatName); // 自己也是成員
    const gId = 'GROUP_' + Date.now();
    let groups = getGroups();
    groups.push({ id: gId, name: gName, members: members });
    localStorage.setItem('myGroups', JSON.stringify(groups));
    renderMessages();
};

// 3. 渲染主清單 (收件匣 + 搜尋功能)
window.renderMessages = async function(searchFilter = "") {
    const container = document.getElementById('messages-list');
    if (!container) return;

    try {
        const { data, error } = await window.supabaseClient.from('messages')
            .select('*')
            .or(`sender_name.eq.${myChatName},receiver.eq.${myChatName},room_id.ilike.GROUP_%`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        let roomsMap = {};
        (data || []).forEach(msg => {
            const isG = msg.room_id.startsWith('GROUP_');
            let key = isG ? msg.room_id : (msg.sender_name === myChatName ? msg.receiver : msg.sender_name);
            
            // 如果是群組訊息，檢查我有沒有在成員名單內
            if (isG) {
                const groupInfo = getGroups().find(g => g.id === msg.room_id);
                if (groupInfo && !groupInfo.members.includes(myChatName)) return;
            }

            if (!roomsMap[key]) {
                const groupInfo = isG ? getGroups().find(g => g.id === key) : null;
                roomsMap[key] = {
                    id: key,
                    name: isG ? `👥 ${groupInfo?.name || '未知群組'}` : key,
                    isGroup: isG,
                    lastMsg: msg.content || (msg.image_url ? '🖼️ 圖片' : ''),
                    time: new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    ts: new Date(msg.created_at).getTime()
                };
            }
        });

        let list = Object.values(roomsMap);
        
        // 搜尋過濾
        if (searchFilter) {
            list = list.filter(item => item.name.includes(searchFilter) || item.lastMsg.includes(searchFilter));
        }

        container.innerHTML = `
            <div class="p-4"><input type="text" placeholder="搜尋聊天內容..." oninput="renderMessages(this.value)" class="w-full bg-gray-100 rounded-lg border-none text-sm py-2 px-3"></div>
        ` + list.map(item => `
            <div class="flex items-center gap-3 p-4 border-b border-gray-50 cursor-pointer" onclick="openChat('${item.id}', ${item.isGroup})">
                <img src="https://i.pravatar.cc/150?u=${item.id}" class="w-12 h-12 rounded-full">
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between"><span class="font-bold truncate">${item.name}</span><span class="text-[10px] text-gray-400">${item.time}</span></div>
                    <p class="text-xs text-gray-500 truncate">${item.lastMsg}</p>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
};

// 4. 你原本問的 drawMessages (現在加上了時間、回收、搜尋)
function drawMessages(messages = null, filter = "") {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const msgsToDraw = messages || currentChatMessages;
    
    if (msgsToDraw.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-300 py-10 w-full text-xs">尚無訊息</div>`;
        return;
    }

    container.innerHTML = msgsToDraw
        .filter(m => !filter || (m.content && m.content.includes(filter))) // 聊天室內搜尋
        .map(m => {
            const isMe = m.sender_name === myChatName;
            const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3">
                    ${window.isGroup && !isMe ? `<span class="text-[10px] text-gray-400 mb-1">${m.sender_name}</span>` : ''}
                    <div class="flex items-end gap-2 max-w-[80%]">
                        ${isMe ? `<span class="text-[9px] text-gray-300 mb-1">${time}</span>` : ''}
                        ${isMe ? `<button onclick="unsendMessage('${m.id}')" class="text-[10px] text-gray-300 hover:text-red-500 mb-1">回收</button>` : ''}
                        <div class="${isMe ? 'bg-black text-white rounded-tr-none' : 'bg-white border text-gray-800 rounded-tl-none'} px-3 py-2 rounded-2xl text-sm">
                            ${m.image_url ? `<img src="${m.image_url}" class="max-w-[200px] rounded-lg mb-1">` : ''}
                            ${m.content || ''}
                        </div>
                        ${!isMe ? `<span class="text-[9px] text-gray-300 mb-1">${time}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    
    if(!filter) container.scrollTop = container.scrollHeight;
}

// 5. 回收訊息功能
window.unsendMessage = async function(id) {
    if (!confirm("確定回收？")) return;
    const { error } = await window.supabaseClient.from('messages').delete().eq('id', id).eq('sender_name', myChatName);
    if (!error) openChat(window.activeChatTarget, window.isGroup);
};

// 6. 開啟聊天室 (支援搜尋框注入)
window.openChat = async function(targetId, isGroup = false) {
    window.activeChatTarget = targetId;
    window.isGroup = isGroup;
    window.activeRoomId = isGroup ? targetId : [myChatName, targetId].sort().join('_');

    const modal = document.getElementById('chat-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    // 注入聊天室內的搜尋框 (如果沒有的話)
    if (!document.getElementById('inner-search')) {
        const header = document.querySelector('#chat-modal header');
        header.insertAdjacentHTML('afterend', `<input id="inner-search" type="text" placeholder="搜尋此對話..." oninput="drawMessages(null, this.value)" class="w-full px-4 py-1 text-xs border-b border-gray-50 focus:ring-0">`);
    }

    try {
        const { data } = await window.supabaseClient.from('messages').select('*').eq('room_id', window.activeRoomId).order('created_at', { ascending: false });
        currentChatMessages = data || [];
        drawMessages(currentChatMessages);
        setupRoomRealtime();
    } catch (e) {}
};

// ...其餘發送邏輯與 Realtime 監聽邏輯與原版相似，需確保 room_id 對應正確...
