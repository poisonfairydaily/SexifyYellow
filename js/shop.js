/**
 * shop.js - 專業商修復版 (包含：方案2模糊效果、我的庫存、權限自動判定)
 */

let cart = []; 
let currentView = 'all'; // 'all', 'cart', 'owned'
let currentKeyword = ''; 

/**
 * 0. 支付與餘額邏輯 (保留原功能)
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
document.addEventListener('DOMContentLoaded', window.refreshBalanceUI);

/**
 * 1. 頁籤邏輯 (新增：我的庫存按鈕)
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
    renderShop(currentKeyword);
};

/**
 * 2. 商城主渲染入口
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
 * 3. 渲染網格 (方案 2 視覺實現)
 */
async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        // 1. 抓取所有商品
        let query = window.supabaseClient.from('products').select('*');
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        const { data: products } = await query.order('created_at', { ascending: false });

        // 2. 抓取已購買紀錄與管理員權限
        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const { data: profile } = user ? await window.supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null };
        
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);
        const isAdmin = profile?.is_admin || false;

        // 如果是「我的庫存」模式，過濾掉未購買的
        let displayProducts = products;
        if (currentView === 'owned') {
            displayProducts = products.filter(p => purchasedIds.has(p.id));
            if (displayProducts.length === 0) {
                grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">尚未擁有任何商品</div>`;
                return;
            }
        }

        // 3. 獲取簽名網址 (僅針對已購買或管理員)
        const unlockableFiles = displayProducts
            .filter(p => purchasedIds.has(p.id) || isAdmin)
            .map(p => p.image_url?.split('/').pop())
            .filter(Boolean);

        let signedMap = {};
        if (unlockableFiles.length > 0) {
            const { data: sData } = await window.supabaseClient.storage.from('products').createSignedUrls(unlockableFiles, 3600);
            sData?.forEach(item => signedMap[item.path] = item.signedUrl);
        }

        grid.innerHTML = displayProducts.map(p => {
            const fileName = p.image_url?.split('/').pop();
            const isUnlocked = purchasedIds.has(p.id) || isAdmin;
            const finalImg = signedMap[fileName] || p.image_url; // 沒簽名就用原始 URL (會被 RLS 擋住而模糊或顯示不出來)
            
            return `
                <div onclick="openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
                    <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                        <img src="${finalImg}" class="w-full h-full object-cover transition-all duration-700 ${!isUnlocked ? 'locked-blur' : ''}">
                        
                        ${!isUnlocked ? `
                            <div class="lock-overlay absolute inset-0 flex items-center justify-center">
                                <div class="bg-white/90 p-2.5 rounded-full shadow-lg">
                                    <i class="fa-solid fa-lock text-sexify text-sm"></i>
                                </div>
                            </div>
                        ` : ''}
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
 * 4. 商品詳情模態視窗
 */
window.openProductModal = async function(productId) {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!p) return;

    // 檢查權限
    const { data: order } = user ? await window.supabaseClient.from('orders').select('id').eq('product_id', productId).eq('user_id', user.id).single() : { data: null };
    const { data: profile } = user ? await window.supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single() : { data: null };
    const isUnlocked = order || profile?.is_admin;

    let displayImg = 'https://via.placeholder.com/300?text=Locked';
    const fileName = p.image_url?.split('/').pop();
    
    // 只有解鎖了才去拿簽名網址，否則給一張模糊的佔位圖
    if (isUnlocked && fileName) {
        const { data } = await window.supabaseClient.storage.from('products').createSignedUrl(fileName, 600);
        if (data) displayImg = data.signedUrl;
    } else {
        displayImg = p.image_url; // 會因為 Private Bucket + 無簽名而自動破圖/模糊
    }

    let modal = document.getElementById('product-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-modal-container';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/80 z-[3500] flex items-center justify-center p-4 backdrop-blur-md" onclick="closeProductModal()">
            <div class="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden relative" onclick="event.stopPropagation()">
                <div class="relative aspect-square">
                    <img src="${displayImg}" class="w-full h-full object-cover ${!isUnlocked ? 'locked-blur' : ''}">
                    ${!isUnlocked ? '<div class="absolute inset-0 flex items-center justify-center"><i class="fa-solid fa-lock text-white text-4xl opacity-50"></i></div>' : ''}
                </div>
                <div class="p-6">
                    <h2 class="text-xl font-black text-gray-900">${p.name}</h2>
                    <p class="text-gray-500 text-xs mt-2 line-clamp-2">${p.description || '購買後即可解鎖完整高清內容'}</p>
                    <div class="mt-6 flex items-center justify-between">
                        <span class="text-sexify font-black text-2xl">🪙 ${p.price}</span>
                        <div class="flex gap-2">
                            ${!isUnlocked ? `
                                <button onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${displayImg}')" class="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-sm">加入清單</button>
                                <button onclick="executeSecurePurchase('${p.id}', '${p.name}')" class="bg-sexify text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-pink-200">立即解鎖</button>
                            ` : `
                                <button class="w-full bg-green-500 text-white px-10 py-3 rounded-xl font-bold">您已擁有此內容</button>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.style.overflow = 'hidden';
};

window.closeProductModal = () => {
    const modal = document.getElementById('product-modal-container');
    if (modal) modal.innerHTML = '';
    document.body.style.overflow = '';
};

/**
 * 5. 安全購買 RPC (保留原邏輯，加入成功後刷新)
 */
window.executeSecurePurchase = async function(itemId, itemName) {
    if (!confirm(`確定要消耗點數解鎖「${itemName}」嗎？`)) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('process_purchase', { p_item_id: itemId, p_quantity: 1 });
        if (error) throw error;
        if (data.success) {
            alert("🎉 解鎖成功！內容已存入您的庫存。");
            closeProductModal();
            window.refreshBalanceUI();
            renderShop(); // 重新渲染，圖片會變清晰
        } else {
            alert(data.message);
        }
    } catch (e) { alert("交易失敗"); }
};

/**
 * 6. 購物車邏輯 (保留原功能)
 */
window.addToCart = function(id, name, price, img) {
    cart.push({ id, name, price, img });
    showNotification(`已加入清單`);
    ensureShopTabs();
    closeProductModal();
};

function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `<div class="text-center py-20 text-gray-400">清單空空如也</div>`;
        return;
    }
    const total = cart.reduce((s, i) => s + i.price, 0);
    grid.innerHTML = `
        <div class="space-y-3">
            ${cart.map((item, idx) => `
                <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <img src="${item.img}" class="w-14 h-14 rounded-lg object-cover">
                    <div class="flex-1"><h4 class="text-xs font-bold">${item.name}</h4><span class="text-sexify font-bold text-xs">🪙 ${item.price}</span></div>
                    <button onclick="removeFromCart(${idx})" class="text-gray-300"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('')}
            <div class="mt-6 p-6 bg-gray-50 rounded-[2rem]">
                <div class="flex justify-between mb-4"><span class="text-gray-500">總計</span><span class="text-sexify font-black text-xl">🪙 ${total.toFixed(1)}</span></div>
                <button onclick="checkoutCart()" class="w-full bg-sexify text-white font-black py-4 rounded-2xl">確認結帳</button>
            </div>
        </div>
    `;
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); renderShop(); };

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-xs font-bold z-[5000] animate-bounce';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

document.addEventListener('DOMContentLoaded', () => renderShop());
