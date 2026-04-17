/**
 * shop.js - 專業商城最終版 (含創作者審核過濾邏輯)
 */

let cart = []; 
let currentView = 'all'; // 'all', 'cart', 'owned'
let currentKeyword = ''; 

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
        if (balanceDisplay) balanceDisplay.innerText = data?.balance ?? 0;
        if (shopBalance) shopBalance.innerText = data?.balance ?? 0;
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
 * 1. 頁籤切換邏輯
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
        <button onclick="switchView('all')" class="${btnClass('all')}">商城</button>
        <button onclick="switchView('owned')" class="${btnClass('owned')}">我的庫存</button>
        <button onclick="switchView('cart')" class="${btnClass('cart')}">
            清單 ${cart.length > 0 ? `<span class="bg-sexify text-white text-[9px] px-1.5 py-0.5 rounded-full">${cart.length}</span>` : ''}
        </button>
    `;
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
        grid.className = "grid grid-cols-1 gap-4"; 
        renderCartInline(grid);
    } else {
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4";
        renderProductGrid(grid, filterKeyword);
    }
};

/**
 * 3. 渲染網格 (只抓取 approved 商品)
 */
async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // ✨ 核心修改：只顯示狀態為 'approved' 的商品
        let query = window.supabaseClient
            .from('products')
            .select('*')
            .eq('status', 'approved'); 
            
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        const { data: products } = await query.order('created_at', { ascending: false });

        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const { data: profile } = user ? await window.supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null };
        
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);
        const isAdmin = profile?.is_admin || false;

        let displayProducts = products || [];
        if (currentView === 'owned') {
            displayProducts = products.filter(p => purchasedIds.has(p.id));
        }

        if (displayProducts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">目前沒有內容</div>`;
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
                const { data } = window.supabaseClient.storage.from('previews').getPublicUrl(firstFileName);
                displayImg = data.publicUrl;
            }
            
            return `
                <div onclick="openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
                    <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                        <img src="${displayImg}" class="w-full h-full object-cover transition-all duration-700">
                    </div>
                    <div class="p-3">
                        <h3 class="font-bold text-[11px] text-gray-800 line-clamp-1">${p.name}</h3>
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-sexify font-black text-xs">🪙 ${p.price}</span>
                            ${isUnlocked ? '<span class="text-green-500 text-[9px] font-bold">已解鎖</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { console.error(e); }
}

/**
 * 4. 商品詳情 / 漫畫讀閱入口
 */
window.openProductModal = async function(productId) {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!p) return;

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

    if (isUnlocked && currentView === 'owned') {
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
    const { data: sData } = await window.supabaseClient.storage
        .from('products')
        .createSignedUrls(fileNames, 7200);

    const imgTags = sData ? sData.map(item => `
        <img src="${item.signedUrl}" class="manga-page" loading="lazy" style="width:100%; max-width:800px; margin: 0 auto 1px; display:block;">
    `).join('') : '<p class="text-white text-center py-20">載入圖片中...</p>';

    modal.innerHTML = `
        <div class="fixed inset-0 bg-black z-[5000] overflow-hidden flex flex-col">
            <div onclick="window.closeProductModal()" class="manga-close" style="position:fixed; top:20px; right:20px; z-index:9999; background:rgba(0,0,0,0.5); width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; cursor:pointer; backdrop-filter:blur(5px);">
                <i class="fa-solid fa-xmark text-xl"></i>
            </div>
            <div class="flex-1 overflow-y-auto pt-4">
                <div class="text-center py-6">
                    <h2 class="text-white font-bold text-lg">${p.name}</h2>
                    <p class="text-gray-500 text-[10px] mt-1">HD FULL GALLERY (${fileNames.length}P)</p>
                </div>
                <div class="bg-black">
                    ${imgTags}
                </div>
                <div class="text-center text-gray-700 text-[10px] py-10">THE END</div>
            </div>
        </div>
    `;
    document.body.style.overflow = 'hidden';
}

/**
 * 購買詳情彈窗
 */
async function renderPurchaseModal(modal, p, isUnlocked) {
    const firstFileName = p.image_url?.split(',')[0];
    let displayImg;
    
    if (isUnlocked) {
        const { data } = await window.supabaseClient.storage.from('products').createSignedUrl(firstFileName, 600);
        displayImg = data?.signedUrl;
    } else {
        const { data } = window.supabaseClient.storage.from('previews').getPublicUrl(firstFileName);
        displayImg = data.publicUrl;
    }

    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-[3500] flex items-center justify-center p-4 backdrop-blur-sm" onclick="window.closeProductModal()">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden relative shadow-2xl" onclick="event.stopPropagation()">
                <div class="relative aspect-square">
                    <img src="${displayImg}" class="w-full h-full object-cover">
                    <div onclick="window.closeProductModal()" class="absolute top-4 right-4 bg-black/10 text-white w-8 h-8 rounded-full flex items-center justify-center cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </div>
                </div>
                <div class="p-6">
                    <h2 class="text-xl font-bold text-gray-900">${p.name}</h2>
                    <p class="text-gray-400 text-xs mt-2">解鎖後可觀看全部 ${p.image_url?.split(',').length || 1} 張高清內容</p>
                    <div class="mt-6 flex items-center justify-between">
                        <span class="text-sexify font-black text-2xl">🪙 ${p.price}</span>
                        <div class="flex gap-2">
                            ${!isUnlocked ? `
                                <button onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${displayImg}')" class="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-xs">加入清單</button>
                                <button onclick="executeSecurePurchase('${p.id}', '${p.name}')" class="bg-sexify text-white px-6 py-3 rounded-xl font-bold text-xs">立即解鎖</button>
                            ` : `
                                <button onclick="window.switchView('owned'); window.closeProductModal();" class="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs">前往庫存查看</button>
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
 * 5. 安全購買 RPC
 */
