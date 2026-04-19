/**
 * shop.js - 專業商城正式營運整合版 (完整無省略版)
 * 整合：NowPayments 支付 + R2 防破圖代理 + 購物車系統 + 沉浸式漫畫閱讀器
 */

// --- ⚙️ 全域狀態與變數 ---
if (typeof window.WORKER_URL === 'undefined') {
    window.WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";
}

let cart = []; 
let currentView = 'all'; 
let currentKeyword = ''; 

// --- 🛡️ 安全核心與 R2 防破圖機制 ---
window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ✨ 超級防護網：自動將舊的、錯的網址修正成 Worker 代理網址
window.getSafeImageUrl = function(url, bucket = 'previews') {
    if (!url) return 'https://placehold.co/400x400/eeeeee/999999?text=No+Image';
    
    let firstUrl = url.split(',')[0];
    
    // 如果是舊的 R2 網址，強制替換為 Worker 網址
    if (firstUrl.includes('r2.dev')) {
        const fileName = firstUrl.split('/').pop();
        return `${window.WORKER_URL}/media/${fileName}`;
    }
    
    // 如果只存了檔名 (代表是 Supabase 原生 Storage)
    if (!firstUrl.startsWith('http')) {
        if(window.supabaseClient) {
            return window.supabaseClient.storage.from(bucket).getPublicUrl(firstUrl).data.publicUrl;
        }
    }
    
    return firstUrl;
};

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-xs font-bold z-[6000] animate-fade-in shadow-xl';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => {
        n.classList.add('opacity-0');
        setTimeout(() => n.remove(), 300);
    }, 2000);
}

// --- 💰 1. 財務系統：餘額與 NowPayments 支付 ---
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

        const response = await fetch(`${window.WORKER_URL}/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                price_amount: numAmount,
                price_currency: "usd",
                order_id: `RECHARGE_${user.id}_${Date.now()}`,
                order_description: "SFY Points Top-up",
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
        console.error("支付失敗:", err);
        alert("充值發起失敗: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// --- 🏪 2. 商城 UI：頁籤與列表渲染 ---
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
        <button onclick="window.switchView('all')" class="${btnClass('all')}">商城首頁</button>
        <button onclick="window.switchView('owned')" class="${btnClass('owned')}">我的解鎖</button>
        <button onclick="window.switchView('cart')" class="${btnClass('cart')}">
            購物車 ${cart.length > 0 ? `<span class="bg-sexify text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">${cart.length}</span>` : ''}
        </button>
    `;
}

window.switchView = function(view) {
    currentView = view;
    window.renderShop(currentKeyword);
};

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
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i></div>`;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        let query = window.supabaseClient.from('products').select('*').or('status.eq.approved,is_official.eq.true').eq('is_archived', false); 
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        const { data: products, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;

        // 查詢用戶已購買的商品
        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);

        let displayProducts = products || [];
        if (currentView === 'owned') {
            displayProducts = displayProducts.filter(p => purchasedIds.has(p.id));
        }

        if (displayProducts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 font-bold">目前沒有內容</div>`;
            return;
        }

        grid.innerHTML = displayProducts.map(p => {
            const safeImg = window.getSafeImageUrl(p.image_url, 'previews');
            const isUnlocked = purchasedIds.has(p.id);
            
            return `
                <div onclick="window.openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
                    <div class="aspect-square w-full overflow-hidden bg-gray-50 relative">
                        <img src="${safeImg}" class="w-full h-full object-cover">
                        ${isUnlocked ? '<div class="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full font-black shadow-sm">已解鎖</div>' : ''}
                    </div>
                    <div class="p-3">
                        <h3 class="font-black text-sm text-gray-900 line-clamp-1 mb-1">${escapeHTML(p.name)}</h3>
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-sexify font-black text-xs">🪙 ${p.price}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { 
        console.error("載入商品失敗:", e);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-500 font-bold">載入失敗</div>`;
    }
}

// --- 🛍️ 3. 購物車與購買系統 ---
function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `
            <div class="text-center py-20 flex flex-col items-center">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-cart-shopping text-3xl text-gray-300"></i>
                </div>
                <p class="text-gray-400 font-bold">清單內沒有商品</p>
                <button onclick="window.switchView('all')" class="mt-6 bg-gray-900 text-white px-6 py-2 rounded-full text-xs font-bold active:scale-95">去逛逛</button>
            </div>`;
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    
    let html = cart.map((item, index) => `
        <div class="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm animate-fade-in" style="animation-delay: ${index * 0.05}s">
            <img src="${item.img}" class="w-20 h-20 rounded-xl object-cover bg-gray-50">
            <div class="flex-1 overflow-hidden">
                <h3 class="font-black text-sm text-gray-900 truncate mb-1">${escapeHTML(item.name)}</h3>
                <p class="text-sexify font-black text-sm">🪙 ${item.price}</p>
            </div>
            <button onclick="window.removeFromCart('${item.id}')" class="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>
    `).join('');

    html += `
        <div class="mt-6 bg-zinc-900 text-white p-6 rounded-3xl shadow-xl flex flex-col gap-4 sticky bottom-24">
            <div class="flex justify-between items-center">
                <span class="text-sm text-zinc-400 font-bold">總計金額</span>
                <span class="text-2xl font-black text-sexify">🪙 ${total}</span>
            </div>
            <button onclick="window.checkoutCart()" class="w-full bg-sexify text-white font-black py-4 rounded-xl active:scale-95 transition shadow-lg flex items-center justify-center gap-2">
                <i class="fa-solid fa-lock-open"></i> 一鍵解鎖全部
            </button>
        </div>
    `;
    grid.innerHTML = html;
}

