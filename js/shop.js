/**
 * shop.js - 完整修復版本
 * 1. 對接 Cloudflare Worker (R2 圖片)
 * 2. 強化餘額同步 (即時監聽模式)
 */

// --- 1. 配置區域 ---
const IMAGE_CONFIG = {
    source: 'R2', 
    workerUrl: 'https://sexifyyellow.poisonfairydaily.workers.dev/' 
};

let cart = []; 
let isCartView = false; 
let currentKeyword = ''; 
let balanceSubscription = null; // 用於存放即時監聽器

/**
 * 圖片處理：對接 Worker
 */
async function getSignedUrlSafe(path) {
    if (!path) return 'https://via.placeholder.com/300?text=No+Image';
    if (path.startsWith('http')) return path; 

    if (IMAGE_CONFIG.source === 'R2') {
        const cleanPath = path.trim();
        return `${IMAGE_CONFIG.workerUrl}?key=${encodeURIComponent(cleanPath)}`;
    }
    return path;
}

/**
 * 餘額顯示修復：使用即時監聽 (Realtime)
 */
window.refreshBalanceUI = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            console.log("用戶未登入，跳過餘額同步");
            return;
        }

        // 1. 首次獲取餘額
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (!error && data) {
            updateBalanceDOM(data.balance);
        }

        // 2. 建立即時監聽 (如果還沒建立)
        if (!balanceSubscription) {
            balanceSubscription = window.supabaseClient
                .channel('balance-changes')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'profiles',
                    filter: `id=eq.${user.id}` 
                }, payload => {
                    updateBalanceDOM(payload.new.balance);
                })
                .subscribe();
        }
    } catch (err) {
        console.error("餘額同步系統故障:", err);
    }
};

function updateBalanceDOM(balance) {
    const balanceDisplay = document.getElementById('user-balance');
    if (balanceDisplay) {
        // 確保 balance 為數字且格式化
        const val = parseFloat(balance || 0);
        balanceDisplay.innerText = val.toLocaleString(); 
    }
}

// 每 30 秒做一次強制校準備援 (原本是 10 秒太頻繁)
setInterval(window.refreshBalanceUI, 30000);

/**
 * 支付邏輯
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
 * 商城渲染邏輯
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
                        <img src="${img}" class="w-full aspect-square object-cover" onerror="this.src='https://via.placeholder.com/300?text=Load+Error'">
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
                <img src="${img}" class="w-full aspect-square object-cover" onerror="this.src='https://via.placeholder.com/300?text=Load+Error'">
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
        showNotification("🎉 購買成功！");
        window.refreshBalanceUI(); // 購買後立即更新餘額
        if (!isCartView) renderShop(currentKeyword);
    } else {
        alert("餘額不足或購買失敗");
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
    showNotification("批量購買中...");
    for (const item of cart) {
        await window.supabaseClient.rpc('process_purchase', { p_item_id: item.id, p_quantity: 1 });
    }
    cart = [];
    alert("結帳完成");
    window.refreshBalanceUI();
    renderShop();
}

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full z-[5000] text-sm';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

window.toggleMyOrders = () => {
    const el = document.getElementById('my-orders-view');
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) window.renderMyOrders();
};

window.renderMyOrders = async function() {
    const container = document.getElementById('orders-list-container');
    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-white"></i></div>';
    const { data } = await window.supabaseClient.from('orders').select('*, products(*)').order('purchased_at', {ascending: false});
    if (!data?.length) { container.innerHTML = '<div class="text-white/50 py-20 text-center">空空如也</div>'; return; }
    
    let html = '';
    for (const o of data) {
        const p = o.products;
        if(!p) continue;
        const img = await getSignedUrlSafe(p.image_url);
        html += `
            <div class="flex gap-4 p-3 bg-white/5 rounded-2xl border border-white/10 items-center">
                <img src="${img}" class="w-12 h-12 rounded-xl object-cover" onerror="this.src='https://via.placeholder.com/300?text=Load+Error'">
                <div class="flex-1"><div class="text-white text-sm font-bold">${p.name}</div></div>
                <button onclick="window.showItemDetail('${p.name.replace(/'/g,"")}','${img}','${(p.description||"").replace(/'/g,"")}')" class="text-sexify text-xs font-bold">查看</button>
            </div>`;
    }
    container.innerHTML = html;
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderShop();
    window.refreshBalanceUI();
});
