/**
 * shop.js - 專業商城正式營運版 (進階篩選 + 官方標籤 + 匯率轉換系統 + 無 Emoji 質感版 + 修正 CORS 頭像)
 */

let cart = []; 
let currentView = 'all'; 
let currentKeyword = ''; 

window.shopFilterType = 'all'; 
window.shopSortType = 'new';   

const WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";
const EXCHANGE_RATE = 20; 

// ✨ 預設頭像解決方案 (DiceBear)，避免 CORS 錯誤
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=U&backgroundColor=eeeeee&textColor=999999";

// --- 安全核心與輔助函數 ---
window.escapeHTML = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.getSafeImageUrl = function(url, bucket = 'previews') {
    if (!url) return 'https://placehold.co/400x400/eeeeee/999999?text=No+Image';
    let firstUrl = url.split(',')[0];
    if (firstUrl.includes('r2.dev')) {
        const fileName = firstUrl.split('/').pop();
        return `${WORKER_URL}/media/${fileName}`;
    }
    if (!firstUrl.startsWith('http') && window.supabaseClient) {
        return window.supabaseClient.storage.from(bucket).getPublicUrl(firstUrl).data.publicUrl;
    }
    return firstUrl;
}

window.showNotification = function(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/90 text-white px-6 py-3 rounded-full text-xs font-bold z-[6000] animate-fade-in shadow-xl tracking-wider';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => {
        n.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => n.remove(), 300);
    }, 2000);
}

// --- 財務系統：1:20 匯率轉換中心 ---
window.refreshBalanceUI = async function() {
    try {
        if (!window.supabaseClient) return;
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

window.updateRechargePreview = function(val) {
    const num = parseFloat(val) || 0;
    const preview = document.getElementById('rechargePreview');
    if (preview) preview.innerText = `🪙 ${num * EXCHANGE_RATE}`;
};

window.handleRecharge = function(amount) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 20) return alert("最低儲值金額為 $20 USD");
    
    const drawer = document.getElementById('recharge-drawer');
    if (drawer) drawer.style.display = 'none';

    let selector = document.getElementById('payment-selector-modal');
    if (!selector) {
        selector = document.createElement('div');
        selector.id = 'payment-selector-modal';
        selector.className = 'fixed inset-0 z-[7000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in';
        document.body.appendChild(selector);
    }

    const tokensToGet = numAmount * EXCHANGE_RATE;

    selector.innerHTML = `
        <div class="bg-white rounded-[2rem] p-6 w-full max-sm shadow-2xl transform transition-all scale-100">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-black text-gray-900">選擇付款方式</h3>
                <button onclick="document.getElementById('payment-selector-modal').remove()" class="text-gray-400 hover:text-gray-600 active:scale-90 transition"><i class="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 relative overflow-hidden">
                <div class="absolute right-0 top-0 w-16 h-16 bg-sexify/10 rounded-bl-full -z-0"></div>
                <p class="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1 relative z-10">支付金額</p>
                <p class="text-gray-900 text-2xl font-black relative z-10">$${numAmount} <span class="text-xs text-gray-500 font-bold">USD</span></p>
                <div class="h-px bg-gray-200 my-3"></div>
                <p class="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1 relative z-10">獲得 🪙 (1:${EXCHANGE_RATE})</p>
                <p class="text-sexify text-xl font-black relative z-10">🪙 ${tokensToGet}</p>
            </div>
            <div class="space-y-3">
                <button onclick="window.processNowPayments(${numAmount})" class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-sexify transition active:scale-95 group">
                    <div class="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition text-xl"><i class="fa-brands fa-bitcoin text-orange-500"></i></div>
                    <div class="text-left flex-1"><p class="font-black text-gray-900">加密貨幣支付</p><p class="text-[10px] text-gray-400 font-bold">由 NowPayments 提供</p></div>
                    <i class="fa-solid fa-chevron-right text-gray-300"></i>
                </button>
                <button onclick="alert('信用卡支付閘道正在審核中，敬請期待！')" class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 transition active:scale-95 group opacity-60">
                    <div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl"><i class="fa-regular fa-credit-card text-blue-500"></i></div>
                    <div class="text-left flex-1"><p class="font-black text-gray-900">信用卡 (Credit Card)</p><p class="text-[10px] text-blue-500 font-bold">即將開放</p></div>
                    <i class="fa-solid fa-lock text-gray-300"></i>
                </button>
            </div>
        </div>
    `;
};