window.addToCart = function(id, name, price, img) {
    if (cart.some(i => i.id === id)) {
        showNotification("已在購物車中");
        return;
    }
    cart.push({ id, name, price: parseInt(price), img });
    showNotification(`已加入購物車`);
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
        if (profile.balance < total) {
            return alert("餘額不足，請先儲值！");
        }

        // 扣款
        const { error: balanceError } = await window.supabaseClient
            .from('profiles')
            .update({ balance: profile.balance - total })
            .eq('id', user.id);
        if (balanceError) throw balanceError;

        // 產生訂單紀錄
        const orderPromises = cart.map(item => 
            window.supabaseClient.from('orders').insert({
                user_id: user.id,
                product_id: item.id,
                amount: item.price
            })
        );
        await Promise.all(orderPromises);

        cart = []; // 清空購物車
        showNotification("🎉 成功解鎖所有內容！");
        window.refreshBalanceUI();
        window.switchView('owned'); // 跳轉到我的庫存

    } catch (e) {
        alert("結帳失敗: " + e.message);
    }
};

window.handlePurchase = async function(productId, price) {
    if (!confirm(`確定要花費 🪙 ${price} 解鎖此內容嗎？`)) return;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入");

        const { data: profile } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (profile.balance < price) {
            return alert("餘額不足，請先透過上方點擊 ➕ 儲值點數！");
        }

        const { error: balanceError } = await window.supabaseClient.from('profiles').update({ balance: profile.balance - price }).eq('id', user.id);
        if (balanceError) throw balanceError;

        const { error: orderError } = await window.supabaseClient.from('orders').insert({
            user_id: user.id,
            product_id: productId,
            amount: price
        });
        if (orderError) throw orderError;

        showNotification("🎉 解鎖成功！馬上開始閱讀");
        window.refreshBalanceUI();
        window.closeProductModal();
        window.renderShop(currentKeyword); 
    } catch (e) {
        alert("購買失敗: " + e.message);
    }
};


// --- 📖 4. 彈窗與漫畫閱讀器 ---
window.openProductModal = async function(productId) {
    let modal = document.getElementById('post-detail-modal'); 
    let content = document.getElementById('post-detail-content');
    
    if (!modal || !content) return;

    content.innerHTML = '<div class="p-20 text-center"><i class="fa-solid fa-spinner fa-spin text-2xl text-gray-300"></i></div>';
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // 抓商品與作者資訊
        const { data: item, error } = await window.supabaseClient
            .from('products')
            .select('*, profiles(display_name, avatar_url)')
            .eq('id', productId)
            .single();

        if (error) throw error;

        // 檢查是否已購買
        const { data: order } = user ? await window.supabaseClient.from('orders').select('id').eq('user_id', user.id).eq('product_id', productId).maybeSingle() : { data: null };
        const isUnlocked = !!order;

        const safeImg = window.getSafeImageUrl(item.image_url, 'previews');

        let buttonsHtml = '';
        if (isUnlocked) {
            buttonsHtml = `<button onclick="window.openComicReader('${item.id}', '${item.image_url}')" class="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition flex justify-center items-center gap-2"><i class="fa-solid fa-book-open"></i> 開始閱讀</button>`;
        } else {
            buttonsHtml = `
                <div class="flex gap-3">
                    <button onclick="window.addToCart('${item.id}', '${escapeHTML(item.name)}', ${item.price}, '${safeImg}')" class="flex-1 bg-gray-100 text-gray-900 font-bold py-4 rounded-2xl active:scale-95 transition"><i class="fa-solid fa-cart-plus"></i></button>
                    <button onclick="window.handlePurchase('${item.id}', ${item.price})" class="flex-[3] bg-black text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition flex justify-center items-center gap-2"><i class="fa-solid fa-unlock"></i> 立即解鎖</button>
                </div>`;
        }

        content.innerHTML = `
            <div class="relative bg-gray-100">
                <img src="${safeImg}" class="w-full h-auto max-h-[50vh] object-contain">
                ${isUnlocked ? '<div class="absolute top-4 right-4 bg-green-500 text-white text-xs px-3 py-1.5 rounded-full font-black shadow-lg backdrop-blur-md">已購買</div>' : ''}
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-2xl font-black text-gray-900 leading-tight">${escapeHTML(item.name)}</h2>
                    <span class="text-xl font-black text-sexify whitespace-nowrap ml-4">🪙 ${item.price}</span>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-6 border border-gray-100">
                    <img src="${item.profiles?.avatar_url || 'https://ui-avatars.com/api/?name=U'}" class="w-10 h-10 rounded-full object-cover">
                    <div>
                        <p class="text-sm font-black text-gray-800">${escapeHTML(item.profiles?.display_name || '官方認證')}</p>
                        <p class="text-[10px] text-gray-400 uppercase font-bold">創作者</p>
                    </div>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed mb-8 whitespace-pre-line">${escapeHTML(item.description || '這件商品目前沒有詳細描述。')}</p>
                ${buttonsHtml}
            </div>
        `;

        // 隱藏留言區 (因為商品詳情不需要留言)
        const commentsArea = document.getElementById('post-comments-list');
        const commentsTitle = document.querySelector('[data-i18n="comments"]');
        if(commentsArea) commentsArea.style.display = 'none';
        if(commentsTitle) commentsTitle.style.display = 'none';

    } catch (err) {
        content.innerHTML = `<div class="p-20 text-center text-red-500 font-bold">內容載入失敗: ${err.message}</div>`;
    }
};