window.executeSecurePurchase = async function(itemId, itemName) {
    if (!confirm(`確定要消耗 🪙 購買「${itemName}」嗎？`)) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('process_purchase', { p_item_id: itemId, p_quantity: 1 });
        if (error) throw error;
        if (data.success) {
            alert("🎉 解鎖成功！請至我的庫存查看內容。");
            window.closeProductModal();
            window.refreshBalanceUI();
            window.renderShop();
        } else {
            alert(data.message);
        }
    } catch (e) { alert("交易異常，請稍後再試"); }
};

/**
 * 6. 購物車與通知
 */
window.addToCart = function(id, name, price, img) {
    cart.push({ id, name, price, img });
    showNotification(`已加入待買清單`);
    ensureShopTabs();
    window.closeProductModal();
};

function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `<div class="text-center py-20 text-gray-400">清單目前是空的</div>`;
        return;
    }
    const total = cart.reduce((s, i) => s + i.price, 0);
    grid.innerHTML = `
        <div class="space-y-3">
            ${cart.map((item, idx) => `
                <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <img src="${item.img}" class="w-14 h-14 rounded-lg object-cover">
                    <div class="flex-1"><h4 class="text-xs font-bold">${item.name}</h4><span class="text-sexify font-bold text-xs">🪙 ${item.price}</span></div>
                    <button onclick="removeFromCart(${idx})" class="text-gray-300 px-2"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('')}
            <div class="mt-6 p-6 bg-gray-50 rounded-[2rem]">
                <div class="flex justify-between mb-4"><span class="text-gray-500 text-xs">合計金額</span><span class="text-sexify font-black text-xl">🪙 ${total.toFixed(1)}</span></div>
                <button onclick="alert('請點擊商品進入詳情頁完成購買')" class="w-full bg-black text-white font-bold py-4 rounded-2xl text-xs">請逐一完成購買</button>
            </div>
        </div>
    `;
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); window.renderShop(); };

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-12 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-[10px] font-bold z-[6000]';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 1500);
}

document.addEventListener('DOMContentLoaded', () => window.renderShop());
