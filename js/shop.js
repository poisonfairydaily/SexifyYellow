/**
 * shop.js - 專業商城正式營運整合版 (安全修復版)
 * 整合：NowPayments 支付跳轉 + R2 圖片防破圖 + 漫畫閱讀器 + 購物車系統
 */

let cart = []; 
let currentView = 'all'; 
let currentKeyword = ''; 

// 你的 Worker 網址
const WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";

// --- 🛡️ 安全核心 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ✨ 圖片防破圖過濾器
function getSafeImageUrl(url, bucket = 'previews') {
    if (!url) return 'https://placehold.co/400x400/eeeeee/999999?text=No+Image';
    let firstUrl = url.split(',')[0];
    
    // 如果是舊的 R2 網址 (導致 CORS 破圖的元凶)，強制轉向 Worker
    if (firstUrl.includes('r2.dev')) {
        const fileName = firstUrl.split('/').pop();
        return `${WORKER_URL}/media/${fileName}`;
    }
    
    // 如果只存了檔名 (代表是官方上傳)
    if (!firstUrl.startsWith('http') && window.supabaseClient) {
        return window.supabaseClient.storage.from(bucket).getPublicUrl(firstUrl).data.publicUrl;
    }
    
    return firstUrl;
}

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-[10px] font-bold z-[6000] animate-fade-in';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

/**
 * 0. 基礎功能：餘額、初始化與 NowPayments 支付
 */
window.refreshBalanceUI = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;
        const { data } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        const ids = ['user-balance', 'shop-balance-display', 'pc-balance'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = data?.balance ?? 0;
        });
    } catch (err) { console.error("刷新餘額失敗:", err); }
};

window.handleRecharge = async function(amount) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 20) return alert("最低儲值金額為 $20 USD");

    const btn = document.querySelector('#recharge-drawer button');
    if (!btn) return;
    const originalText = btn.innerText;
    btn.innerText = "建立訂單中...";
    btn.disabled = true;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入帳號");

        const response = await fetch(`${WORKER_URL}/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                price_amount: numAmount,
                price_currency: "usd",
                order_id: `RECHARGE_${user.id}_${Date.now()}`,
                order_description: "SEXIFY 點數充值",
                customer_id: user.id
            })
        });

        if (!response.ok) throw new Error("伺服器回應錯誤");
        const result = await response.json();

        if (result.invoice_url) {
            showNotification("正在前往支付頁面...");
            window.location.href = result.invoice_url;
        } else {
            throw new Error(result.message || "無法取得支付連結");
        }
    } catch (err) {
        alert("充值發起失敗: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

/**
 * 1. 頁籤切換
 */
function ensureShopTabs() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    let tabsContainer = document.getElementById('shop-custom-tabs');
    if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'shop-custom-tabs';
        tabsContainer.className = 'flex justify-center gap-6 mb-6 border-b border-gray-100 pb-2 z-10 relative';
        grid.parentNode.insertBefore(tabsContainer, grid);
    }
    const btnClass = (view) => `relative text-[14px] font-bold transition-all ${currentView === view ? 'text-gray-900 after:content-[""] after:absolute after:-bottom-[10px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400'}`;
    tabsContainer.innerHTML = `
        <button onclick="window.switchView('all')" class="${btnClass('all')}">商城</button>
        <button onclick="window.switchView('owned')" class="${btnClass('owned')}">我的庫存</button>
        <button onclick="window.switchView('cart')" class="${btnClass('cart')}">
            清單 ${cart.length > 0 ? `<span class="bg-sexify text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">${cart.length}</span>` : ''}
        </button>
    `;
}

window.switchView = function(view) {
    currentView = view;
    window.renderShop(currentKeyword);
};

/**
 * 2. 商城渲染 (相容 R2)
 */
window.renderShop = async function(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    currentKeyword = filterKeyword;
    ensureShopTabs();

    if (currentView === 'cart') {
        grid.className = "grid grid-cols-1 gap-4 pb-32"; 
        renderCartInline(grid);
    } else {
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4 pb-32";
        renderProductGrid(grid, filterKeyword);
    }
};

async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // 恢復你原本安全的查詢方式
        let query = window.supabaseClient.from('products').select('*').eq('status', 'approved').eq('is_archived', false); 
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        const { data: products, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);

        let displayProducts = products || [];
        if (currentView === 'owned') {
            // ✨ 安全修復：如果什麼都沒買，直接給空陣列，避免 Supabase 崩潰
            if (purchasedIds.size === 0) {
                displayProducts = [];
            } else {
                const { data: ownedProducts } = await window.supabaseClient.from('products').select('*').in('id', Array.from(purchasedIds));
                displayProducts = ownedProducts || [];
            }
        }

        if (displayProducts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 font-bold">目前沒有內容</div>`;
            return;
        }

        grid.innerHTML = displayProducts.map(p => {
            // 透過過濾器取得安全網址
            const displayImg = getSafeImageUrl(p.image_url, 'previews');
            const isUnlocked = purchasedIds.has(p.id);
            return `
                <div onclick="window.openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
                    <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                        <img src="${displayImg}" class="w-full h-full object-cover">
                        ${isUnlocked ? '<div class="absolute top-2 right-2 bg-green-500 text-white text-[8px] px-2 py-1 rounded-full font-bold">已解鎖</div>' : ''}
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-[11px] text-gray-800 line-clamp-1">${escapeHTML(p.name)}</h3>
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-sexify font-black text-xs">🪙 ${p.price}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { 
        console.error("渲染清單崩潰:", e);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-500 font-bold">發生錯誤</div>`;
    }
}

