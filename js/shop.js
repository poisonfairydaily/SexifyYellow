/**
 * shop.js
 * * 整合式商城核心邏輯 (全替換式完整代碼)
 * 功能：頁籤式無縫切換 (商城/購物車)、搜尋過濾、商品詳情模態視窗、
 * 直接購買(二次確認)、加入購物車、批量結帳。
 * UI 邏輯：純 JS 動態注入頁籤，保證不依賴額外的 HTML 結構。
 */

// 1. 全域商品資料與狀態管理
let globalProducts = [
    { id: 1, name: "福利私密圖", price: 49.0, oldPrice: 99.0, img: "https://picsum.photos/300/300?random=20", desc: "內含 15 張未公開高畫質精美福利圖，解鎖專屬誘惑。" },
    { id: 2, name: "1對1 私密聊天", price: 149.0, oldPrice: 299.0, img: "https://picsum.photos/300/300?random=21", desc: "專屬 30 分鐘線上私密語音/文字聊天，享受獨處時光。" },
    { id: 3, name: "數位寫真集", price: 129.0, oldPrice: 199.0, img: "https://picsum.photos/300/300?random=22", desc: "超過 50 頁的精美數位寫真，包含多套造型完整收藏。" },
    { id: 4, name: "VIP 專屬 1個月", price: 99.0, oldPrice: 150.0, img: "https://picsum.photos/300/300?random=23", desc: "開通一個月 VIP 特權，全站部分圖集免費看、享有專屬徽章。" },
    { id: 5, name: "限量拍立得", price: 399.0, oldPrice: 499.0, img: "https://picsum.photos/300/300?random=24", desc: "實體限量親筆簽名拍立得一張，全球免運費寄送。" },
    { id: 6, name: "聲音個性包", price: 29.0, oldPrice: 59.0, img: "https://picsum.photos/300/300?random=25", desc: "包含 5 段專屬早安、晚安及撒嬌語音留言。" }
];

let cart = []; // 購物車陣列
let isCartView = false; // 目前是否處於購物車檢視模式
let currentKeyword = ''; // 紀錄當前搜尋關鍵字

/**
 * 動態注入與更新頂部頁籤 (小紅書風格導航)
 * 自動依附在 shop-grid 之前，不用手動改 HTML
 */
function ensureShopTabs() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    let tabsContainer = document.getElementById('shop-custom-tabs');
    if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'shop-custom-tabs';
        // 設置樣式與間距
        tabsContainer.className = 'flex justify-center gap-8 mb-5 border-b border-gray-100/50 pb-2 z-10 relative';
        grid.parentNode.insertBefore(tabsContainer, grid);
    }

    tabsContainer.innerHTML = `
        <button onclick="switchView(false)" class="relative text-[15px] font-bold transition-all duration-300 ${!isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400 hover:text-gray-600'}">
            全部商品
        </button>
        <button onclick="switchView(true)" class="relative text-[15px] font-bold transition-all duration-300 ${isCartView ? 'text-gray-900 after:content-[\'\'] after:absolute after:-bottom-[9px] after:left-1/2 after:-translate-x-1/2 after:w-4 after:h-[3px] after:bg-sexify after:rounded-full' : 'text-gray-400 hover:text-gray-600'}">
            購物清單
            ${cart.length > 0 ? `
                <span class="absolute -top-1.5 -right-3.5 bg-sexify text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-in zoom-in">
                    ${cart.length}
                </span>
            ` : ''}
        </button>
    `;
}

/**
 * 處理頁籤切換
 */
function switchView(toCart) {
    if (isCartView === toCart) return;
    isCartView = toCart;
    renderShop(currentKeyword);
}

/**
 * 商城主渲染入口
 * 根據當前模式 (商品列表 or 購物車清單) 決定渲染內容
 */
function renderShop(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) {
        console.error("找不到 shop-grid 容器");
        return;
    }

    currentKeyword = filterKeyword;

    // 每次渲染前確保頁籤存在且狀態正確
    ensureShopTabs();

    if (isCartView) {
        // 如果是購物車模式，切換為單欄顯示 (佔滿兩欄)
        grid.className = "grid grid-cols-1 gap-4"; 
        renderCartInline(grid);
    } else {
        // 恢復商品列表的雙欄網格
        grid.className = "grid grid-cols-2 gap-3 sm:gap-4";
        renderProductGrid(grid, filterKeyword);
    }
}

