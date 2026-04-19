/**
 * creator.js - 商戶數據管理 + R2 上傳發佈整合版
 * 功能：雙軌收益統計、訂單管理、R2 媒體上傳、商戶聊天、實體/虛擬商品區分
 */

const PLATFORM_FEE_RATE = 0.2; // 平台抽成 20%
const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; // 你的 R2 Worker 網址
let selectedFile = null;

// ==========================================
// 1. 初始化與數據面板 (Dashboard)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadCreatorDashboard();
    initUploadControls(); // 初始化滑動關閉等控制
});

window.loadCreatorDashboard = async function() {
    const listEl = document.getElementById('sales-record-list');
    if (!listEl) return;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        // A. 抓取商戶商品與訪客數據
        const { data: myProducts } = await window.supabaseClient
            .from('products')
            .select('id, price, price_usd, category, views')
            .eq('user_id', user.id);

        if (!myProducts) return;

        const myProductIds = myProducts.map(p => p.id);
        const totalViews = myProducts.reduce((sum, p) => sum + (p.views || 0), 0);
        
        const statViews = document.getElementById('stat-views');
        if (statViews) statViews.innerText = totalViews;

        // B. 抓取訂單詳細數據 (包含買家資訊、地址、類別)
        if (myProductIds.length > 0) {
            const { data: orders, error } = await window.supabaseClient
                .from('orders')
                .select(`
                    id, amount, amount_usd, created_at, status, shipping_address, category,
                    products(name),
                    profiles:user_id(display_name, avatar_url)
                `)
                .in('product_id', myProductIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderCreatorStats(orders);
        } else {
            renderCreatorStats([]);
        }
    } catch (e) {
        console.error("Dashboard Load Error:", e);
    }
};

function renderCreatorStats(orders) {
    const listEl = document.getElementById('sales-record-list');
    const tokenRevEl = document.getElementById('stat-revenue-token');
    const cashRevEl = document.getElementById('stat-revenue-cash');
    const salesStat = document.getElementById('stat-sales');
    const pendingStat = document.getElementById('stat-pending');

    let tokenRev = 0, cashRev = 0, pendingCount = 0;

    if (!orders || orders.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">目前尚無成交記錄</div>`;
        if (salesStat) salesStat.innerText = '0';
        return;
    }

    listEl.innerHTML = orders.map(order => {
        const isPhysical = order.category === 'physical';
        // 分成後計算
        const netAmount = isPhysical 
            ? (order.amount_usd || 0) * (1 - PLATFORM_FEE_RATE)
            : (order.amount || 0) * (1 - PLATFORM_FEE_RATE);

        if (isPhysical) cashRev += netAmount; else tokenRev += netAmount;
        if (order.status === 'pending') pendingCount++;

        const buyer = order.profiles || { display_name: '匿名買家' };
        const statusText = order.status === 'pending' ? '待處理' : (order.status === 'shipped' ? '已發貨' : '已完成');
        const statusColor = order.status === 'pending' ? 'text-orange-500' : 'text-green-500';

        return `
            <div class="bg-gray-50 rounded-[1.5rem] p-4 border border-gray-100 mb-3 animate-fade-in">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${isPhysical ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}">
                        ${isPhysical ? '📦 實體商品' : '✨ 虛擬內容'}
                    </span>
                    <span class="text-[10px] font-black ${statusColor}">${statusText}</span>
                </div>
                <div class="flex items-center gap-3">
                    <img src="${buyer.avatar_url || 'https://ui-avatars.com/api/?name=B'}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-black text-gray-900 truncate">${window.escapeHTML(order.products?.name || '未知商品')}</p>
                        <p class="text-[10px] text-gray-400 font-bold">買家：${window.escapeHTML(buyer.display_name)}</p>
                    </div>
                    <div class="text-right flex items-center gap-3">
                        <div>
                            <p class="${isPhysical ? 'text-blue-600' : 'text-sexify'} font-black text-sm">${isPhysical ? '$' : '🪙'} ${netAmount.toFixed(1)}</p>
                            <p class="text-[8px] text-gray-400 font-bold">${new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <button onclick="window.contactBuyer('${order.user_id}', '${buyer.display_name}')" class="w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 active:scale-90 shadow-sm">
                            <i class="fa-solid fa-comment-dots text-xs"></i>
                        </button>
                    </div>
                </div>
                ${isPhysical && order.status === 'pending' ? `
                    <div class="mt-3 p-3 bg-white rounded-xl border border-dashed border-gray-200">
                        <p class="text-[9px] text-gray-400 font-black mb-1">📦 收貨地址：</p>
                        <p class="text-[10px] text-gray-700 leading-relaxed">${window.escapeHTML(order.shipping_address || '未提供地址')}</p>
                        <button onclick="window.markAsShipped('${order.id}')" class="w-full mt-3 py-2 bg-black text-white text-[10px] font-black rounded-lg active:scale-95 transition shadow-lg">標記為已發貨</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    if (salesStat) salesStat.innerText = orders.length;
    if (tokenRevEl) tokenRevEl.innerText = tokenRev.toFixed(1);
    if (cashRevEl) cashRevEl.innerText = cashRev.toFixed(1);
    if (pendingStat) pendingStat.innerText = pendingCount;
}

// ==========================================
// 2. 訂單與聊天互動
// ==========================================

window.markAsShipped = async function(orderId) {
    if (!confirm("確定已寄出商品並更新發貨狀態嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('orders').update({ status: 'shipped' }).eq('id', orderId);
        if (error) throw error;
        if (typeof showNotification === 'function') showNotification("🚩 發貨狀態已更新！");
        window.loadCreatorDashboard();
    } catch (e) {
        alert("更新失敗: " + e.message);
    }
};

window.contactBuyer = function(buyerId, buyerName) {
    if (typeof window.openChat === 'function') {
        window.openChat(buyerId, buyerName);
    } else {
        alert("買家：" + buyerName + "\n請前往訊息分頁進行溝通。");
    }
};

// ==========================================
// 3. R2 媒體發佈功能 (整合 create.js 邏輯)
// ==========================================

function initUploadControls() {
    const uploadPanel = document.getElementById('upload-panel');
    let startY = 0;
    if (uploadPanel) {
        uploadPanel.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        uploadPanel.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            if (currentY - startY > 80) window.closeUploadModal();
        }, { passive: true });
        
        const dragHandle = uploadPanel.querySelector('.w-12.h-1\\.5.bg-gray-200');
        if(dragHandle) dragHandle.addEventListener('click', window.closeUploadModal);
    }
}

window.openUploadModal = function() {
    const modal = document.getElementById('upload-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => document.getElementById('upload-panel').classList.remove('translate-y-full'), 10);
    }
};

window.closeUploadModal = function() {
    const panel = document.getElementById('upload-panel');
    if (panel) {
        panel.classList.add('translate-y-full');
        setTimeout(() => {
            document.getElementById('upload-modal').classList.add('hidden');
            resetUploadForm();
        }, 300);
    }
};

window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file; 
    
    const isVideo = file.type.startsWith('video/');
    const preview = isVideo ? document.getElementById('video-preview') : document.getElementById('media-preview');
    const other = isVideo ? document.getElementById('media-preview') : document.getElementById('video-preview');
    
    if (other) { other.classList.add('hidden'); other.src = ''; }
    const placeholder = document.getElementById('media-placeholder');
    if (placeholder) placeholder.classList.add('hidden');
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if (preview) {
            preview.src = event.target.result;
            preview.classList.remove('hidden');
        }
        const container = document.getElementById('media-preview-container');
        if (container) container.dataset.mediaType = isVideo ? 'video' : 'image';
    };
    reader.readAsDataURL(file);
};

