/**
 * shop.js - 專業商城正式營運版 (完美融合版)
 * 包含：進階篩選、實體美金/虛擬代幣結算、創作者資訊、官方認證、防 CORS 頭像、特價視覺、下架過濾、漫畫閱讀器
 */

let cart = []; 
let currentView = 'all'; // 'all', 'cart', 'owned'
let currentKeyword = ''; 

window.shopFilterType = 'all'; 
window.shopSortType = 'new';   

const WORKER_URL = "https://sexify-uploader.poisonfairydaily.workers.dev";
const EXCHANGE_RATE = 20; // 1 USD = 20 代幣

// ✨ 防 CORS 與破圖的預設頭像解決方案 (DiceBear)
window.getAvatar = function(url, name) {
    if (url && !url.includes('ui-avatars.com')) return url;
    const seed = name ? encodeURIComponent(name) : 'U';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=eeeeee&textColor=999999`;
}

// --- 🛡️ 安全核心與輔助函數 ---
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
    n.className = 'fixed top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white px-6 py-2 rounded-full text-[10px] font-bold z-[6000] shadow-lg tracking-wider transition-opacity duration-300';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => {
        n.classList.add('opacity-0');
        setTimeout(() => n.remove(), 300);
    }, 1500);
}

/**
 * 0. 基礎功能：餘額與初始化
 */
window.refreshBalanceUI = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;
        const { data } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        const balanceDisplay = document.getElementById('user-balance');
        const shopBalance = document.getElementById('shop-balance-display');
        const pcBalance = document.getElementById('pc-balance');
        
        if (balanceDisplay) balanceDisplay.innerText = data?.balance ?? 0;
        if (shopBalance) shopBalance.innerText = data?.balance ?? 0;
        if (pcBalance) pcBalance.innerText = data?.balance ?? 0;
    } catch (err) { console.error(err); }
};

window.closeProductModal = () => {
    const modal = document.getElementById('product-modal-container');
    if (modal) {
        modal.innerHTML = ''; 
        modal.style.display = 'none';
    }
    document.body.style.overflow = ''; 
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeProductModal();
});

document.addEventListener('DOMContentLoaded', window.refreshBalanceUI);

/**
 * 1. 頁籤切換邏輯 (含下拉進階篩選)
 */
function ensureShopTabs() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    let tabsContainer = document.getElementById('shop-custom-tabs');
    if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'shop-custom-tabs';
        tabsContainer.className = 'flex flex-col gap-4 mb-6 z-10 relative';
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

    // 只有在「商城」視圖才顯示篩選器
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

/**
 * 2. 商城主渲染
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

/**
 * 3. 渲染網格 (完美整合所有功能)
 */
async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // ✨ 強制連結 profiles 以取得創作者名字、大頭貼、角色
        let query = window.supabaseClient.from('products').select('*, profiles!user_id(display_name, avatar_url, role)')
            .eq('status', 'approved')
            .eq('is_archived', false); 

        if (keyword) query = query.ilike('name', `%${keyword}%`);
        
        // 類別篩選
        if (currentView === 'all' && window.shopFilterType !== 'all') {
            query = query.eq('category', window.shopFilterType);
        }

        // 排序邏輯
        if (currentView === 'all') {
            if (window.shopSortType === 'new') query = query.order('created_at', { ascending: false });
            if (window.shopSortType === 'hot') query = query.order('views', { ascending: false });
            if (window.shopSortType === 'official') query = query.order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: products } = await query;
        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const { data: profile } = user ? await window.supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null };
        
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);
        const isAdmin = profile?.is_admin || false;

        let displayProducts = products || [];
        
        if (currentView === 'owned') {
            const { data: ownedProducts } = await window.supabaseClient.from('products').select('*, profiles!user_id(display_name, avatar_url, role)').in('id', Array.from(purchasedIds));
            displayProducts = ownedProducts || [];
        }

        // 官方推薦置頂處理
        if (currentView === 'all' && window.shopSortType === 'official') {
            displayProducts.sort((a, b) => {
                const aOff = (a.profiles?.role === 'admin') ? 1 : 0;
                const bOff = (b.profiles?.role === 'admin') ? 1 : 0;
                return bOff - aOff; 
            });
        }

        if (displayProducts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 font-bold text-sm">目前沒有內容</div>`;
            return;
        }

        const unlockableFiles = displayProducts
            .filter(p => purchasedIds.has(p.id) || isAdmin)
            .map(p => p.image_url?.split(',')[0]) 
            .filter(Boolean);

        let signedMap = {};
        if (unlockableFiles.length > 0) {
            const { data: sData } = await window.supabaseClient.storage.from('products').createSignedUrls(unlockableFiles, 3600);
            sData?.forEach(item => signedMap[item.path] = item.signedUrl);
        }

        grid.innerHTML = displayProducts.map(p => {
            const firstFileName = p.image_url?.split(',')[0];
            const isUnlocked = purchasedIds.has(p.id) || isAdmin;
            
            let displayImg;
            if (isUnlocked && signedMap[firstFileName]) {
                displayImg = signedMap[firstFileName];
            } else {
                displayImg = window.getSafeImageUrl(p.image_url, 'previews');
            }

            // ✨ 創作者與認證邏輯
            const creatorName = p.profiles?.display_name || 'Creator';
            const creatorAvatar = window.getAvatar(p.profiles?.avatar_url, creatorName);
            const isOfficial = p.profiles?.role === 'admin';
            
            // ✨ 實體商品與美金邏輯
            const isPhysical = p.category === 'physical';
            const originalPriceNum = p.original_price || Math.ceil((isPhysical ? p.price_usd : p.price) * 1.25);
            
            const originalPriceDisplay = isPhysical ? `$${originalPriceNum}` : `🪙 ${originalPriceNum}`;
            const currentPriceDisplay = isPhysical 
                ? `<span class="text-blue-600 font-black text-xs">$${p.price_usd}</span>`
                : `<span class="text-sexify font-black text-xs">🪙 ${p.price}</span>`;

            return `
                <div onclick="openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95 hover:shadow-md">
                    <div class="aspect-square w-full overflow-hidden bg-gray-50 relative">
                        <img src="${displayImg}" class="w-full h-full object-cover transition-all duration-700">
                        ${isOfficial ? `<div class="absolute top-2 left-2 bg-black/80 backdrop-blur text-white text-[8px] font-black px-2 py-1 rounded-sm uppercase tracking-widest z-10"><i class="fa-solid fa-crown text-yellow-400 mr-1"></i>Official</div>` : ''}
                        ${isPhysical && !isOfficial ? `<div class="absolute top-2 left-2 bg-blue-600/90 backdrop-blur text-white text-[8px] font-black px-2 py-1 rounded-sm uppercase tracking-widest z-10"><i class="fa-solid fa-box mr-1"></i>實體</div>` : ''}
                    </div>
                    <div class="p-3 flex flex-col justify-between flex-1">
                        <div>
                            <div class="flex items-center gap-1.5 mb-1.5">
                                <img src="${creatorAvatar}" class="w-4 h-4 rounded-full border border-gray-100 object-cover">
                                <span class="text-[9px] text-gray-500 font-bold truncate">${window.escapeHTML(creatorName)}</span>
                                ${isOfficial ? '<i class="fa-solid fa-circle-check text-blue-500 text-[8px]" title="官方認證"></i>' : ''}
                            </div>
                            <h3 class="font-bold text-[11px] text-gray-900 line-clamp-2 leading-tight">${window.escapeHTML(p.name)}</h3>
                        </div>
                        <div class="flex justify-between items-end mt-2">
                            <div class="flex flex-col">
                                <span class="text-[9px] text-gray-400 line-through decoration-gray-300 font-bold">${originalPriceDisplay}</span>
                                ${currentPriceDisplay}
                            </div>
                            ${isUnlocked ? '<span class="bg-green-100 text-green-600 text-[9px] px-2 py-1 rounded font-black">已解鎖</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { 
        console.error(e);
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-500 font-bold text-sm">無法載入商品資料</div>`;
    }
}