/**
 * 3. 購物車介面
 */
function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `
            <div class="text-center py-20 flex flex-col items-center">
                <i class="fa-solid fa-cart-shopping text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-400 font-bold">清單內沒有商品</p>
                <button onclick="window.switchView('all')" class="mt-6 bg-black text-white px-6 py-2 rounded-full text-xs font-bold active:scale-95">去逛逛</button>
            </div>`;
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    let html = cart.map((item, index) => `
        <div class="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
            <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover bg-gray-50">
            <div class="flex-1 overflow-hidden">
                <h3 class="font-black text-sm text-gray-900 truncate mb-1">${escapeHTML(item.name)}</h3>
                <p class="text-sexify font-black text-sm">🪙 ${item.price}</p>
            </div>
            <button onclick="window.removeFromCart('${item.id}')" class="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');

    html += `
        <div class="mt-4 bg-zinc-900 text-white p-6 rounded-3xl shadow-xl flex flex-col gap-4">
            <div class="flex justify-between items-center">
                <span class="text-sm text-zinc-400 font-bold">總計金額</span>
                <span class="text-2xl font-black text-sexify">🪙 ${total}</span>
            </div>
            <button onclick="window.checkoutCart()" class="w-full bg-sexify text-white font-black py-4 rounded-xl active:scale-95 transition shadow-lg">一鍵解鎖全部</button>
        </div>
    `;
    grid.innerHTML = html;
}

window.addToCart = function(id, name, price, img) {
    if (cart.some(i => i.id === id)) return alert("已在清單中");
    cart.push({ id, name, price: parseInt(price), img });
    showNotification(`已加入清單`);
    ensureShopTabs();
    window.closeProductModal();
};

window.removeFromCart = function(id) {
    cart = cart.filter(i => i.id !== id);
    window.renderShop(); 
};

window.checkoutCart = async function() {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    if (!confirm(`確定要花費 🪙 ${total} 解鎖清單內的所有內容嗎？`)) return;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入");

        const { data: profile } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (profile.balance < total) return alert("餘額不足，請先儲值！");

        await window.supabaseClient.from('profiles').update({ balance: profile.balance - total }).eq('id', user.id);

        const orderPromises = cart.map(item => window.supabaseClient.from('orders').insert({
            user_id: user.id, product_id: item.id, amount: item.price
        }));
        await Promise.all(orderPromises);

        cart = []; 
        showNotification("🎉 成功解鎖所有內容！");
        window.refreshBalanceUI();
        window.switchView('owned'); 
    } catch (e) { alert("結帳失敗: " + e.message); }
};

window.handlePurchase = async function(productId, price) {
    if (!confirm(`確定要花費 🪙 ${price} 解鎖嗎？`)) return;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入");

        const { data: profile } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (profile.balance < price) return alert("餘額不足，請先儲值！");

        await window.supabaseClient.from('profiles').update({ balance: profile.balance - price }).eq('id', user.id);
        await window.supabaseClient.from('orders').insert({ user_id: user.id, product_id: productId, amount: price });

        showNotification("🎉 解鎖成功！馬上開始閱讀");
        window.refreshBalanceUI();
        window.closeProductModal();
        window.renderShop(currentKeyword); 
    } catch (e) { alert("購買失敗: " + e.message); }
};

/**
 * 4. 彈窗與漫畫閱讀器
 */
window.openProductModal = async function(productId) {
    let modal = document.getElementById('post-detail-modal'); 
    let content = document.getElementById('post-detail-content');
    if (!modal || !content) return;

    content.innerHTML = '<div class="p-20 text-center"><i class="fa-solid fa-spinner fa-spin text-2xl text-gray-300"></i></div>';
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // 抓取商品 (這段加上了 profile 防止報錯，如果沒有關聯會顯示官方)
        const { data: item, error } = await window.supabaseClient.from('products').select('*, profiles(display_name, avatar_url)').eq('id', productId).single();
        if (error) throw error;

        const { data: order } = user ? await window.supabaseClient.from('orders').select('id').eq('user_id', user.id).eq('product_id', productId).maybeSingle() : { data: null };
        const isUnlocked = !!order;

        const safeImg = getSafeImageUrl(item.image_url, 'previews');

        let buttonsHtml = isUnlocked 
            ? `<button onclick="window.openComicReader('${item.id}', '${item.image_url}')" class="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 flex justify-center items-center gap-2"><i class="fa-solid fa-book-open"></i> 開始閱讀</button>`
            : `<div class="flex gap-3">
                    <button onclick="window.addToCart('${item.id}', '${escapeHTML(item.name)}', ${item.price}, '${safeImg}')" class="flex-1 bg-gray-100 text-gray-900 font-bold py-4 rounded-2xl active:scale-95 transition"><i class="fa-solid fa-cart-plus"></i></button>
                    <button onclick="window.handlePurchase('${item.id}', ${item.price})" class="flex-[3] bg-black text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition flex justify-center items-center gap-2"><i class="fa-solid fa-unlock"></i> 立即解鎖</button>
               </div>`;

        content.innerHTML = `
            <div class="relative bg-gray-100">
                <img src="${safeImg}" class="w-full h-auto max-h-[50vh] object-contain">
                ${isUnlocked ? '<div class="absolute top-4 right-4 bg-green-500 text-white text-xs px-3 py-1.5 rounded-full font-black shadow-lg">已購買</div>' : ''}
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-xl font-black text-gray-900">${escapeHTML(item.name)}</h2>
                    <span class="text-lg font-black text-sexify whitespace-nowrap ml-4">🪙 ${item.price}</span>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-8">${escapeHTML(item.description || '這件商品目前沒有詳細描述。')}</p>
                ${buttonsHtml}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="p-20 text-center text-red-500 font-bold">載入失敗: ${err.message}</div>`;
    }
};

window.closeProductModal = function() {
    const modal = document.getElementById('post-detail-modal');
    if (modal) {
        modal.classList.add('translate-x-full');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

window.openComicReader = function(productId, imageUrlsString) {
    if (!imageUrlsString) return alert("該商品沒有圖片");

    let readerModal = document.getElementById('comic-reader-modal');
    if (!readerModal) {
        readerModal = document.createElement('div');
        readerModal.id = 'comic-reader-modal';
        readerModal.className = 'fixed inset-0 bg-black z-[9999] flex flex-col hidden transform translate-y-full transition-transform duration-300';
        document.body.appendChild(readerModal);
    }

    // 將原圖轉成安全 R2 網址
    const urls = imageUrlsString.split(',').filter(u => u.trim() !== '').map(u => getSafeImageUrl(u, 'products'));

    readerModal.innerHTML = `
        <header class="bg-black/80 backdrop-blur-md text-white p-4 flex justify-between items-center sticky top-0 z-10 border-b border-zinc-800">
            <div class="flex items-center gap-3">
                <button onclick="window.closeComicReader()" class="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full active:scale-90"><i class="fa-solid fa-xmark"></i></button>
                <span class="font-bold text-sm">閱讀中 (${urls.length} 頁)</span>
            </div>
        </header>
        <div class="flex-1 overflow-y-auto bg-zinc-900 pb-20">
            ${urls.map((url, i) => `
                <div class="relative w-full min-h-[50vh] flex items-center justify-center bg-zinc-900 border-b border-zinc-800 pb-1">
                    <img src="${url}" class="w-full h-auto relative z-10">
                    <span class="absolute bottom-2 right-2 bg-black/50 text-white/50 text-[10px] px-2 py-1 rounded-full z-20">${i+1} / ${urls.length}</span>
                </div>
            `).join('')}
            <div class="text-center py-10 text-zinc-600 font-bold text-sm">-- 已經到底囉 --</div>
        </div>
    `;

    readerModal.classList.remove('hidden');
    void readerModal.offsetWidth;
    readerModal.classList.remove('translate-y-full');
};

window.closeComicReader = function() {
    const readerModal = document.getElementById('comic-reader-modal');
    if (readerModal) {
        readerModal.classList.add('translate-y-full');
        setTimeout(() => { readerModal.classList.add('hidden'); readerModal.innerHTML = ''; }, 300);
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.refreshBalanceUI();
    window.renderShop();
});
