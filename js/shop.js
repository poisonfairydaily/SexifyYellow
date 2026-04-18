/**
 * shop.js - 專業商城正式營運整合版
 * 整合：R2 圖片支援 + 下架過濾 + 漫畫閱讀器 + 安全充值邏輯
 */

let cart = []; 
let currentView = 'all'; // 'all', 'cart', 'owned'
let currentKeyword = ''; 

// --- 🛡️ 安全核心：防止 XSS 攻擊 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 0. 基礎功能：餘額、初始化與充值
 */
window.refreshBalanceUI = async function() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;
        const { data } = await window.supabaseClient.from('profiles').select('balance').eq('id', user.id).single();
        
        // 同步所有顯示餘額的地方
        const ids = ['user-balance', 'shop-balance-display'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = data?.balance ?? 0;
        });
    } catch (err) { console.error("刷新餘額失敗:", err); }
};

// ✨ 新增：處理充值邏輯 (與 HTML 充值按鈕連動)
window.handleRecharge = async function(amount) {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return alert("請先登入");

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) return alert("請輸入有效金額");

        // 呼叫 Supabase RPC 更新餘額
        const { data, error } = await window.supabaseClient.rpc('add_user_balance', { 
            p_user_id: user.id, 
            p_amount: numAmount 
        });

        if (error) throw error;

        alert(`✅ 成功充值 ${numAmount} 幣！`);
        if (typeof window.toggleRechargeArea === 'function') window.toggleRechargeArea();
        window.refreshBalanceUI();
    } catch (err) {
        console.error("充值異常:", err);
        alert("充值失敗，請聯繫客服");
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
            清單 ${cart.length > 0 ? `<span class="bg-sexify text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">${cart.length}</span>` : ''}
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
 * 3. 渲染網格 (相容 R2 網址)
 */
async function renderProductGrid(grid, keyword) {
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-xl"></i></div>`;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        let query = window.supabaseClient.from('products').select('*')
            .eq('status', 'approved')
            .eq('is_archived', false); 

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
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 flex flex-col items-center"><i class="fa-solid fa-box-open text-3xl mb-2 opacity-20"></i><p>空空如也</p></div>`;
            return;
        }

        grid.innerHTML = displayProducts.map(p => {
            const firstImg = p.image_url?.split(',')[0] || '';
            // ✨ R2 相容：如果 image_url 已經是 http 開頭，直接用；否則拼接 R2 公開地址
            const displayImg = firstImg.startsWith('http') ? firstImg : `${window.R2_PUBLIC_URL}/${firstImg}`;
            const isUnlocked = purchasedIds.has(p.id);
            
            return `
                <div onclick="openProductModal('${p.id}')" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transition-all active:scale-95">
                    <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                        <img src="${displayImg}" class="w-full h-full object-cover">
                        ${isUnlocked ? '<div class="absolute top-2 right-2 bg-green-500 text-white text-[8px] px-2 py-1 rounded-full font-bold shadow-lg">已擁有</div>' : ''}
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
    } catch (e) { console.error("渲染商城出錯:", e); }
}

/**
 * 4. 商品詳情與購買
 */
window.openProductModal = async function(productId) {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    const { data: p } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!p) return;

    const { data: order } = user ? await window.supabaseClient.from('orders').select('id').eq('product_id', productId).eq('user_id', user.id).single() : { data: null };
    const isUnlocked = order !== null;

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

// 漫畫閱讀器 (支援 R2)
async function renderMangaViewer(modal, p) {
    const files = p.image_url ? p.image_url.split(',') : []; 
    const imgTags = files.map((file, idx) => {
        const url = file.trim().startsWith('http') ? file.trim() : `${window.R2_PUBLIC_URL}/${file.trim()}`;
        return `
            <div class="manga-page-container mb-1" data-page="${idx + 1}">
                <img src="${url}" class="w-full block" loading="lazy">
                <div class="text-[9px] text-zinc-500 text-center py-2 bg-black">PAGE ${idx + 1} / ${files.length}</div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div id="manga-viewport" class="fixed inset-0 bg-black z-[5000] overflow-y-auto">
            <div class="fixed top-4 left-4 flex gap-2 z-[6000]">
                <button onclick="window.closeProductModal()" class="bg-black/50 text-white w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
                <div id="page-counter" class="bg-black/50 text-white px-4 h-10 rounded-full flex items-center backdrop-blur-md border border-white/10 text-[10px] font-bold">1 / ${files.length}</div>
            </div>
            <div class="pt-2">${imgTags}</div>
        </div>
    `;
    document.body.style.overflow = 'hidden';

    const viewport = document.getElementById('manga-viewport');
    viewport.onscroll = () => {
        const containers = document.querySelectorAll('.manga-page-container');
        containers.forEach(c => {
            const rect = c.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2) {
                document.getElementById('page-counter').innerText = `${c.dataset.page} / ${files.length}`;
            }
        });
    };
}

async function renderPurchaseModal(modal, p, isUnlocked) {
    const firstImg = p.image_url?.split(',')[0] || '';
    const displayImg = firstImg.startsWith('http') ? firstImg : `${window.R2_PUBLIC_URL}/${firstImg}`;

    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/60 z-[3500] flex items-center justify-center p-4 backdrop-blur-sm" onclick="window.closeProductModal()">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in" onclick="event.stopPropagation()">
                <div class="aspect-square relative">
                    <img src="${displayImg}" class="w-full h-full object-cover">
                    <button onclick="window.closeProductModal()" class="absolute top-4 right-4 bg-black/20 text-white w-8 h-8 rounded-full flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-6">
                    <h2 class="text-xl font-black text-gray-900">${escapeHTML(p.name)}</h2>
                    <p class="text-gray-400 text-[11px] mt-2 line-clamp-2">${escapeHTML(p.description || '暫無描述')}</p>
                    <div class="mt-8 flex items-center justify-between">
                        <span class="text-sexify font-black text-2xl">🪙 ${p.price}</span>
                        ${isUnlocked ? 
                            `<button onclick="window.switchView('owned'); window.closeProductModal();" class="bg-black text-white px-8 py-3 rounded-xl font-bold text-xs">查看庫存</button>` :
                            `<div class="flex gap-2">
                                <button onclick="addToCart('${p.id}', '${escapeHTML(p.name).replace(/'/g, "\\'")}', ${p.price}, '${displayImg}')" class="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-xs">加入清單</button>
                                <button onclick="executeSecurePurchase('${p.id}', '${escapeHTML(p.name).replace(/'/g, "\\'")}')" class="bg-sexify text-white px-6 py-3 rounded-xl font-bold text-xs">立即購買</button>
                            </div>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.style.overflow = 'hidden';
}