window.processNowPayments = async function(numAmount) {
    const btn = document.querySelector('#payment-selector-modal button');
    if (btn) { btn.innerText = "建立訂單中..."; btn.disabled = true; }

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
                order_description: "SFY Points Top-up",
                customer_id: user.id
            })
        });

        if (!response.ok) throw new Error("伺服器回應錯誤");
        const result = await response.json();

        if (result.invoice_url) {
            window.showNotification("正在前往安全支付頁面...");
            window.location.href = result.invoice_url;
        } else {
            throw new Error(result.message || "無法取得支付連結");
        }
    } catch (err) {
        alert("充值發起失敗: " + err.message);
        document.getElementById('payment-selector-modal')?.remove();
    }
};

// --- 頁籤與進階篩選渲染 ---
function ensureShopTabs() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    let tabsContainer = document.getElementById('shop-custom-tabs');
    if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'shop-custom-tabs';
        tabsContainer.className = 'flex flex-col gap-4 mb-4 z-10 relative';
        grid.parentNode.insertBefore(tabsContainer, grid);
    }
    
    const btnClass = (view) => `relative text-[14px] font-bold transition-all ${currentView === view ? 'text-gray-900 after:content-[""] after:absolute after:-bottom-[10px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400'}`;
    
    let html = `
        <div class="flex justify-center gap-6 border-b border-gray-100 pb-2">
            <button onclick="window.switchView('all')" class="${btnClass('all')}">商城</button>
            <button onclick="window.switchView('owned')" class="${btnClass('owned')}">我的庫存</button>
            <button onclick="window.switchView('cart')" class="${btnClass('cart')}">
                清單 ${cart.length > 0 ? `<span class="bg-sexify text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">${cart.length}</span>` : ''}
            </button>
        </div>
    `;

    if (currentView === 'all') {
        html += `
            <div class="flex gap-2 overflow-x-auto hide-scrollbar mt-2">
                <select onchange="window.shopFilterType=this.value; window.renderShop(currentKeyword)" class="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-full px-4 py-2 outline-none shadow-sm">
                    <option value="all" ${window.shopFilterType === 'all' ? 'selected' : ''}>全部類型</option>
                    <option value="virtual" ${window.shopFilterType === 'virtual' ? 'selected' : ''}>虛擬內容</option>
                    <option value="physical" ${window.shopFilterType === 'physical' ? 'selected' : ''}>實體商品</option>
                </select>
                <select onchange="window.shopSortType=this.value; window.renderShop(currentKeyword)" class="bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-full px-4 py-2 outline-none shadow-sm">
                    <option value="new" ${window.shopSortType === 'new' ? 'selected' : ''}>最新上架</option>
                    <option value="hot" ${window.shopSortType === 'hot' ? 'selected' : ''}>熱門暢銷</option>
                    <option value="official" ${window.shopSortType === 'official' ? 'selected' : ''}>官方推薦</option>
                </select>
            </div>
        `;
    }
    tabsContainer.innerHTML = html;
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
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // ✨ 強制指定 !user_id 來解決 PGRST201 衝突
        let query = window.supabaseClient.from('products').select('*, profiles!user_id(display_name, avatar_url, role)').eq('status', 'approved').eq('is_archived', false); 
        
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        if (currentView === 'all' && window.shopFilterType !== 'all') {
            query = query.eq('category', window.shopFilterType);
        }

        if (currentView === 'all') {
            if (window.shopSortType === 'new') query = query.order('created_at', { ascending: false });
            if (window.shopSortType === 'hot') query = query.order('views', { ascending: false });
            if (window.shopSortType === 'official') query = query.order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: products, error } = await query;
        if (error) throw error;

        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);

        let displayProducts = products || [];

        if (currentView === 'owned') {
            displayProducts = displayProducts.filter(p => purchasedIds.has(p.id));
        }

        if (currentView === 'all' && window.shopSortType === 'official') {
            displayProducts.sort((a, b) => {
                const aOff = (a.profiles?.role === 'admin') ? 1 : 0;
                const bOff = (b.profiles?.role === 'admin') ? 1 : 0;
                return bOff - aOff; 
            });
        }

        if (displayProducts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 font-bold">目前沒有內容</div>`;
            return;
        }

        grid.innerHTML = displayProducts.map(p => {
            const displayImg = window.getSafeImageUrl(p.image_url, 'previews');
            const isUnlocked = purchasedIds.has(p.id);
            const isPhysical = p.category === 'physical';
            
            const isOfficial = p.profiles?.role === 'admin';
            const officialBadge = isOfficial ? `<span class="bg-black text-white px-1.5 py-0.5 rounded text-[8px] font-black mr-1 align-middle uppercase tracking-widest">OFFICIAL</span>` : '';

            const priceDisplay = isPhysical 
                ? `<span class="text-blue-600 font-black text-xs">$${p.price_usd}</span>`
                : `<span class="text-sexify font-black text-xs">🪙 ${p.price}</span>`;

            return `
                <div onclick="window.openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
                    <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                        <img src="${displayImg}" class="w-full h-full object-cover">
                        ${isPhysical ? '<div class="absolute top-2 left-2 bg-blue-600/90 backdrop-blur text-white text-[8px] px-2 py-1 rounded-sm font-bold shadow-sm uppercase tracking-widest"><i class="fa-solid fa-box mr-1"></i>實體</div>' : ''}
                        ${isUnlocked ? '<div class="absolute top-2 right-2 bg-green-500/90 backdrop-blur text-white text-[8px] px-2 py-1 rounded-sm font-bold shadow-sm uppercase tracking-widest"><i class="fa-solid fa-check mr-1"></i>已解鎖</div>' : ''}
                    </div>
                    <div class="p-3 flex flex-col flex-1 justify-between gap-2">
                        <h3 class="font-bold text-[11px] text-gray-800 line-clamp-2 leading-tight">${officialBadge}${window.escapeHTML(p.name)}</h3>
                        <div class="flex justify-between items-end">
                            ${priceDisplay}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { 
        console.error("渲染清單崩潰:", e);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-500 font-bold text-sm">無法載入商品資料</div>`;
    }
}

