/**
 * shop.js - 整合式商城核心邏輯 (修復 CORS 與 400 報錯版本)
 */

let cart = []; 
let isCartView = false; 
let currentKeyword = ''; 

/**
 * 修正後的簽名網址輔助函數
 */
async function getSignedUrlSafe(path) {
    if (!path) return 'https://via.placeholder.com/300?text=No+Image';
    
    // 如果路徑已經是完整網址且包含 http，直接回傳（但這可能引發 CORS 錯誤，建議刪除資料庫中的舊網址）
    if (path.startsWith('http')) {
        return path; 
    }

    try {
        // 確保 path 沒有多餘的斜槓
        const cleanPath = path.trim();
        const { data, error } = await window.supabaseClient.storage
            .from('products')
            .createSignedUrl(cleanPath, 3600);
        
        if (error) {
            console.warn(`簽名失敗 [${cleanPath}]:`, error.message);
            return 'https://via.placeholder.com/300?text=Sign+Error';
        }
        
        return data.signedUrl;
    } catch (e) {
        return 'https://via.placeholder.com/300?text=System+Error';
    }
}

/**
 * 0. 支付與充值介面邏輯
 */
window.toggleRechargeArea = function() {
    const drawer = document.getElementById('recharge-drawer');
    const icon = document.getElementById('recharge-icon');
    if (!drawer) return;
    if (drawer.style.display === 'none' || drawer.style.display === '') {
        drawer.style.display = 'block';
        if (icon) icon.classList.replace('fa-plus', 'fa-xmark');
    } else {
        drawer.style.display = 'none';
        if (icon) icon.classList.replace('fa-xmark', 'fa-plus');
    }
};

window.refreshBalanceUI = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;
        const { data, error } = await window.supabaseClient
            .from('profiles').select('balance').eq('id', user.id).single();
        if (error) throw error;
        const balanceDisplay = document.getElementById('user-balance');
        if (balanceDisplay) balanceDisplay.innerText = data.balance !== null ? data.balance : 0;
    } catch (err) { console.error("餘額同步失敗"); }
};

setInterval(window.refreshBalanceUI, 10000);

window.payNow = async function() {
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    if (isNaN(amount) || amount < 10) return alert("最低充值 $10 USD");
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return alert("請先登入");
        showNotification("建立安全支付連結...");
        const { data, error } = await window.supabaseClient.functions.invoke('create-payment', {
            body: { userId: session.user.id, amount: amount }
        });
        if (data?.invoice_url) window.location.href = data.invoice_url;
    } catch (err) { alert("支付系統忙碌中"); }
};

/**
 * 1. 頂部頁籤
 */
function ensureShopTabs() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    let tabs = document.getElementById('shop-custom-tabs');
    if (!tabs) {
        tabs = document.createElement('div');
        tabs.id = 'shop-custom-tabs';
        tabs.className = 'flex justify-center gap-8 mb-5 border-b border-gray-100/50 pb-2 z-10 relative';
        grid.parentNode.insertBefore(tabs, grid);
    }
    tabs.innerHTML = `
        <button onclick="switchView(false)" class="relative text-[15px] font-bold ${!isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400'}">全部商品</button>
        <button onclick="switchView(true)" class="relative text-[15px] font-bold ${isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400'}">購物清單 ${cart.length > 0 ? `<span class="absolute -top-1.5 -right-3.5 bg-sexify text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">${cart.length}</span>` : ''}</button>
    `;
}

window.switchView = (toCart) => { isCartView = toCart; renderShop(currentKeyword); };

/**
 * 2. 渲染邏輯
 */