/**
 * 4. 商品入口 (處理已購買與未購買)
 */
window.openProductModal = async function(productId) {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    
    // 確保抓取 profile 資料
    const { data: p } = await window.supabaseClient.from('products').select('*, profiles!user_id(display_name, avatar_url, role)').eq('id', productId).single();
    if (!p) return;

    // 增加觀看次數
    await window.supabaseClient.from('products').update({ views: (p.views || 0) + 1 }).eq('id', p.id);

    const { data: order } = user ? await window.supabaseClient.from('orders').select('id').eq('product_id', productId).eq('user_id', user.id).single() : { data: null };
    const { data: profile } = user ? await window.supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null };
    const isUnlocked = order || profile?.is_admin;

    let modal = document.getElementById('product-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-modal-container';
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';

    if (isUnlocked && currentView === 'owned' && p.category !== 'physical') {
        renderMangaViewer(modal, p);
    } else {
        renderPurchaseModal(modal, p, isUnlocked);
    }
};

/**
 * 漫畫讀閱模式
 */
async function renderMangaViewer(modal, p) {
    const fileNames = p.image_url ? p.image_url.split(',') : []; 
    const { data: sData } = await window.supabaseClient.storage.from('products').createSignedUrls(fileNames, 7200);

    const imgTags = sData ? sData.map((item, idx) => `
        <div class="manga-page-container relative mb-1" data-page="${idx + 1}">
            <img src="${item.signedUrl}" class="manga-page" loading="lazy" style="width:100%; max-width:800px; margin: 0 auto; display:block;">
            <div class="text-[9px] text-gray-700 text-center py-2 bg-black">PAGE ${idx + 1} / ${fileNames.length}</div>
        </div>
    `).join('') : '<p class="text-white text-center py-20">載入圖片中...</p>';

    modal.innerHTML = `
        <div id="manga-viewport" class="fixed inset-0 bg-black z-[5000] overflow-y-auto scroll-smooth flex flex-col">
            <div class="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-[9999] pointer-events-none">
                <div class="flex gap-2 pointer-events-auto">
                    <div onclick="window.closeProductModal()" class="bg-black/50 text-white w-10 h-10 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md border border-white/10">
                        <i class="fa-solid fa-xmark"></i>
                    </div>
                    <div id="page-counter" class="bg-black/50 text-white px-4 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 text-xs font-bold tracking-widest">
                        1 / ${fileNames.length}
                    </div>
                </div>
                <div onclick="window.reportProduct('${p.id}')" class="pointer-events-auto bg-red-500/20 text-red-500 px-4 h-10 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md text-[10px] font-bold border border-red-500/30">
                    檢舉
                </div>
            </div>
            <div class="flex-1 pt-2">
                <div class="text-center py-10">
                    <h2 class="text-white font-bold text-lg">${window.escapeHTML(p.name)}</h2>
                    <p class="text-gray-500 text-[10px] mt-1 tracking-[0.2em]">HIGH DEFINITION</p>
                </div>
                <div class="bg-black">${imgTags}</div>
                <div class="text-center text-gray-800 text-[10px] py-20 tracking-widest">THE END</div>
            </div>
        </div>
    `;

    document.body.style.overflow = 'hidden';

    const viewport = document.getElementById('manga-viewport');
    const pageCounter = document.getElementById('page-counter');
    const pageContainers = document.querySelectorAll('.manga-page-container');

    viewport.onscroll = () => {
        let current = 1;
        pageContainers.forEach(container => {
            const rect = container.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2) {
                current = container.getAttribute('data-page');
            }
        });
        pageCounter.innerText = `${current} / ${fileNames.length}`;
    };
}