function resetUploadForm() {
    selectedFile = null;
    ['post-price', 'post-caption', 'post-price-cash'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const viewPaidEl = document.getElementById('view-paid');
    if (viewPaidEl) viewPaidEl.checked = false;

    const mediaPreview = document.getElementById('media-preview');
    const videoPreview = document.getElementById('video-preview');
    const placeholder = document.getElementById('media-placeholder');
    if(mediaPreview) { mediaPreview.classList.add('hidden'); mediaPreview.src = ''; }
    if(videoPreview) { videoPreview.classList.add('hidden'); videoPreview.src = ''; }
    if(placeholder) placeholder.classList.remove('hidden');
}

async function uploadToR2(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(WORKER_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('媒體上傳失敗');
    const result = await response.json();
    return result.url;
}

window.publishPost = async function() {
    const publishBtn = document.querySelector('#upload-panel button.bg-sexify');
    if (!publishBtn) return;
    const originalBtnText = publishBtn.innerText;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert('請先登入！');

        const caption = document.getElementById('post-caption')?.value.trim() || '';
        const priceToken = parseInt(document.getElementById('post-price')?.value) || 0;
        const priceCash = parseFloat(document.getElementById('post-price-cash')?.value) || 0;
        const isPaid = document.getElementById('view-paid')?.checked || false;
        const isPhysical = priceCash > 0; // 如果填了現金價格，自動判斷為實體商品

        if (!selectedFile && !caption) return alert('請輸入內容或上傳檔案！');

        publishBtn.innerText = "媒體處理中...";
        publishBtn.disabled = true;

        let finalMediaUrl = '';
        if (selectedFile) finalMediaUrl = await uploadToR2(selectedFile);

        publishBtn.innerText = "同步數據中...";
        const safeCaption = typeof window.escapeHTML === 'function' ? window.escapeHTML(caption) : caption;

        const { error } = await window.supabaseClient.from('posts').insert([{
            user_id: user.id,
            caption: safeCaption,
            media_url: finalMediaUrl,
            is_paid: isPaid,
            price: priceToken,
            price_cash: priceCash,
            category: isPhysical ? 'physical' : 'virtual'
        }]);

        if (error) throw error;

        alert('✨ 商品發佈成功！');
        window.closeUploadModal();
        window.loadCreatorDashboard(); // 刷新後台數據
        if (typeof window.renderDiscovery === 'function') window.renderDiscovery();

    } catch (err) {
        alert('發佈失敗: ' + err.message);
    } finally {
        publishBtn.innerText = originalBtnText;
        publishBtn.disabled = false;
    }
};
