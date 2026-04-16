/**
 * shop.js - 整合式商城核心邏輯 (完整版：包含購物車、搜尋、RPC 購買與支付跳轉)
 */

let cart = []; // 購物車陣列
let isCartView = false; 
let currentKeyword = ''; 

/**
 * 0. 支付與充值介面邏輯
 */

// 控制充值輸入區域的顯示/隱藏
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
// 在 shop.js 加入一個手動刷新函數
/**
 * 強制更新餘額顯示補丁
 */
window.refreshBalanceUI = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // 這裡尋找你的 HTML 標籤，假設它的 ID 叫 user-balance
        const balanceDisplay = document.getElementById('user-balance');
        if (balanceDisplay) {
            balanceDisplay.innerText = data.balance !== null ? data.balance : 0;
            console.log("餘額更新成功:", data.balance);
        }
    } catch (err) {
        console.error("餘額顯示失敗:", err.message);
    }
};

// 每當頁面載入時跑一次
document.addEventListener('DOMContentLoaded', window.refreshBalanceUI);
// 每隔 10 秒自動檢查一次（適合支付完自動跳數字）
setInterval(window.refreshBalanceUI, 10000);
// 處理充值跳轉支付
window.payNow = async function() {
    const amountVal = document.getElementById('rechargeAmount').value;
    const amount = parseFloat(amountVal);
    
    if (isNaN(amount) || amount < 10) {
        alert("為了確保區塊鏈交易成功，最低充值金額為 $10 USD");
        return;
    }

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) { alert("請先登入帳號！"); return; }

        showNotification("正在為您建立安全付款連結...");

        const { data, error } = await window.supabaseClient.functions.invoke('create-payment', {
            body: { userId: session.user.id, amount: amount }
        });

        if (error) throw error;

        if (data && data.invoice_url) {
            window.location.href = data.invoice_url;
        } else {
            throw new Error("無法取得付款網址");
        }
    } catch (err) {
        console.error("支付失敗:", err.message);
        alert("系統忙碌中，請檢查網路或稍後再試");
    }
};

/**
 * 1. 動態注入與更新頂部頁籤 (保留原功能)
 */
function ensureShopTabs() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    let tabsContainer = document.getElementById('shop-custom-tabs');
    if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'shop-custom-tabs';
        tabsContainer.className = 'flex justify-center gap-8 mb-5 border-b border-gray-100/50 pb-2 z-10 relative';
        grid.parentNode.insertBefore(tabsContainer, grid);
    }

    tabsContainer.innerHTML = `
        <button onclick="switchView(false)" class="relative text-[15px] font-bold transition-all duration-300 ${!isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400 hover:text-gray-600'}">
            全部商品
        </button>
        <button onclick="switchView(true)" class="relative text-[15px] font-bold transition-all duration-300 ${isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400 hover:text-gray-600'}">
            購物清單
            ${cart.length > 0 ? `<span class="absolute -top-1.5 -right-3.5 bg-sexify text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-in zoom-in">${cart.length}</span>` : ''}
        </button>
    `;
}

window.switchView = function(toCart) {
    if (isCartView === toCart) return;
    isCartView = toCart;
    renderShop(currentKeyword);
};
// 定義一個專門更新餘額的函數
window.renderProfile = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        // 注意：這裡的 ID 必須完全對應你 HTML 裡的 shop-balance-display
        const balanceEl = document.getElementById('shop-balance-display');
        if (balanceEl) {
            // 使用 ?? 0 確保如果資料庫沒數字時顯示 0
            balanceEl.innerText = data.balance ?? 0;
            console.log("餘額顯示已更新:", data.balance);
        }
    } catch (err) {
        console.error("更新餘額出錯:", err.message);
    }
};

// 網頁載入後立刻執行一次
document.addEventListener('DOMContentLoaded', window.renderProfile);
/**
 * 2. 商城主渲染入口
 */
window.renderShop = async function(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    currentKeyword = filterKeyword;
    ensureShopTabs();

    if (isCartView) {
        grid.className = "grid grid-cols-1 gap-4"; 
        renderCartInline(grid);
    } else {
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4";
        renderProductGrid(grid, filterKeyword);
    }
};

