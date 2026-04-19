/**
 * creator.js - 專業電商後台整合版
 * 包含：分頁控制、雙軌收益統計、實體訂單發貨、R2 多圖上傳、商品資料庫對接
 */

const PLATFORM_FEE_RATE = 0.2; // 平台抽成 20%
const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; // R2 Worker
let selectedFiles = []; // 支援多圖

document.addEventListener('DOMContentLoaded', () => {
    window.switchCreatorTab('dashboard');
});

// ==========================================
// 0. 分頁控制
// ==========================================
window.switchCreatorTab = function(tabName) {
    // 按鈕 UI 切換
    ['dashboard', 'publish', 'inventory'].forEach(t => {
        document.getElementById(`btn-${t}`).classList.remove('active');
        document.getElementById(`tab-${t}`).classList.add('hidden');
    });
    
    document.getElementById(`btn-${tabName}`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    // 觸發對應資料載入
    if (tabName === 'dashboard') window.loadCreatorDashboard();
    if (tabName === 'inventory') window.loadMyProducts();
};

// ==========================================
// 1. 數據面板與訂單 (Dashboard)
// ==========================================
window.loadCreatorDashboard = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入");

        const { data: myProducts } = await window.supabaseClient.from('products').select('id, views').eq('user_id', user.id);
        const myProductIds = myProducts?.map(p => p.id) || [];
        
        document.getElementById('stat-views').innerText = myProducts?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;

        if (myProductIds.length > 0) {
            const { data: orders, error } = await window.supabaseClient
                .from('orders')
                .select(`id, amount, amount_usd, created_at, status, shipping_address, category, products(name), profiles:user_id(display_name, avatar_url)`)
                .in('product_id', myProductIds)
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderCreatorStats(orders);
        } else {
            renderCreatorStats([]);
        }
    } catch (e) { console.error("Dashboard Load Error:", e); }
};