/**
 * 購買詳情彈窗 (保留你的版面，寫入所有新邏輯)
 */
async function renderPurchaseModal(modal, p, isUnlocked) {
    const firstFileName = p.image_url?.split(',')[0];
    let displayImg;
    if (isUnlocked) {
        const { data } = await window.supabaseClient.storage.from('products').createSignedUrl(firstFileName, 600);
        displayImg = data?.signedUrl;
    } else {
        displayImg = window.getSafeImageUrl(p.image_url, 'previews');
    }

    const creatorName = p.profiles?.display_name || 'Creator';
    const creatorAvatar = window.getAvatar(p.profiles?.avatar_url, creatorName);
    const isOfficial = p.profiles?.role === 'admin';
    const isPhysical = p.category === 'physical';
    
    // 計算代幣扣除與原價顯示
    const tokenCost = isPhysical ? (parseFloat(p.price_usd) * EXCHANGE_RATE) : parseInt(p.price);
    const originalPriceNum = p.original_price || Math.ceil((isPhysical ? p.price_usd : p.price) * 1.25);
    
    const originalPriceDisplay = isPhysical ? `$${originalPriceNum}` : `🪙 ${originalPriceNum}`;
    const currentPriceDisplay = isPhysical ? `$${p.price_usd}` : `🪙 ${p.price}`;

    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-[3500] flex items-center justify-center p-4 backdrop-blur-sm" onclick="window.closeProductModal()">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden relative shadow-2xl" onclick="event.stopPropagation()">
                <div class="relative aspect-square bg-gray-50">
                    <img src="${displayImg}" class="w-full h-full object-cover">
                    <div class="absolute top-4 left-4">
                        <div onclick="window.reportProduct('${p.id}')" class="bg-black/20 text-white/70 px-3 py-1.5 rounded-full text-[9px] backdrop-blur-md cursor-pointer hover:bg-red-500 hover:text-white transition-all font-bold">檢舉</div>
                    </div>
                    <div onclick="window.closeProductModal()" class="absolute top-4 right-4 bg-black/20 text-white w-8 h-8 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md">
                        <i class="fa-solid fa-xmark"></i>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4 border border-gray-100">
                        <img src="${creatorAvatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                        <div>
                            <p class="text-sm font-black text-gray-800 flex items-center gap-1">
                                ${window.escapeHTML(creatorName)} 
                                ${isOfficial ? '<i class="fa-solid fa-circle-check text-blue-500 text-xs"></i>' : ''}
                            </p>
                            <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">${isOfficial ? '官方認證' : '創作者'}</p>
                        </div>
                    </div>

                    <h2 class="text-lg font-black text-gray-900 leading-tight">${window.escapeHTML(p.name)}</h2>
                    <p class="text-gray-400 text-xs mt-2 font-bold">${isPhysical ? '📦 實體商品 (需填寫收貨資訊)' : `包含 ${p.image_url?.split(',').length || 1} 項高清數位內容`}</p>
                    
                    <div class="mt-6 flex flex-col gap-4">
                        <div class="flex items-end gap-2 bg-gray-50 p-3 rounded-xl ${isPhysical ? 'border border-blue-50' : 'border border-red-50'}">
                            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">限時特價</span>
                            <div class="flex flex-col items-end flex-1">
                                <span class="text-[10px] text-gray-400 line-through decoration-gray-300 font-bold leading-none">${originalPriceDisplay}</span>
                                <span class="${isPhysical ? 'text-blue-600' : 'text-sexify'} font-black text-2xl leading-none mt-1">${currentPriceDisplay}</span>
                                ${isPhysical ? `<span class="text-[9px] text-gray-400 font-bold mt-1">(結帳自動扣除 🪙 ${tokenCost})</span>` : ''}
                            </div>
                        </div>

                        <div class="flex gap-2">
                            ${!isUnlocked ? `
                                <button onclick="addToCart('${p.id}', '${window.escapeHTML(p.name).replace(/'/g, "\\'")}', ${p.price}, ${p.price_usd || 0}, '${p.category}', '${displayImg}')" class="bg-gray-100 text-gray-800 px-4 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center active:scale-95 transition"><i class="fa-solid fa-cart-plus"></i></button>
                                <button onclick="executeSecurePurchase('${p.id}', '${window.escapeHTML(p.name).replace(/'/g, "\\'")}', ${tokenCost}, ${p.price_usd || 0}, '${p.category}')" class="flex-1 bg-black text-white px-6 py-3.5 rounded-xl font-black text-sm active:scale-95 transition flex items-center justify-center gap-2"><i class="fa-solid fa-unlock"></i> 立即解鎖</button>
                            ` : `
                                <button onclick="window.switchView('owned'); window.closeProductModal();" class="w-full bg-black text-white py-3.5 rounded-xl font-black text-sm active:scale-95 transition">${isPhysical ? '已購買，等待發貨' : '前往庫存觀看'}</button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.style.overflow = 'hidden';
}

/**
 * 檢舉、購買、購物車邏輯
 */
window.reportProduct = async function(productId) {
    const reason = prompt("請說明檢舉原因 (濫用檢舉將被限制帳號)：");
    if (!reason) return;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入帳號");
        const { error } = await window.supabaseClient.from('reports').insert([{
            product_id: productId, reporter_id: user.id, reason: reason
        }]);
        if (error) throw error;
        alert("📢 感謝檢舉，我們將儘速審核。");
    } catch (e) { alert("檢舉失敗"); }
};

// ✨ 使用 JS 端完整結算，完美支援實體美金轉代幣與虛擬代幣
window.executeSecurePurchase = async function(productId, itemName, tokenCost, priceUsd, category) {
    const isPhysical = category === 'physical';
    const confirmMsg = isPhysical 
        ? `此實體商品定價為 $${priceUsd} USD。\n系統將自動換算並扣除 🪙 ${tokenCost}，確定購買嗎？`
        : `確定要消耗 🪙 ${tokenCost} 解鎖「${itemName}」嗎？`;

    if (!confirm(confirmMsg)) return;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入帳號");

        const { data: profile } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        if (profile.balance < tokenCost) return alert("🪙 餘額不足，請先點擊右上角「+」儲值。");

        // 扣除代幣
        await window.supabaseClient.from('profiles').update({ balance: profile.balance - tokenCost }).eq('id', user.id);
        
        // 建立訂單
        await window.supabaseClient.from('orders').insert({ 
            user_id: user.id, 
            product_id: productId, 
            amount: tokenCost,
            amount_usd: isPhysical ? priceUsd : 0,
            category: category,
            status: 'pending'
        });

        window.showNotification("🎉 解鎖成功！");
        window.closeProductModal();
        window.refreshBalanceUI();
        window.renderShop(currentKeyword); 
    } catch (e) { alert("交易異常: " + e.message); }
};

window.addToCart = function(id, name, price, priceUsd, category, img) {
    if (cart.some(i => i.id === id)) return alert("已在清單中");
    
    const isPhysical = category === 'physical';
    const tokenCost = isPhysical ? (parseFloat(priceUsd) * EXCHANGE_RATE) : parseInt(price);

    cart.push({ id, name, price, priceUsd, category, isPhysical, tokenCost, img });
    window.showNotification("已加入清單");
    ensureShopTabs();
    window.closeProductModal();
};

function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold text-sm">清單目前是空的</div>`;
        return;
    }
    const totalTokens = cart.reduce((sum, item) => sum + item.tokenCost, 0);
    grid.innerHTML = `
        <div class="space-y-3">
            ${cart.map((item, idx) => `
                <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
                    <img src="${item.img}" class="w-14 h-14 rounded-lg object-cover bg-gray-50">
                    <div class="flex-1 overflow-hidden">
                        <h4 class="text-xs font-black text-gray-800 truncate">${window.escapeHTML(item.name)}</h4>
                        <p class="text-[10px] text-gray-500 font-bold mb-0.5">${item.isPhysical ? `實體商品 ($${item.priceUsd})` : '虛擬內容'}</p>
                        <span class="text-sexify font-black text-xs">🪙 ${item.tokenCost}</span>
                    </div>
                    <button onclick="window.removeFromCart(${idx})" class="text-gray-300 px-2 active:scale-90"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('')}
            <div class="mt-6 p-6 bg-zinc-900 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                <div class="absolute right-0 top-0 w-24 h-24 bg-sexify/20 rounded-bl-[4rem] -z-0"></div>
                <div class="flex justify-between items-end mb-4 relative z-10">
                    <span class="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">扣除總計</span>
                    <span class="text-sexify font-black text-2xl leading-none">🪙 ${totalTokens}</span>
                </div>
                <button onclick="window.checkoutCart()" class="w-full bg-white text-black font-black py-4 rounded-xl text-sm active:scale-95 transition relative z-10">一鍵安全結帳</button>
            </div>
        </div>
    `;
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); window.renderShop(); };

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

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('shop-grid')) {
        window.refreshBalanceUI();
        window.renderShop();
    }
});