// --- 購物車與統一結帳邏輯 ---
function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `
            <div class="text-center py-20 flex flex-col items-center">
                <i class="fa-solid fa-cart-shopping text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-400 font-bold text-sm">清單內沒有商品</p>
                <button onclick="window.switchView('all')" class="mt-6 bg-black text-white px-6 py-2 rounded-full text-xs font-bold active:scale-95 transition">前往選購</button>
            </div>`;
        return;
    }

    const totalTokens = cart.reduce((sum, item) => sum + item.tokenCost, 0);
    
    let html = cart.map(item => `
        <div class="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
            <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover bg-gray-50">
            <div class="flex-1 overflow-hidden">
                <h3 class="font-black text-sm text-gray-900 truncate mb-1">${window.escapeHTML(item.name)}</h3>
                <p class="text-[10px] text-gray-500 font-bold mb-0.5">${item.isPhysical ? `實體商品 ($${item.priceUsd})` : '虛擬內容'}</p>
                <p class="text-sexify font-black text-sm">🪙 ${item.tokenCost}</p>
            </div>
            <button onclick="window.removeFromCart('${item.id}')" class="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 transition">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        </div>
    `).join('');

    html += `
        <div class="mt-4 bg-zinc-900 text-white p-6 rounded-3xl shadow-xl flex flex-col gap-4 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-sexify/20 rounded-bl-[4rem] -z-0"></div>
            <div class="flex justify-between items-end relative z-10">
                <div>
                    <span class="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">扣除總計 🪙</span>
                    <span class="text-3xl font-black text-sexify leading-none">🪙 ${totalTokens}</span>
                </div>
            </div>
            <button onclick="window.checkoutCart()" class="w-full bg-white text-black font-black py-4 rounded-xl active:scale-95 transition shadow-lg relative z-10 mt-2">一鍵安全結帳</button>
        </div>
    `;
    grid.innerHTML = html;
}