/**
 * 3. 渲染商品網格 (從 Supabase 抓取)
 */
async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    
    try {
        let query = window.supabaseClient.from('products').select('*');
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        
        const { data: products, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        if (!products || products.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400"><p class="text-sm">找不到相關商品...</p></div>`;
            return;
        }

        grid.innerHTML = products.map(p => `
            <div onclick="openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95 hover:shadow-md">
                <div class="aspect-square w-full overflow-hidden bg-gray-50">
                    <img src="${p.image_url || 'https://via.placeholder.com/300'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                </div>
                <div class="p-3">
                    <h3 class="font-bold text-xs text-gray-800 mb-1 line-clamp-1">${p.name}</h3>
                    <div class="flex items-end gap-1.5 mt-2">
                        <span class="text-sexify font-black text-sm">🪙 ${p.price}</span>
                        ${p.stock <= 0 ? `<span class="text-red-400 text-[9px] font-bold">已售罄</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-400">載入失敗</div>`;
    }
}

/**
 * 4. 商品詳情模態視窗
 */
window.openProductModal = async function(productId) {
    const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!p) return;

    let modal = document.getElementById('product-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-modal-container';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/70 z-[3500] flex items-center justify-center p-4 backdrop-blur-md" onclick="closeProductModal()">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden relative shadow-2xl" onclick="event.stopPropagation()">
                <button onclick="closeProductModal()" class="absolute top-4 right-4 bg-black/20 text-white rounded-full w-9 h-9 flex items-center justify-center z-10"><i class="fa-solid fa-xmark"></i></button>
                <img src="${p.image_url}" class="w-full aspect-square object-cover">
                <div class="p-6">
                    <h2 class="text-xl font-extrabold text-gray-900">${p.name}</h2>
                    <p class="text-gray-500 text-sm mt-2">${p.description || '暫無描述'}</p>
                    <div class="mt-4 pt-4 border-t border-gray-50">
                        <span class="text-sexify font-black text-2xl">🪙 ${p.price}</span>
                        <div class="flex gap-2 mt-4">
                            <button onclick="addToCart('${p.id}', '${p.name}', ${p.price}, '${p.image_url}')" class="flex-1 bg-orange-50 text-orange-500 font-bold py-3.5 rounded-2xl text-sm">加入清單</button>
                            <button onclick="executeSecurePurchase('${p.id}', '${p.name}')" class="flex-[1.5] bg-sexify text-white font-bold py-3.5 rounded-2xl text-sm">立即購買</button>
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
 * 5. 安全購買 (RPC)
 */
window.executeSecurePurchase = async function(itemId, itemName) {
    if (!confirm(`確定要購買「${itemName}」嗎？`)) return;

    try {
        const { data, error } = await window.supabaseClient.rpc('process_purchase', {
            p_item_id: itemId,
            p_quantity: 1
        });

        if (error) throw error;

        if (data.success) {
            alert(`🎉 購買成功！餘額：${data.new_balance}`);
            closeProductModal();
            if (typeof window.renderProfile === 'function') window.renderProfile();
            renderShop(currentKeyword); // 刷新商城 (如庫存)
        } else {
            const isInsufficientBalance = data.message.includes('餘額不足') || data.message.includes('balance');
            if (isInsufficientBalance) {
                if (confirm(`⚠️ 餘額不足！\n是否要立即前往充值？`)) {
                    closeProductModal();
                    toggleRechargeArea(); // 開啟充值抽屜
                }
            } else {
                alert(`⚠️ 失敗：${data.message}`);
            }
        }
    } catch (e) {
        alert("交易異常，請稍後再試");
    }
};

/**
 * 6. 購物車邏輯
 */
window.addToCart = function(id, name, price, img) {
    cart.push({ id, name, price, img });
    showNotification(`已加入：${name}`);
    ensureShopTabs();
    closeProductModal();
};

function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `<div class="text-center py-20 text-gray-400"><p>清單是空的</p><button onclick="switchView(false)" class="text-sexify mt-2 text-xs">去逛逛</button></div>`;
        return;
    }
    const total = cart.reduce((s, i) => s + i.price, 0);
    grid.innerHTML = `
        <div class="flex flex-col gap-3">
            ${cart.map((item, idx) => `
                <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover">
                    <div class="flex-1"><h4 class="text-sm font-bold">${item.name}</h4><span class="text-sexify font-black text-sm">🪙 ${item.price}</span></div>
                    <button onclick="removeFromCart(${idx})" class="text-gray-300 px-2"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `).join('')}
            <div class="mt-4 p-5 bg-gray-50 rounded-[2rem] border border-gray-100">
                <div class="flex justify-between mb-4"><span>總價</span><span class="text-sexify font-black text-xl">🪙 ${total.toFixed(1)}</span></div>
                <button onclick="checkoutCart()" class="w-full bg-sexify text-white font-bold py-4 rounded-2xl shadow-lg">批量結帳</button>
            </div>
        </div>
    `;
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); renderShop(currentKeyword); };

