// ==========================================
// js/messages.js - 安全強化版 (防禦身分偽造漏洞)
// ==========================================

window.activeRoomId = null;
window.activeChatTarget = null;
window.roomChannel = null;     

let selectedMediaFile = null; 
let mediaRecorder = null;
let audioChunks = [];
window.isRecording = false;

// 🚨 漏洞修復：不再在全域初始化時僅依賴 localStorage
async function getAuthenticatedUserId() {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) {
        console.error("無法取得驗證用戶:", error);
        return null;
    }
    return user.id;
}

function generateRoomId(id1, id2) { 
    if (!id1 || !id2) return null;
    return [id1, id2].sort().join('_'); 
}

// ------------------------------------------
// 1. 發送訊息 (由原本的 sendMessage 修改)
// ------------------------------------------
async function sendMessage(content, mediaUrl) {
    // 🚨 安全修復：動態獲取經過 Supabase 驗證的 UID
    const myRealUserId = await getAuthenticatedUserId();
    
    if (!myRealUserId) {
        alert('登入逾時或身分無效，請重新登入');
        return;
    }

    if (!window.activeRoomId || !window.activeChatTarget) {
        alert('無效的聊天對象');
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('messages')
            .insert([{
                room_id: window.activeRoomId,
                sender_name: myRealUserId, // 🚨 使用驗證過的 UID，不再被 localStorage 欺騙
                receiver: window.activeChatTarget,
                content: content || '',
                image_url: mediaUrl,
                is_read: false
            }]);

        if (error) throw error;
        
        if (typeof renderMessages === 'function') renderMessages();
    } catch (e) {
        console.error('發送失敗:', e);
        alert('發送失敗: ' + e.message);
    }
}

// ------------------------------------------
// 2. 渲染訊息列表 (由原本的 renderMessages 修改)
// ------------------------------------------
window.renderMessages = async function() {
    const container = document.getElementById('chat-list');
    if (!container) return;

    // 🚨 安全修復：取得真實 UID
    const myRealUserId = await getAuthenticatedUserId();
    if (!myRealUserId) return;

    container.innerHTML = `<div class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-gray-300"></i></div>`;

    try {
        const { data: msgData, error: msgError } = await window.supabaseClient
            .from('messages')
            .select('*')
            // 🚨 這裡也同步改用驗證後的 UID 查詢
            .or(`sender_name.eq.${myRealUserId},receiver.eq.${myRealUserId}`)
            .order('created_at', { ascending: false });

        if (msgError) throw msgError;

        const rooms = {};
        msgData.forEach(m => {
            if (!rooms[m.room_id]) rooms[m.room_id] = m;
        });

        const sortedRooms = Object.values(rooms);
        if (sortedRooms.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">目前沒有訊息</div>`;
            return;
        }

        const targetIds = [...new Set(sortedRooms.map(m => m.sender_name === myRealUserId ? m.receiver : m.sender_name))];
        
        const { data: profilesData } = await window.supabaseClient
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .in('id', targetIds);
            
        const profilesMap = {};
        if (profilesData) profilesData.forEach(p => profilesMap[p.id] = p);

        container.innerHTML = sortedRooms.map(m => {
            const targetId = m.sender_name === myRealUserId ? m.receiver : m.sender_name;
            const prof = profilesMap[targetId];
            
            const safeName = window.escapeHTML(prof?.display_name || '未知用戶');
            const avatar = prof?.avatar_url || 'https://ui-avatars.com/api/?name=' + safeName;
            const isUnread = !m.is_read && m.receiver === myRealUserId;

            return `
                <div class="flex items-center gap-3 p-4 border-b border-gray-50 active:bg-gray-50 transition cursor-pointer ${isUnread ? 'bg-red-50/30' : ''}" 
                     onclick="openChat('${targetId}', '${safeName}')">
                    <div class="relative">
                        <img src="${avatar}" class="w-14 h-14 rounded-full object-cover">
                        ${isUnread ? '<div class="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>' : ''}
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-800">${safeName}</span>
                            <span class="text-[10px] text-gray-400">${new Date(m.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="text-xs text-gray-400 truncate">${window.escapeHTML(m.content || (m.image_url ? '[媒體訊息]' : ''))}</div>
                    </div>
                </div>`;
        }).join('');

    } catch (e) {
        console.error('渲染訊息列表失敗:', e);
        container.innerHTML = `<div class="p-10 text-center text-red-400">載入失敗</div>`;
    }
};

// ------------------------------------------
// 3. 繪製對話內容 (由原本的 drawMessages 修改)
// ------------------------------------------
async function drawMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const myRealUserId = await getAuthenticatedUserId();

    if (!messages || messages.length === 0) {
        const nameEl = document.getElementById('chat-target-name');
        const name = nameEl ? nameEl.innerText : '對方';
        container.innerHTML = `<div class="p-10 text-center text-gray-300 text-sm">開始與 ${name} 聊天吧</div>`;
        return;
    }

    container.innerHTML = messages.map(m => {
        // 🚨 安全修復：比對時使用驗證後的 UID
        const isMine = m.sender_name === myRealUserId;
        const msgClass = isMine ? 'bg-sexify text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none';
        const wrapperClass = isMine ? 'justify-end' : 'justify-start';

        return `
            <div class="flex ${wrapperClass} mb-4">
                <div class="max-w-[80%] ${msgClass} px-4 py-2 rounded-2xl shadow-sm">
                    ${m.content ? `<div class="text-sm">${window.escapeHTML(m.content)}</div>` : ''}
                    ${m.image_url ? `<img src="${window.escapeHTML(m.image_url)}" class="rounded-lg mt-1 max-w-full">` : ''}
                    <div class="text-[9px] opacity-50 mt-1 text-right">
                        ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>`;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}