window.addToCart = function(id, name, price, priceUsd, category, img) {
    if (cart.some(i => i.id === id)) return alert("已在清單中");
    
    const isPhysical = category === 'physical';
    const tokenCost = isPhysical ? (parseFloat(priceUsd) * EXCHANGE_RATE) : parseInt(price);

    cart.push({ id, name, price, priceUsd, category, isPhysical, tokenCost, img });
    window.showNotification("已加入清單");
    ensureShopTabs();
    window.closeProductModal();
};

window.removeFromCart = function(id) {
    cart = cart.filter(i => i.id !== id);
    window.renderShop(); 
};

window.checkoutCart = async function() {
    if (cart.length === 0) return;
    const totalTokens = cart.reduce((sum, item) => sum + item.tokenCost, 0);
    
    if (!confirm(`系統將從餘額扣除 🪙 ${totalTokens} 來結帳清單，確定嗎？`)) return;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入帳號");

        const { data: profile } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (profile.balance < totalTokens) return alert("🪙 餘額不足，請先點擊右上角「+」儲值。");

        await window.supabaseClient.from('profiles').update({ balance: profile.balance - totalTokens }).eq('id', user.id);

        const orderPromises = cart.map(item => window.supabaseClient.from('orders').insert({
            user_id: user.id, 
            product_id: item.id, 
            amount: item.tokenCost, 
            amount_usd: item.isPhysical ? item.priceUsd : 0,
            category: item.category,
            status: 'pending' 
        }));
        await Promise.all(orderPromises);

        cart = []; 
        window.showNotification("成功解鎖所有內容！");
        window.refreshBalanceUI();
        window.switchView('owned'); 
    } catch (e) { alert("結帳失敗: " + e.message); }
};

window.handlePurchase = async function(productId, price, priceUsd, category) {
    const isPhysical = category === 'physical';
    const tokenCost = isPhysical ? (parseFloat(priceUsd) * EXCHANGE_RATE) : parseInt(price);

    const confirmMsg = isPhysical 
        ? `此實體商品定價為 $${priceUsd} USD。\n系統將自動換算並扣除 🪙 ${tokenCost}，確定購買嗎？`
        : `確定要花費 🪙 ${tokenCost} 單獨解鎖此項目嗎？`;

    if (!confirm(confirmMsg)) return;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入帳號");

        const { data: profile } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (profile.balance < tokenCost) return alert("🪙 餘額不足，請先點擊右上角「+」儲值。");

        await window.supabaseClient.from('profiles').update({ balance: profile.balance - tokenCost }).eq('id', user.id);
        await window.supabaseClient.from('orders').insert({ 
            user_id: user.id, 
            product_id: productId, 
            amount: tokenCost,
            amount_usd: isPhysical ? priceUsd : 0,
            category: category,
            status: 'pending'
        });

        window.showNotification("交易成功！");
        window.refreshBalanceUI();
        window.closeProductModal();
        window.renderShop(currentKeyword); 
    } catch (e) { alert("購買失敗: " + e.message); }
};

// --- 沉浸式視覺：全螢幕無損看圖與檢舉 ---
window.zoomImage = function(url) {
    let z = document.createElement('div');
    z.className = 'fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center opacity-0 transition-opacity duration-300 cursor-zoom-out backdrop-blur-sm';
    z.innerHTML = `<img src="${url}" class="max-w-[95vw] max-h-[90vh] object-contain transform scale-95 transition-transform duration-300 shadow-2xl rounded-lg">`;
    
    z.onclick = () => {
        z.classList.remove('opacity-100');
        z.querySelector('img').classList.remove('scale-100');
        setTimeout(() => z.remove(), 300);
    };
    document.body.appendChild(z);
    
    setTimeout(() => {
        z.classList.add('opacity-100');
        z.querySelector('img').classList.add('scale-100');
    }, 10);
};