window.checkoutCart = async function() {
    if (cart.length === 0) return;
    if (!confirm(`確定結帳這 ${cart.length} 項商品？`)) return;

    let successCount = 0;
    let failedDueToBalance = false;

    for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const { data, error } = await window.supabaseClient.rpc('process_purchase', { p_item_id: item.id, p_quantity: 1 });

        if (error || !data.success) {
            if (data && (data.message.includes('餘額不足') || data.message.includes('balance'))) {
                failedDueToBalance = true;
                break;
            }
            continue; 
        }
        successCount++;
    }

    if (failedDueToBalance) {
        if (confirm(`⚠️ 餘額不足！是否要立即前往充值點數？`)) {
            toggleRechargeArea();
        }
    } else if (successCount > 0) {
        alert(`🎉 批量結帳完成！共成功購買 ${successCount} 項商品。`);
        cart = []; 
        isCartView = false;
        renderShop();
        if (typeof window.renderProfile === 'function') window.renderProfile();
    }
};

/**
 * 7. 通用與通知
 */
function showNotification(msg) {
    let n = document.getElementById('shop-notify') || document.createElement('div');
    n.id = 'shop-notify';
    n.className = 'fixed top-1/4 left-1/2 -translate-x-1/2 z-[4000] bg-gray-900/90 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl';
    document.body.appendChild(n);
    n.innerText = msg;
    n.style.display = 'block';
    setTimeout(() => n.style.display = 'none', 2000);
}

// 監聽 DOM 載入
document.addEventListener('DOMContentLoaded', () => {
    renderShop();
});
// 切換顯示已購內容
window.toggleMyOrders = function() {
    const view = document.getElementById('my-orders-view');
    if (view.classList.contains('hidden')) {
        view.classList.remove('hidden');
        renderMyOrders(); // 打開時順便刷新列表
    } else {
        view.classList.add('hidden');
    }
};

// 抓取並顯示內容
async function renderMyOrders() {
    const container = document.getElementById('orders-list-container');
    container.innerHTML = '<div class="text-center py-10">讀取中...</div>';

    const { data, error } = await window.supabaseClient
        .from('orders')
        .select(`
            purchased_at,
            products (
                name,
                image_url,
                description
            )
        `)
        .order('purchased_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="text-red-500">讀取失敗: ${error.message}</div>`;
        return;
    }

    if (data.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-400">尚未購買任何內容</div>';
        return;
    }

    container.innerHTML = data.map(order => `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
            <img src="${order.products.image_url}" class="w-20 h-20 object-cover rounded-xl">
            <div class="flex-1">
                <h3 class="font-bold text-gray-900">${order.products.name}</h3>
                <p class="text-xs text-gray-500 mt-1">${order.products.description || ''}</p>
                <div class="text-[10px] text-gray-400 mt-2">購買時間: ${new Date(order.purchased_at).toLocaleString()}</div>
            </div>
        </div>
    `).join('');
}
