/**
 * shop.js - 終極修復全替換版
 * 1. 餘額顯示：支援多重 ID 自動綁定與即時更新 (Realtime)
 * 2. 圖片顯示：強化 Cloudflare R2 對接與檔名空格解碼
 * 3. 介面互動：修復彈窗無法關閉與層級 (z-index) 問題
 */

// --- 1. 系統配置區域 ---
const IMAGE_CONFIG = {
    source: 'R2', 
    // 請確保這裡是你新建的那個「非 Static Assets」的 Worker 網址
    workerUrl: 'https://sexifyyellow.poisonfairydaily.workers.dev/' 
};

let cart = []; 
let isCartView = false; 
let currentKeyword = ''; 
let balanceSubscription = null;

// --- 2. 核心功能：圖片解析 (對接 Cloudflare R2) ---
async function getSignedUrlSafe(path) {
    if (!path) return 'https://via.placeholder.com/300?text=No+Image';
    if (path.startsWith('http')) return path; 

    try {
        if (IMAGE_CONFIG.source === 'R2') {
            // 移除前後空格，並對檔名進行安全編碼（解決檔名有空格導致的 404）
            const cleanPath = path.trim();
            const finalUrl = `${IMAGE_CONFIG.workerUrl}?key=${encodeURIComponent(cleanPath)}`;
            return finalUrl;
        }
    } catch (e) {
        console.error("圖片網址解析失敗:", e);
    }
    return path;
}

// --- 3. 核心功能：餘額系統 (自動適應 HTML ID) ---
window.refreshBalanceUI = async function() {
    try {
        if (!window.supabaseClient) {
            console.warn("Supabase 客戶端尚未載入");
            return;
        }

        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            console.log("用戶未登入，跳過餘額同步");
            return;
        }

        // A. 首次獲取最新餘額
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single();

        if (!error && data) {
            updateBalanceDOM(data.balance);
        }

        // B. 建立即時監聽 (Realtime) - 只要資料庫變動，網頁立刻更新
        if (!balanceSubscription) {
            balanceSubscription = window.supabaseClient
                .channel('balance-changes')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'profiles',
                    filter: `id=eq.${user.id}` 
                }, payload => {
                    console.log("餘額即時更新:", payload.new.balance);
                    updateBalanceDOM(payload.new.balance);
                })
                .subscribe();
        }
    } catch (err) {
        console.error("餘額同步系統故障:", err);
    }
};

function updateBalanceDOM(balance) {
    const val = parseFloat(balance || 0).toLocaleString();
    
    // 防呆機制：同時尋找多種可能的餘額 ID，只要畫面上有就更新
    const idsToUpdate = ['user-balance', 'shop-balance-display', 'nav-balance'];
    idsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    });
}

// 每 30 秒自動強制校準一次餘額（雙重保險）
setInterval(window.refreshBalanceUI, 30000);

// --- 4. 商城渲染邏輯 ---
window.renderShop = async function(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    currentKeyword = filterKeyword;
    
    // 確保標籤導覽存在
    ensureShopTabs();
    
    grid.innerHTML = `<div class="col-span-2 text-center py-20"><i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i></div>`;

    if (isCartView) {
        grid.className = "grid grid-cols-1 gap-4";
        renderCartInline(grid);
    } else {
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4";
        try {
            let query = window.supabaseClient.from('products').select('*');
            if (filterKeyword) query = query.ilike('name', `%${filterKeyword}%`);
            const { data: products, error } = await query.order('created_at', { ascending: false });
            
            if (error || !products?.length) {
                grid.innerHTML = `<div class="col-span-2 text-center py-20 text-gray-400 text-sm font-bold">目前沒有商品</div>`;
                return;
            }

            let html = '';
            for (const p of products) {
                const img = await getSignedUrlSafe(p.image_url);
                html += `
                    <div onclick="openProductModal('${p.id}')" class="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm active:scale-95 transition-all cursor-pointer">
                        <img src="${img}" class="w-full aspect-square object-cover" onerror="this.src='https://via.placeholder.com/300?text=Image+Error'">
                        <div class="p-3">
                            <h3 class="font-bold text-xs text-gray-900 truncate">${p.name}</h3>
                            <div class="mt-2 text-sexify font-black text-sm">🪙 ${p.price}</div>
                        </div>
                    </div>`;
            }
            grid.innerHTML = html;
        } catch (e) { 
            grid.innerHTML = `<div class="col-span-2 text-center py-20 text-red-400 font-bold">系統連線異常</div>`; 
        }
    }
};