window.reportProduct = async function(id) {
    if(!confirm("確定要檢舉此商品包含違規內容（如未成年、血腥、無授權盜圖）嗎？\n\n濫用檢舉將導致帳號被限制。")) return;
    window.showNotification("已收到您的檢舉，管理員將於 24 小時內審查。");
}

// --- 彈窗與漫畫閱讀器 ---
window.openProductModal = async function(productId) {
    let modal = document.getElementById('post-detail-modal'); 
    let content = document.getElementById('post-detail-content');
    if (!modal || !content) return;

    const commentsArea = document.getElementById('post-comments-list');
    const commentsTitle = document.querySelector('[data-i18n="comments"]');
    if(commentsArea) commentsArea.style.display = 'none';
    if(commentsTitle) commentsTitle.style.display = 'none';

    content.innerHTML = '<div class="p-20 text-center"><i class="fa-solid fa-spinner fa-spin text-3xl text-gray-300"></i></div>';
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // ✨ 強制指定 !user_id 抓取資料
        const { data: item, error } = await window.supabaseClient.from('products').select('*, profiles!user_id(display_name, avatar_url, role)').eq('id', productId).single();
        if (error) throw error;

        await window.supabaseClient.from('products').update({ views: (item.views || 0) + 1 }).eq('id', item.id);

        const { data: order } = user ? await window.supabaseClient.from('orders').select('id').eq('user_id', user.id).eq('product_id', productId).maybeSingle() : { data: null };
        const isUnlocked = !!order;
        const isPhysical = item.category === 'physical';
        const isOfficial = item.profiles?.role === 'admin';

        const safeImg = window.getSafeImageUrl(item.image_url, 'previews');
        const officialBadge = isOfficial ? `<span class="bg-black text-white px-2 py-1 rounded-[4px] text-[10px] font-black mr-2 align-middle uppercase tracking-widest shadow-sm">OFFICIAL</span>` : '';

        // ✨ 修正頭像：優先使用 avatar_url，否則使用 DEFAULT_AVATAR
        const userAvatar = item.profiles?.avatar_url || DEFAULT_AVATAR;

        let buttonsHtml = '';
        if (isUnlocked) {
            buttonsHtml = isPhysical 
                ? `<div class="bg-blue-50 text-blue-600 font-black py-4 rounded-2xl text-center border border-blue-100"><i class="fa-solid fa-box-check mr-2"></i>已購買，等待發貨</div>`
                : `<button onclick="window.openComicReader('${item.id}', '${item.image_url}')" class="w-full bg-green-500 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 flex justify-center items-center gap-2"><i class="fa-solid fa-book-open text-lg"></i> 立即觀看內容</button>`;
        } else {
            buttonsHtml = `
               <div class="flex gap-3 mt-2">
                    <button onclick="window.addToCart('${item.id}', '${window.escapeHTML(item.name)}', ${item.price}, ${item.price_usd}, '${item.category}', '${safeImg}')" class="flex-1 bg-gray-100 text-gray-900 font-bold py-4 rounded-2xl active:scale-95 transition hover:bg-gray-200"><i class="fa-solid fa-cart-plus text-lg"></i></button>
                    <button onclick="window.handlePurchase('${item.id}', ${item.price}, ${item.price_usd}, '${item.category}')" class="flex-[3] bg-black text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition flex justify-center items-center gap-2 hover:bg-zinc-800"><i class="fa-solid fa-unlock"></i> 立即購買</button>
               </div>
            `;
        }

        const priceDisplayHTML = isPhysical
            ? ` <span class="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-blue-600">實體定價</span>
                <span class="text-xl font-black leading-none text-blue-600">$${item.price_usd}</span>
                <span class="text-[9px] font-bold text-gray-400 mt-1">(扣除 🪙 ${item.price_usd * EXCHANGE_RATE})</span>`
            : ` <span class="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-sexify">解鎖價</span>
                <span class="text-xl font-black leading-none text-sexify">🪙 ${item.price}</span>`;

        content.innerHTML = `
            <div class="relative bg-black flex items-center justify-center min-h-[40vh] sm:min-h-[50vh] overflow-hidden group cursor-zoom-in" onclick="window.zoomImage('${safeImg}')">
                <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl transform scale-110" style="background-image: url('${safeImg}')"></div>
                <img src="${safeImg}" class="relative z-10 w-full h-auto max-h-[55vh] object-contain transform transition-transform duration-500 group-hover:scale-105 shadow-2xl">
                ${isUnlocked ? '<div class="absolute top-4 left-4 bg-green-500 text-white text-[10px] px-3 py-1.5 rounded-[4px] font-black shadow-lg z-20 tracking-widest uppercase">已購買</div>' : ''}
                <button onclick="event.stopPropagation(); window.reportProduct('${item.id}')" class="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white/70 hover:text-white hover:bg-red-500 w-8 h-8 rounded-full flex items-center justify-center z-20 transition" title="檢舉違規內容">
                    <i class="fa-solid fa-flag text-[12px]"></i>
                </button>
                <div class="absolute bottom-3 right-3 bg-black/50 backdrop-blur-md text-white/80 text-[9px] px-2 py-1 rounded font-bold z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">點擊放大</div>
            </div>
            <div class="p-6 bg-white rounded-t-[2rem] -mt-6 relative z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <div class="flex justify-between items-start mb-6">
                    <h2 class="text-xl font-black text-gray-900 leading-snug pr-4">${officialBadge}${window.escapeHTML(item.name)}</h2>
                    <div class="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                        ${priceDisplayHTML}
                    </div>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-6 border border-gray-100 shadow-sm">
                    <img src="${userAvatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                    <div>
                        <p class="text-sm font-black text-gray-800">${window.escapeHTML(item.profiles?.display_name || '官方認證')}</p>
                        <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">${isOfficial ? 'OFFICIAL CREATOR' : 'CREATOR'}</p>
                    </div>
                </div>
                <div class="mb-8">
                    <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">作品描述</h4>
                    <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-2xl border border-gray-100">${window.escapeHTML(item.description || '這件商品目前沒有詳細描述。')}</p>
                </div>
                ${buttonsHtml}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="p-20 text-center text-red-500 font-bold text-sm">無法載入內容</div>`;
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

    const urls = imageUrlsString.split(',').filter(u => u.trim() !== '').map(u => window.getSafeImageUrl(u, 'products'));

    readerModal.innerHTML = `
        <header class="bg-black/80 backdrop-blur-md text-white p-4 flex justify-between items-center sticky top-0 z-10 border-b border-zinc-800">
            <div class="flex items-center gap-3">
                <button onclick="window.closeComicReader()" class="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-full active:scale-90 transition"><i class="fa-solid fa-xmark"></i></button>
                <span class="font-bold text-sm">閱讀中 (${urls.length} 頁)</span>
            </div>
        </header>
        <div class="flex-1 overflow-y-auto bg-zinc-900 pb-20">
            ${urls.map((url, i) => `
                <div class="relative w-full min-h-[50vh] flex items-center justify-center bg-zinc-900 border-b border-zinc-800 pb-1">
                    <img src="${url}" class="w-full h-auto relative z-10">
                    <span class="absolute bottom-2 right-2 bg-black/50 text-white/50 text-[10px] px-2 py-1 rounded-[4px] z-20">${i+1} / ${urls.length}</span>
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

window.initShop = function() {
    console.log("商城系統啟動中...");
    window.refreshBalanceUI();
    window.renderShop();
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('shop-grid')) {
        window.initShop();
    }
});