window.executeSecurePurchase = async function(itemId, itemName) {
    if (!confirm(`確認要購買「${itemName}」嗎？`)) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('process_purchase', { p_item_id: itemId });
        if (error) throw error;
        if (data.success) {
            alert("🎉 購買成功！");
            window.closeProductModal();
            window.refreshBalanceUI();
            window.renderShop();
        } else { alert(data.message); }
    } catch (e) { alert("交易失敗，請檢查餘額"); }
};

window.addToCart = function(id, name, price, img) {
    if (cart.some(i => i.id === id)) return alert("已在清單中");
    cart.push({ id, name, price, img });
    showNotification(`已加入清單`);
    ensureShopTabs();
    window.closeProductModal();
};

function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `<div class="text-center py-20 text-gray-400"><i class="fa-solid fa-scroll text-3xl mb-2 opacity-20"></i><p>清單是空的</p></div>`;
        return;
    }
    const total = cart.reduce((s, i) => s + i.price, 0);
    grid.innerHTML = `
        <div class="space-y-3 p-2">
            ${cart.map((item, idx) => `
                <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <img src="${item.img}" class="w-14 h-14 rounded-lg object-cover">
                    <div class="flex-1">
                        <h4 class="text-xs font-bold">${escapeHTML(item.name)}</h4>
                        <span class="text-sexify font-bold text-xs">🪙 ${item.price}</span>
                    </div>
                    <button onclick="removeFromCart(${idx})" class="text-gray-300 px-2"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('')}
            <div class="mt-10 p-6 bg-white rounded-[2rem] border border-gray-100">
                <div class="flex justify-between mb-4"><span class="text-gray-400 text-xs">預計消耗</span><span class="text-sexify font-black text-xl">🪙 ${total}</span></div>
                <p class="text-[10px] text-gray-400 mb-4 text-center">請點擊商品卡片進行結帳</p>
                <button onclick="window.switchView('all')" class="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl text-xs">繼續逛逛</button>
            </div>
        </div>
    `;
}

window.removeFromCart = (idx) => { cart.splice(idx, 1); window.renderShop(); };

function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-2 rounded-full text-[10px] font-bold z-[6000] animate-fade-in';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2000);
}

// 監聽 Tab 切換，如果是商城 Tab 則初始化
document.addEventListener('DOMContentLoaded', () => {
    window.refreshBalanceUI();
    window.renderShop();
});