/**
 * 渲染商品網格列表
 */
function renderProductGrid(grid, keyword) {
    let displayProducts = globalProducts;

    if (keyword.trim() !== '') {
        const kw = keyword.toLowerCase();
        displayProducts = globalProducts.filter(p => p.name.toLowerCase().includes(kw));
    }

    if (displayProducts.length === 0) {
        grid.className = "grid grid-cols-1"; // 找不到商品時設為單欄置中
        grid.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-magnifying-glass mb-3 text-3xl opacity-20"></i>
                <p class="text-sm">找不到相關商品...</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = displayProducts.map(p => `
        <div onclick="openProductModal(${p.id})" class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transform transition-all duration-300 active:scale-95 hover:shadow-md">
            <div class="absolute top-2 left-2 bg-sexify text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10 shadow-sm">HOT</div>
            <div class="aspect-square w-full overflow-hidden bg-gray-50">
                <img src="${p.img}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
            </div>
            <div class="p-3">
                <h3 class="font-bold text-xs text-gray-800 mb-1 line-clamp-1 group-hover:text-sexify transition-colors">${p.name}</h3>
                <div class="flex items-end gap-1.5 mt-2">
                    <span class="text-sexify font-black text-sm">🪙 ${p.price}</span>
                    <span class="text-gray-300 text-[10px] line-through mb-0.5">${p.oldPrice}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * 內嵌式渲染購物車清單
 */
function renderCartInline(grid) {
    if (cart.length === 0) {
        grid.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-basket-shopping text-4xl mb-4 opacity-20"></i>
                <p class="text-sm font-bold">購物清單是空的</p>
                <button onclick="switchView(false)" class="mt-4 text-sexify text-xs font-bold border-b border-sexify pb-0.5 hover:opacity-80">去逛逛商品</button>
            </div>
        `;
        return;
    }

    let total = cart.reduce((sum, item) => sum + item.price, 0);

    let cartHTML = `
        <div class="flex flex-col gap-4 animate-in fade-in duration-300">
            <div class="flex items-center justify-between px-1">
                <h2 class="font-bold text-sm text-gray-800">已選購 ${cart.length} 項商品</h2>
                <button onclick="clearCart()" class="text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                    <i class="fa-solid fa-trash-can"></i> 清空
                </button>
            </div>
            
            <div class="flex flex-col gap-3">
                ${cart.map((item, index) => `
                    <div class="flex items-center gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm relative transition-all hover:border-gray-200">
                        <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover">
                        <div class="flex-1 flex flex-col justify-center">
                            <h4 class="text-sm font-bold text-gray-800 line-clamp-1">${item.name}</h4>
                            <span class="text-sexify font-black text-sm mt-1">🪙 ${item.price}</span>
                        </div>
                        <button onclick="removeFromCart(${index})" class="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="mt-2 p-5 bg-gray-50/80 rounded-[2rem] flex flex-col gap-4 border border-gray-100">
                <div class="flex justify-between items-center px-1">
                    <span class="text-gray-500 font-bold text-sm">結算總價</span>
                    <span class="text-sexify font-black text-2xl">🪙 ${total.toFixed(1)}</span>
                </div>
                <button onclick="checkoutCart()" class="w-full bg-sexify text-white font-bold py-4 rounded-2xl shadow-lg shadow-sexify/20 active:scale-95 transition-all text-sm">
                    立即支付並結帳
                </button>
            </div>
        </div>
    `;
    
    grid.innerHTML = cartHTML;
}

/**
 * 商品詳情模態視窗
 */
function openProductModal(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;

    let modalContainer = document.getElementById('product-modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'product-modal-container';
        document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/70 z-[3500] flex items-center justify-center p-4 backdrop-blur-md transition-all animate-in fade-in duration-300" onclick="closeProductModal()">
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden flex flex-col relative shadow-2xl transform animate-in zoom-in-95 duration-300" onclick="event.stopPropagation()">
                
                <button onclick="closeProductModal()" class="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white rounded-full w-9 h-9 flex items-center justify-center z-10 backdrop-blur-xl transition-all active:scale-90">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>

                <div class="w-full aspect-square bg-gray-100">
                    <img src="${product.img}" class="w-full h-full object-cover">
                </div>

                <div class="p-6 flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <h2 class="text-xl font-extrabold text-gray-900">${product.name}</h2>
                        <p class="text-gray-500 text-sm leading-relaxed min-h-[3rem]">${product.desc}</p>
                    </div>
                    
                    <div class="mt-2 pt-4 border-t border-gray-50">
                        <div class="flex items-end gap-2 mb-4">
                            <span class="text-sexify font-black text-2xl">🪙 ${product.price}</span>
                            <span class="text-gray-400 text-xs line-through mb-1">原價 ${product.oldPrice}</span>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="addToCart(${product.id})" class="flex-[1] bg-orange-50 text-orange-500 font-bold py-3.5 rounded-2xl hover:bg-orange-100 active:scale-95 transition-all text-sm flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-cart-plus"></i> 加入
                            </button>
                            <button onclick="askDirectPurchase(${product.id})" class="flex-[1.5] bg-sexify text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-sexify/20 hover:brightness-110 active:scale-95 transition-all text-sm">
                                直接購買
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modalContainer = document.getElementById('product-modal-container');
    if (modalContainer) modalContainer.innerHTML = ''; 
    document.body.style.overflow = '';
}

/**
 * 加入購物車邏輯
 */
function addToCart(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;
    
    cart.push(product);
    ensureShopTabs(); // 立即更新數字標籤
    closeProductModal();
    
    showNotification(`已加入：${product.name}`);
}

/**
 * 直接購買前詢問
 */
function askDirectPurchase(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (confirm(`確定要立即購買「${product.name}」嗎？\n將直接扣除 🪙 ${product.price}`)) {
        executePurchase(product.name, product.price);
        closeProductModal();
    }
}

/**
 * 執行購買 (共通接口)
 */
function executePurchase(name, price) {
    alert(`購買成功！\n已解鎖：「${name}」\n扣除金幣：${price}`);
}

/**
 * 購物車管理功能
 */
function removeFromCart(index) {
    cart.splice(index, 1);
    renderShop(currentKeyword);
}

function clearCart() {
    if(confirm('確定要清空購物清單嗎？')) {
        cart = [];
        renderShop(currentKeyword);
    }
}

function checkoutCart() {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    
    if (confirm(`確定要一次購買這 ${cart.length} 項商品嗎？\n總共將扣除 🪙 ${total.toFixed(1)}`)) {
        let itemNames = cart.map(item => `• ${item.name}`).join('\n');
        executePurchase(`\n${itemNames}`, total.toFixed(1));
        
        cart = [];
        isCartView = false; // 買完自動切回商城
        renderShop(currentKeyword);
    }
}

/**
 * 搜尋與清除搜尋
 */
function searchShop() {
    const searchInput = document.getElementById('shop-search');
    const clearBtn = document.getElementById('shop-search-clear-btn');
    if (!searchInput) return;

    const keyword = searchInput.value;
    
    if(clearBtn) {
        if(keyword.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    
    // 如果在購物車模式下搜尋，自動切回商品列表
    if(isCartView && keyword.length > 0) {
        isCartView = false;
    }
    
    renderShop(keyword);
}

function clearShopSearch() {
    const searchInput = document.getElementById('shop-search');
    const clearBtn = document.getElementById('shop-search-clear-btn');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    
    renderShop('');
}

/**
 * 輕量級提示通知
 */
function showNotification(msg) {
    let notify = document.getElementById('shop-notify');
    if (!notify) {
        notify = document.createElement('div');
        notify.id = 'shop-notify';
        notify.className = 'fixed top-1/4 left-1/2 -translate-x-1/2 z-[4000] bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl animate-in slide-in-from-top-10 fade-in duration-300 pointer-events-none';
        document.body.appendChild(notify);
    }
    notify.innerText = msg;
    notify.style.display = 'block';
    
    // 清除舊的計時器，避免快速點擊時閃爍
    if (window.shopNotifyTimer) clearTimeout(window.shopNotifyTimer);
    window.shopNotifyTimer = setTimeout(() => { 
        notify.style.display = 'none'; 
    }, 2000);
}

// 監聽與初次加載
document.addEventListener('DOMContentLoaded', () => {
    renderShop();
});

// 防禦性渲染
setTimeout(() => {
    const grid = document.getElementById('shop-grid');
    if (grid && grid.innerHTML.trim() === '') {
        renderShop();
    }
}, 150);