// --- 5. 商品詳情彈窗 (修復關閉卡死與層級遮擋) ---
window.openProductModal = async function(productId) {
    const { data: p, error } = await window.supabaseClient.from('products').select('*').eq('id', productId).single();
    if (error || !p) return;
    
    const img = await getSignedUrlSafe(p.image_url);
    
    let modal = document.getElementById('product-modal-container');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-modal-container';
        document.body.appendChild(modal);
    }

    modal.style.display = 'block';
    // 使用 z-[6000] 確保它絕對在最上層
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm" 
             id="modal-overlay" onclick="window.closeProductModal()">
            
            <div class="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden relative shadow-2xl animate-in fade-in zoom-in duration-300" 
                 onclick="event.stopPropagation()">
                
                <button onclick="window.closeProductModal()" 
                        class="absolute top-4 right-4 z-[6001] bg-black/30 hover:bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <img src="${img}" class="w-full aspect-square object-cover" onerror="this.src='https://via.placeholder.com/300?text=Image+Error'">
                
                <div class="p-8">
                    <h2 class="text-xl font-extrabold text-gray-900">${p.name}</h2>
                    <p class="text-gray-500 text-sm mt-2 leading-relaxed">${p.description || '暫無描述'}</p>
                    
                    <div class="flex gap-3 mt-8">
                        <button onclick="addToCart('${p.id}', '${p.name.replace(/'/g,"")}', ${p.price}, '${img}')" 
                                class="flex-1 bg-gray-100 text-gray-900 font-bold py-4 rounded-2xl text-sm active:scale-95 transition-transform">
                            加入清單
                        </button>
                        <button onclick="executeSecurePurchase('${p.id}', '${p.name.replace(/'/g,"")}')" 
                                class="flex-[1.5] bg-sexify text-white font-bold py-4 rounded-2xl text-sm shadow-lg shadow-sexify/20 active:scale-95 transition-transform">
                            立即購買
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
};

window.closeProductModal = function() {
    const modal = document.getElementById('product-modal-container');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
};

// --- 6. 購買與支付系統 ---
window.executeSecurePurchase = async function(id, name) {
    if (!confirm(`確定要購買 ${name} 嗎？`)) return;
    try {
        const { data, error } = await window.supabaseClient.rpc('process_purchase', { p_item_id: id, p_quantity: 1 });
        if (data?.success) {
            alert("🎉 購買成功！已存入您的庫存。");
            window.refreshBalanceUI(); // 立即刷新餘額
            window.closeProductModal(); // 購買成功後關閉彈窗
            if (!isCartView) renderShop(currentKeyword);
        } else {
            alert("購買失敗：餘額不足，請先充值金幣。");
        }
    } catch (e) {
        alert("購買程序發生錯誤，請稍後再試。");
    }
};

window.addToCart = (id, name, price, img) => {
    cart.push({ id, name, price, img });
    showNotification("已加入購物清單");
    window.closeProductModal();
    renderShop(currentKeyword);
};

window.payNow = async function() {
    const amount = parseFloat(document.getElementById('rechargeAmount').value);
    if (isNaN(amount) || amount < 20) return alert("最低充值金額為 $20 USD");
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return alert("請先登入帳號");
        
        showNotification("正在建立安全支付連結...");
        const { data, error } = await window.supabaseClient.functions.invoke('create-payment', {
            body: { userId: session.user.id, amount: amount }
        });
        if (data?.invoice_url) {
            window.location.href = data.invoice_url;
        } else {
            alert("無法建立支付訂單，請稍後再試");
        }
    } catch (err) { alert("支付系統維護中，請稍候"); }
};

window.toggleRechargeArea = function() {
    const drawer = document.getElementById('recharge-drawer');
    const icon = document.getElementById('recharge-icon');
    if (!drawer) return;
    const isHidden = (drawer.style.display === 'none' || drawer.style.display === '');
    drawer.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.className = isHidden ? 'fa-solid fa-xmark text-sm' : 'fa-solid fa-plus text-sm';
};

