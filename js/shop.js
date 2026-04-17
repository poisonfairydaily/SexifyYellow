/**
 * shop.js - 核心商城邏輯
 * 整合：R2 代理圖片、Supabase 餘額監聽、購買與彈窗。
 */

const IMAGE_CONFIG = {
    source: 'R2', 
    workerUrl: 'https://sexifyyellow.poisonfairydaily.workers.dev' // 需確保此為新建立的 Worker
};

let cart = []; 
let balanceSubscription = null;

/** 1. 處理圖片：對接 Worker **/
async function getSignedUrlSafe(path) {
    if (!path) return 'https://via.placeholder.com/300?text=No+Image';
    if (path.startsWith('http')) return path; 

    const cleanPath = path.trim();
    // 使用 encodeURIComponent 確保檔名中的空格（%20）能被正確處理
    return `${IMAGE_CONFIG.workerUrl}?key=${encodeURIComponent(cleanPath)}`;
}

/** 2. 餘額同步：即時監聽資料庫變動 **/
window.refreshBalanceUI = async function() {
    try {
        if (!window.supabaseClient) return;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        // 第一次抓取
        const { data } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (data) updateBalanceDOM(data.balance);

        // 開啟即時監聽
        if (!balanceSubscription) {
            balanceSubscription = window.supabaseClient.channel('balance-realtime')
                .on('postgres_changes', { 
                    event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` 
                }, payload => {
                    updateBalanceDOM(payload.new.balance);
                }).subscribe();
        }
    } catch (e) { console.error("餘額同步失敗", e); }
};

function updateBalanceDOM(balance) {
    const el = document.getElementById('user-balance');
    if (el) el.innerText = parseFloat(balance || 0).toLocaleString();
}

/** 3. 渲染商城商品 **/
window.renderShop = async function() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-2 text-center py-20 text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> 載入中...</div>';

    try {
        const { data: products } = await window.supabaseClient.from('products').select('*').order('created_at', { ascending: false });
        if (!products?.length) {
            grid.innerHTML = '<div class="col-span-2 text-center py-20 text-gray-400">尚無商品</div>';
            return;
        }

        let html = '';
        for (const p of products) {
            const img = await getSignedUrlSafe(p.image_url);
            html += `
                <div onclick="openProductModal('${p.id}')" class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 active:scale-95 transition cursor-pointer">
                    <img src="${img}" class="w-full aspect-square object-cover" onerror="this.src='https://via.placeholder.com/300?text=Error'">
                    <div class="p-3">
                        <h3 class="font-bold text-xs truncate text-gray-800">${p.name}</h3>
                        <div class="mt-2 text-[#ff2442] font-black text-sm">🪙 ${p.price}</div>
                    </div>
                </div>`;
        }
        grid.innerHTML = html;
    } catch (e) { grid.innerHTML = '<div class="col-span-2 text-center py-20 text-red-400">系統異常</div>'; }
};

/** 4. 商品詳情彈窗 **/
window.openProductModal = async function(productId) {
    const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!p) return;
    
    const img = await getSignedUrlSafe(p.image_url);
    let modal = document.getElementById('product-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-modal-container';
        document.body.appendChild(modal);
    }

    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" onclick="window.closeProductModal()">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden relative shadow-2xl animate-in" onclick="event.stopPropagation()">
                <button onclick="window.closeProductModal()" class="absolute top-4 right-4 bg-black/20 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
                <img src="${img}" class="w-full aspect-square object-cover">
                <div class="p-8 text-center">
                    <h2 class="text-xl font-extrabold">${p.name}</h2>
                    <p class="text-gray-500 text-sm mt-2">${p.description || '專屬私密內容'}</p>
                    <button onclick="executePurchase('${p.id}', '${p.name}')" class="w-full bg-[#ff2442] text-white font-bold py-4 rounded-2xl mt-8 shadow-lg shadow-[#ff2442]/20 active:scale-95 transition">立即購買 (🪙 ${p.price})</button>
                </div>
            </div>
        </div>`;
};

window.closeProductModal = function() {
    const modal = document.getElementById('product-modal-container');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
};

/** 5. 購買與支付 **/
window.executePurchase = async function(id, name) {
    if (!confirm(`確定購買 ${name}？`)) return;
    const { data } = await window.supabaseClient.rpc('process_purchase', { p_item_id: id, p_quantity: 1 });
    if (data?.success) {
        alert("🎉 購買成功！");
        window.closeProductModal();
        window.refreshBalanceUI();
    } else {
        alert("餘額不足，請先充值。");
    }
};

window.toggleRechargeArea = function() {
    const drawer = document.getElementById('recharge-drawer');
    if (!drawer) return;
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
};

window.payNow = async function() {
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    if (amount < 20) return alert("最低儲值 $20");
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const { data } = await window.supabaseClient.functions.invoke('create-payment', { body: { userId: session.user.id, amount } });
    if (data?.invoice_url) window.location.href = data.invoice_url;
};

document.addEventListener('DOMContentLoaded', () => {
    window.renderShop();
    window.refreshBalanceUI();
});