function renderCreatorStats(orders) {
    const listEl = document.getElementById('sales-record-list');
    let tokenRev = 0, cashRev = 0, pendingCount = 0;

    if (!orders || orders.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">目前尚無成交記錄</div>`;
        document.getElementById('stat-sales').innerText = '0';
        return;
    }

    listEl.innerHTML = orders.map(order => {
        const isPhysical = order.category === 'physical';
        const netAmount = isPhysical ? (order.amount_usd || 0) * (1 - PLATFORM_FEE_RATE) : (order.amount || 0) * (1 - PLATFORM_FEE_RATE);
        
        if (isPhysical) cashRev += netAmount; else tokenRev += netAmount;
        if (order.status === 'pending') pendingCount++;

        const buyer = order.profiles || { display_name: '匿名買家' };
        const statusText = order.status === 'pending' ? '待處理' : (order.status === 'shipped' ? '已發貨' : '已完成');
        const statusColor = order.status === 'pending' ? 'text-orange-500' : 'text-green-500';

        return `
            <div class="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-3">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[9px] font-black px-2 py-0.5 rounded-full ${isPhysical ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}">${isPhysical ? '📦 實體快遞' : '✨ 虛擬解鎖'}</span>
                    <span class="text-[10px] font-black ${statusColor}">${statusText}</span>
                </div>
                <div class="flex items-center gap-3">
                    <img src="${buyer.avatar_url || 'https://ui-avatars.com/api/?name=B'}" class="w-10 h-10 rounded-full object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-black text-gray-900 truncate">${window.escapeHTML(order.products?.name)}</p>
                        <p class="text-[10px] text-gray-400 font-bold">買家: ${window.escapeHTML(buyer.display_name)}</p>
                    </div>
                    <div class="text-right">
                        <p class="${isPhysical ? 'text-blue-600' : 'text-sexify'} font-black text-sm">${isPhysical ? '$' : '🪙'} ${netAmount.toFixed(1)}</p>
                        <p class="text-[8px] text-gray-400 font-bold">${new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                ${isPhysical && order.status === 'pending' ? `
                    <div class="mt-3 p-3 bg-white rounded-xl border border-dashed border-gray-200">
                        <p class="text-[9px] text-gray-400 font-black mb-1">📦 收貨地址：</p>
                        <p class="text-[10px] text-gray-700 leading-relaxed">${window.escapeHTML(order.shipping_address || '未提供')}</p>
                        <button onclick="window.markAsShipped('${order.id}')" class="w-full mt-2 py-2 bg-black text-white text-[10px] font-black rounded-lg active:scale-95 transition">標記為已發貨</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('stat-sales').innerText = orders.length;
    document.getElementById('stat-revenue-token').innerText = tokenRev.toFixed(1);
    document.getElementById('stat-revenue-cash').innerText = cashRev.toFixed(1);
    document.getElementById('stat-pending').innerText = pendingCount;
}

window.markAsShipped = async function(orderId) {
    if (!confirm("確定已寄出商品嗎？這將通知買家。")) return;
    try {
        const { error } = await window.supabaseClient.from('orders').update({ status: 'shipped' }).eq('id', orderId);
        if (error) throw error;
        alert("發貨狀態已更新！");
        window.loadCreatorDashboard();
    } catch (e) { alert("更新失敗: " + e.message); }
};

// ==========================================
// 2. 動態表單與多圖上傳 (Publish)
// ==========================================
window.togglePriceInput = function() {
    const category = document.getElementById('p-category').value;
    const priceLabel = document.getElementById('price-label');
    const priceIcon = document.getElementById('price-icon');
    const priceInput = document.getElementById('p-price');

    if (category === 'physical') {
        priceLabel.innerText = "定價 (USD 美金)";
        priceLabel.className = "block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-2 ml-1";
        priceIcon.innerText = "＄";
        priceIcon.className = "absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600";
        priceInput.className = "w-full bg-gray-50 border border-gray-100 rounded-2xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none font-black";
    } else {
        priceLabel.innerText = "定價 (代幣)";
        priceLabel.className = "block text-[11px] font-black text-sexify uppercase tracking-widest mb-2 ml-1";
        priceIcon.innerText = "🪙";
        priceIcon.className = "absolute left-4 top-1/2 -translate-y-1/2 font-black text-sexify";
        priceInput.className = "w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-sexify outline-none font-black";
    }
    priceInput.value = '';
};

window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

window.handleProductFiles = function(input) {
    const container = document.getElementById('preview-container');
    container.innerHTML = '';
    selectedFiles = Array.from(input.files);

    if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'w-full aspect-square object-cover rounded-xl shadow-sm border border-gray-100';
                container.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    }
};

async function uploadToR2(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(WORKER_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('上傳失敗');
    return (await response.json()).url;
}

window.publishProduct = async function() {
    const btn = document.getElementById('upload-btn');
    const originalText = btn.innerText;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入");

        const name = document.getElementById('p-name').value.trim();
        const desc = document.getElementById('p-desc').value.trim();
        const category = document.getElementById('p-category').value;
        const priceVal = parseFloat(document.getElementById('p-price').value) || 0;

        if (!name || selectedFiles.length === 0) return alert("請輸入商品名稱並上傳至少一張圖片");
        if (priceVal <= 0) return alert("請設定有效的價格");

        btn.innerText = "圖片上傳中 (請勿關閉)...";
        btn.disabled = true;

        // 處理多圖上傳
        const uploadPromises = selectedFiles.map(file => uploadToR2(file));
        const urls = await Promise.all(uploadPromises);
        const imageUrlsString = urls.join(',');

        btn.innerText = "資料寫入中...";
        
        // 寫入 Shop 專用的 products 資料表
        const productData = {
            user_id: user.id,
            name: window.escapeHTML(name),
            description: window.escapeHTML(desc),
            category: category,
            image_url: imageUrlsString,
            status: 'approved', // 正式環境應設為 pending 待審核
            price: category === 'virtual' ? priceVal : 0,
            price_usd: category === 'physical' ? priceVal : 0
        };

        const { error } = await window.supabaseClient.from('products').insert([productData]);
        if (error) throw error;

        alert("🎉 商品上架成功！");
        
        // 重置表單並切換回庫存頁籤
        document.getElementById('p-name').value = '';
        document.getElementById('p-desc').value = '';
        document.getElementById('p-price').value = '';
        document.getElementById('preview-container').innerHTML = '';
        selectedFiles = [];
        
        window.switchCreatorTab('inventory');

    } catch (e) {
        alert("發佈失敗: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ==========================================
// 3. 庫存管理 (Inventory)
// ==========================================
window.loadMyProducts = async function() {
    const listEl = document.getElementById('my-products-list');
    listEl.innerHTML = `<div class="text-center py-10 text-gray-300 font-bold"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>載入中...</div>`;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data: products, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!products || products.length === 0) {
            listEl.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold">你還沒有上架任何商品</div>`;
            return;
        }

        listEl.innerHTML = products.map(p => {
            const firstImg = p.image_url ? p.image_url.split(',')[0] : 'https://placehold.co/150';
            const displayImg = firstImg.includes('r2.dev') ? `${WORKER_URL}media/${firstImg.split('/').pop()}` : firstImg;
            const isPhysical = p.category === 'physical';

            return `
                <div class="flex gap-4 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <img src="${displayImg}" class="w-20 h-20 rounded-xl object-cover shadow-sm">
                    <div class="flex-1 min-w-0 flex flex-col justify-center">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[8px] font-black px-2 py-0.5 rounded bg-gray-200 text-gray-500">${isPhysical ? '實體' : '虛擬'}</span>
                            <span class="text-[8px] font-black px-2 py-0.5 rounded ${p.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}">${p.status === 'approved' ? '已上架' : '審核中'}</span>
                        </div>
                        <h4 class="font-black text-sm text-gray-900 truncate mb-1">${window.escapeHTML(p.name)}</h4>
                        <p class="font-black text-xs ${isPhysical ? 'text-blue-600' : 'text-sexify'}">${isPhysical ? '$' + p.price_usd : '🪙' + p.price}</p>
                    </div>
                    <button onclick="window.deleteProduct('${p.id}')" class="w-10 h-10 self-center bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        listEl.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">載入失敗</div>`;
    }
};

window.deleteProduct = async function(productId) {
    if (!confirm("確定要下架並刪除此商品嗎？")) return;
    try {
        const { error } = await window.supabaseClient.from('products').delete().eq('id', productId);
        if (error) throw error;
        window.loadMyProducts();
        window.loadCreatorDashboard();
    } catch (e) { alert("刪除失敗"); }
};