window.renderShop = async function(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    currentKeyword = filterKeyword;
    ensureShopTabs();
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400"></i></div>`;

    if (isCartView) {
        grid.className = "grid grid-cols-1 gap-4";
        renderCartInline(grid);
    } else {
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4";
        try {
            let query = window.supabaseClient.from('products').select('*');
            if (filterKeyword) query = query.ilike('name', `%${filterKeyword}%`);
            const { data: products } = await query.order('created_at', { ascending: false });
            
            if (!products?.length) {
                grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 text-sm">找不到商品</div>`;
                return;
            }

            let html = '';
            for (const p of products) {
                const img = await getSignedUrlSafe(p.image_url);
                html += `
                    <div onclick="openProductModal('${p.id}')" class="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm active:scale-95 transition-all">
                        <img src="${img}" class="w-full aspect-square object-cover">
                        <div class="p-3">
                            <h3 class="font-bold text-xs truncate">${p.name}</h3>
                            <div class="mt-2 text-sexify font-black text-sm">🪙 ${p.price}</div>
                        </div>
                    </div>`;
            }
            grid.innerHTML = html;
        } catch (e) { grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-400">系統異常</div>`; }
    }
};

window.openProductModal = async function(productId) {
    const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!p) return;
    const img = await getSignedUrlSafe(p.image_url);
    let modal = document.getElementById('product-modal-container') || document.createElement('div');
    modal.id = 'product-modal-container';
    document.body.appendChild(modal);
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/70 z-[3500] flex items-center justify-center p-4 backdrop-blur-md" onclick="this.innerHTML=''">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden relative shadow-2xl" onclick="event.stopPropagation()">
                <img src="${img}" class="w-full aspect-square object-cover">
                <div class="p-6">
                    <h2 class="text-xl font-extrabold text-gray-900">${p.name}</h2>
                    <p class="text-gray-500 text-sm mt-2">${p.description || ''}</p>
                    <div class="flex gap-2 mt-6">
                        <button onclick="addToCart('${p.id}', '${p.name.replace(/'/g,"")}', ${p.price}, '${img}')" class="flex-1 bg-orange-50 text-orange-500 font-bold py-3.5 rounded-2xl text-sm">加入</button>
                        <button onclick="executeSecurePurchase('${p.id}', '${p.name.replace(/'/g,"")}')" class="flex-[1.5] bg-sexify text-white font-bold py-3.5 rounded-2xl text-sm">購買</button>
                    </div>
                </div>
            </div>
        </div>`;
};

window.executeSecurePurchase = async function(id, name) {
    if (!confirm(`確定購買 ${name}？`)) return;
    const { data, error } = await window.supabaseClient.rpc('process_purchase', { p_item_id: id, p_quantity: 1 });
    if (data?.success) {
        alert("🎉 購買成功！");
        window.location.reload();
    } else {
        alert("餘額不足或其他錯誤");
    }
};

window.addToCart = (id, name, price, img) => {
    cart.push({ id, name, price, img });
    showNotification("已加入清單");
    renderShop(currentKeyword);
};

function renderCartInline(grid) {
    if (!cart.length) { grid.innerHTML = `<div class="text-center py-20 text-gray-400">清單為空</div>`; return; }
    grid.innerHTML = cart.map((item, idx) => `
        <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100">
            <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover">
            <div class="flex-1 font-bold text-sm">${item.name}<br><span class="text-sexify font-black">🪙 ${item.price}</span></div>
            <button onclick="cart.splice(${idx},1);renderShop()" class="text-gray-300"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `).join('') + `<div class="p-5 bg-gray-50 rounded-2xl mt-4"><button onclick="checkoutCart()" class="w-full bg-sexify text-white font-bold py-4 rounded-2xl">結帳</button></div>`;
}

async function checkoutCart() {
    for (const item of cart) {
        await window.supabaseClient.rpc('process_purchase', { p_item_id: item.id, p_quantity: 1 });
    }
    cart = [];
    alert("批量購買完成");
    renderShop();
}

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full z-[5000] text-sm';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

// 我的內容部分
window.toggleMyOrders = () => {
    const el = document.getElementById('my-orders-view');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) window.renderMyOrders();
};

window.renderMyOrders = async function() {
    const container = document.getElementById('orders-list-container');
    container.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-white"></i>';
    const { data } = await window.supabaseClient.from('orders').select('*, products(*)').order('purchased_at', {ascending: false});
    if (!data?.length) { container.innerHTML = '<div class="text-white/50 py-20 text-center">空空如也</div>'; return; }
    
    let html = '';
    for (const o of data) {
        const p = o.products;
        const img = await getSignedUrlSafe(p.image_url);
        html += `
            <div class="flex gap-4 p-3 bg-white/5 rounded-2xl border border-white/10 items-center">
                <img src="${img}" class="w-12 h-12 rounded-xl object-cover">
                <div class="flex-1"><div class="text-white text-sm font-bold">${p.name}</div></div>
                <button onclick="window.showItemDetail('${p.name}','${img}','${p.description||""}')" class="text-sexify text-xs font-bold">查看</button>
            </div>`;
    }
    container.innerHTML = html;
};

document.addEventListener('DOMContentLoaded', () => renderShop());