// --- 7. 購物車清單管理 ---
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
        <button onclick="switchView(false)" class="relative text-[15px] font-bold ${!isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400 hover:text-gray-600'} transition-colors">全部商品</button>
        <button onclick="switchView(true)" class="relative text-[15px] font-bold ${isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400 hover:text-gray-600'} transition-colors">購物清單 ${cart.length > 0 ? `<span class="absolute -top-1.5 -right-3.5 bg-sexify text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full">${cart.length}</span>` : ''}</button>
    `;
}

window.switchView = (toCart) => { isCartView = toCart; renderShop(currentKeyword); };

function renderCartInline(grid) {
    if (!cart.length) { 
        grid.innerHTML = `<div class="text-center py-20 text-gray-400 text-sm font-bold">您的清單是空的</div>`; 
        return; 
    }
    grid.innerHTML = cart.map((item, idx) => `
        <div class="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover" onerror="this.src='https://via.placeholder.com/150'">
            <div class="flex-1 font-bold">
                <div class="text-sm text-gray-900">${item.name}</div>
                <div class="text-sexify text-sm mt-1">🪙 ${item.price}</div>
            </div>
            <button onclick="cart.splice(${idx},1);renderShop()" class="text-gray-300 hover:text-red-500 transition-colors"><i class="fa-solid fa-circle-xmark text-xl"></i></button>
        </div>
    `).join('') + `
        <div class="mt-6 p-2">
            <button onclick="checkoutCart()" class="w-full bg-sexify text-white font-black py-4 rounded-2xl shadow-lg shadow-sexify/20 active:scale-95 transition-transform">
                確認購買全部項目
            </button>
        </div>`;
}

async function checkoutCart() {
    if (!cart.length) return;
    if (!confirm(`確定要一次購買清單中的 ${cart.length} 個項目嗎？`)) return;
    
    showNotification("批量結帳處理中...");
    let successCount = 0;
    for (const item of cart) {
        const { data } = await window.supabaseClient.rpc('process_purchase', { p_item_id: item.id, p_quantity: 1 });
        if (data?.success) successCount++;
    }
    
    alert(`結帳完成！成功購買 ${successCount} 個項目。`);
    cart = [];
    window.refreshBalanceUI();
    renderShop();
}

// --- 8. 我的購買紀錄 ---
window.toggleMyOrders = () => {
    const el = document.getElementById('my-orders-view');
    if (!el) return;
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) window.renderMyOrders();
};

window.renderMyOrders = async function() {
    const container = document.getElementById('orders-list-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-white text-xl"></i></div>';
    
    try {
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select('*, products(*)')
            .order('purchased_at', {ascending: false});
            
        if (error || !data?.length) { 
            container.innerHTML = '<div class="text-white/40 py-20 text-center text-sm font-bold">目前尚無購買紀錄</div>'; 
            return; 
        }
        
        let html = '';
        for (const o of data) {
            const p = o.products;
            if(!p) continue;
            const img = await getSignedUrlSafe(p.image_url);
            html += `
                <div class="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 items-center">
                    <img src="${img}" class="w-14 h-14 rounded-xl object-cover" onerror="this.src='https://via.placeholder.com/150'">
                    <div class="flex-1">
                        <div class="text-white text-sm font-bold">${p.name}</div>
                        <div class="text-gray-400 text-[10px] mt-1">${new Date(o.purchased_at).toLocaleString()}</div>
                    </div>
                    <button onclick="alert('詳情功能開發中')" class="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-colors">查看</button>
                </div>`;
        }
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="text-red-400 py-10 text-center text-sm font-bold">讀取失敗</div>';
    }
};

// --- 9. 全局輔助工具 ---
function showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'fixed top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white px-6 py-3 rounded-full z-[7000] text-sm font-bold shadow-xl animate-in slide-in-from-top-5 duration-300';
    n.innerText = msg;
    document.body.appendChild(n);
    setTimeout(() => {
        n.classList.add('fade-out');
        setTimeout(() => n.remove(), 300);
    }, 2500);
}

// --- 初始化執行 ---
document.addEventListener('DOMContentLoaded', () => {
    // 給予 Supabase 客戶端 0.5 秒的初始化緩衝時間
    setTimeout(() => {
        window.renderShop();
        window.refreshBalanceUI();
    }, 500);
});