window.closeProductModal = function() {
    const modal = document.getElementById('post-detail-modal');
    if (modal) {
        modal.classList.add('translate-x-full');
        setTimeout(() => {
            modal.classList.add('hidden');
            // 恢復留言區顯示 (以免影響到貼文功能)
            const commentsArea = document.getElementById('post-comments-list');
            const commentsTitle = document.querySelector('[data-i18n="comments"]');
            if(commentsArea) commentsArea.style.display = '';
            if(commentsTitle) commentsTitle.style.display = '';
        }, 300);
    }
};

// 沉浸式漫畫閱讀器
window.openComicReader = function(productId, imageUrlsString) {
    if (!imageUrlsString) return alert("該商品沒有圖片內容");

    let readerModal = document.getElementById('comic-reader-modal');
    if (!readerModal) {
        readerModal = document.createElement('div');
        readerModal.id = 'comic-reader-modal';
        readerModal.className = 'fixed inset-0 bg-black z-[9999] flex flex-col hidden transform translate-y-full transition-transform duration-300';
        document.body.appendChild(readerModal);
    }

    // 處理多圖並使用防護網轉換為原圖 (bucket: 'products')
    const urls = imageUrlsString.split(',').filter(u => u.trim() !== '').map(u => window.getSafeImageUrl(u, 'products'));

    readerModal.innerHTML = `
        <header class="bg-black/80 backdrop-blur-md text-white p-4 flex justify-between items-center sticky top-0 z-10 border-b border-zinc-800">
            <div class="flex items-center gap-3">
                <button onclick="window.closeComicReader()" class="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full active:scale-90 transition"><i class="fa-solid fa-xmark"></i></button>
                <span class="font-bold text-sm">閱讀中 (${urls.length} 頁)</span>
            </div>
        </header>
        <div class="flex-1 overflow-y-auto bg-zinc-900 scroll-smooth pb-20">
            ${urls.map((url, i) => `
                <div class="relative w-full min-h-[50vh] flex items-center justify-center bg-zinc-900 mb-1 border-b border-zinc-800 pb-1">
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <i class="fa-solid fa-spinner fa-spin text-zinc-600 text-3xl"></i>
                    </div>
                    <img src="${url}" class="w-full h-auto relative z-10" loading="lazy" onload="this.previousElementSibling.remove()">
                    <span class="absolute bottom-2 right-2 bg-black/50 text-white/50 text-[10px] px-2 py-1 rounded-full z-20">${i+1} / ${urls.length}</span>
                </div>
            `).join('')}
            <div class="text-center py-10 text-zinc-600 font-bold text-sm">-- 已經到底囉 --</div>
        </div>
    `;

    readerModal.classList.remove('hidden');
    // 強制重繪後滑入
    void readerModal.offsetWidth;
    readerModal.classList.remove('translate-y-full');
};

window.closeComicReader = function() {
    const readerModal = document.getElementById('comic-reader-modal');
    if (readerModal) {
        readerModal.classList.add('translate-y-full');
        setTimeout(() => {
            readerModal.classList.add('hidden');
            readerModal.innerHTML = ''; // 清空記憶體
        }, 300);
    }
};

// --- 🚀 初始化載入 ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.refreshBalanceUI === 'function') {
        window.refreshBalanceUI();
    }
    // 不要自動呼叫 renderShop，讓首頁控制導航顯示
});
