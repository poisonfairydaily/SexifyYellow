/**
 * shop.js - 專業商城正式營運整合版
 * 整合：NowPayments 支付跳轉 + R2 圖片支援 + 漫畫閱讀器
 */

let cart = []; 
let currentView = 'all'; 
let currentKeyword = ''; 

// --- 🛡️ 安全核心 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

// ✨ 核心修復：發起 NowPayments 支付跳轉
window.handleRecharge = async function(amount) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 20) return alert("最低儲值金額為 $20 USD");

    const btn = document.querySelector('#recharge-drawer button');
    const originalText = btn.innerText;
    btn.innerText = "建立訂單中...";
    btn.disabled = true;

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) throw new Error("請先登入帳號");

        // 呼叫你的 Cloudflare Worker 建立支付發票
        // 注意：路徑設定為 /create-payment
        const response = await fetch('https://sexify-uploader.poisonfairydaily.workers.dev/create-payment', {
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
            // 🚀 成功拿到跳轉連結，執行跳轉到 NowPayments
            showNotification("正在前往支付頁面...");
            window.location.href = result.invoice_url;
        } else {
            console.error("NowPayments 回傳異常:", result);
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

window.closeProductModal = () => {
    const modal = document.getElementById('product-modal-container');
    if (modal) {
        modal.innerHTML = ''; 
        modal.style.display = 'none';
    }
    document.body.style.overflow = ''; 
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
        <button onclick="switchView('all')" class="${btnClass('all')}">商城</button>
        <button onclick="switchView('owned')" class="${btnClass('owned')}">我的庫存</button>
        <button onclick="switchView('cart')" class="${btnClass('cart')}">
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
        grid.className = "grid grid-cols-1 gap-4"; 
        renderCartInline(grid);
    } else {
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4";
        renderProductGrid(grid, filterKeyword);
    }
};

async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        let query = window.supabaseClient.from('products').select('*').eq('status', 'approved').eq('is_archived', false); 
        if (keyword) query = query.ilike('name', `%${keyword}%`);
        const { data: products } = await query.order('created_at', { ascending: false });

        const { data: orders } = user ? await window.supabaseClient.from('orders').select('product_id').eq('user_id', user.id) : { data: [] };
        const purchasedIds = new Set(orders?.map(o => o.product_id) || []);

        let displayProducts = products || [];
        if (currentView === 'owned') {
            const { data: ownedProducts } = await window.supabaseClient.from('products').select('*').in('id', Array.from(purchasedIds));
            displayProducts = ownedProducts || [];
        }

        if (displayProducts.length === 0) {
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400">目前沒有內容</div>`;
            return;
        }

        grid.innerHTML = displayProducts.map(p => {
            const firstImg = p.image_url?.split(',')[0] || '';
            const displayImg = firstImg.startsWith('http') ? firstImg : `${window.R2_PUBLIC_URL}/${firstImg}`;
            const isUnlocked = purchasedIds.has(p.id);
            return `
                <div onclick="openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
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
    } catch (e) { console.error(e); }
}

// ... (省略漫畫閱讀器與購買彈窗代碼，保持與之前一致即可) ...

window.addToCart = function(id, name, price, img) {
    if (cart.some(i => i.id === id)) return alert("已在清單中");
    cart.push({ id, name, price, img });
    showNotification(`已加入清單`);
    ensureShopTabs();
    window.closeProductModal();
};

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-[10px] font-bold z-[6000] animate-fade-in';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

document.addEventListener('DOMContentLoaded', () => {
    window.refreshBalanceUI();
    window.renderShop();
});
