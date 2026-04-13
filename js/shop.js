/**
 * shop.js
 * * 商店頁面核心邏輯
 * 包含：商品資料管理、動態渲染、搜尋過濾、商品詳情模態視窗、
 * 購物車系統 (加入、檢視、移除、結算) 以及購買邏輯。
 */

// 1. 全域商品資料與購物車狀態
let globalProducts = [
    { 
        id: 1, 
        name: "福利私密圖", 
        price: 49.0, 
        oldPrice: 99.0, 
        img: "https://picsum.photos/300/300?random=20", 
        desc: "內含 15 張未公開高畫質精美福利圖，解鎖專屬誘惑。" 
    },
    { 
        id: 2, 
        name: "1對1 私密聊天", 
        price: 149.0, 
        oldPrice: 299.0, 
        img: "https://picsum.photos/300/300?random=21", 
        desc: "專屬 30 分鐘線上私密語音/文字聊天，享受獨處時光。" 
    },
    { 
        id: 3, 
        name: "數位寫真集", 
        price: 129.0, 
        oldPrice: 199.0, 
        img: "https://picsum.photos/300/300?random=22", 
        desc: "超過 50 頁的精美數位寫真，包含多套造型完整收藏。" 
    },
    { 
        id: 4, 
        name: "VIP 專屬 1個月", 
        price: 99.0, 
        oldPrice: 150.0, 
        img: "https://picsum.photos/300/300?random=23", 
        desc: "開通一個月 VIP 特權，全站部分圖集免費看、享有專屬徽章。" 
    },
    { 
        id: 5, 
        name: "限量拍立得", 
        price: 399.0, 
        oldPrice: 499.0, 
        img: "https://picsum.photos/300/300?random=24", 
        desc: "實體限量親筆簽名拍立得一張，全球免運費寄送。" 
    },
    { 
        id: 6, 
        name: "聲音個性包", 
        price: 29.0, 
        oldPrice: 59.0, 
        img: "https://picsum.photos/300/300?random=25", 
        desc: "包含 5 段專屬早安、晚安及撒嬌語音留言。" 
    }
];

let cart = []; // 儲存已加入購物車的商品

/**
 * 初始化懸浮購物車按鈕
 */
function initCartUI() {
    if (!document.getElementById('floating-cart-btn')) {
        const btnContainer = document.createElement('div');
        btnContainer.id = 'floating-cart-btn';
        btnContainer.innerHTML = `
            <button onclick="openCartModal()" class="fixed bottom-20 right-4 lg:bottom-10 lg:right-10 bg-white border border-gray-100 text-gray-800 rounded-full w-14 h-14 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center z-[2000] hover:scale-105 active:scale-95 transition-all">
                <i class="fa-solid fa-cart-shopping text-xl"></i>
                <span id="cart-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-sm transform scale-0 transition-transform duration-300">0</span>
            </button>
        `;
        document.body.appendChild(btnContainer);
    }
    updateCartBadge();
}

/**
 * 更新購物車角標數字
 */
function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
        if (cart.length > 0) {
            badge.innerText = cart.length;
            badge.classList.remove('scale-0');
            badge.classList.add('scale-100');
        } else {
            badge.classList.remove('scale-100');
            badge.classList.add('scale-0');
        }
    }
}

/**
 * 執行商店網格渲染
 * @param {string} filterKeyword - 搜尋關鍵字
 */
function renderShop(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) {
        console.error("找不到 shop-grid，請確認 HTML 結構中具備 id='shop-grid' 的容器");
        return;
    }

    let displayProducts = globalProducts;
    if (filterKeyword.trim() !== '') {
        const kw = filterKeyword.toLowerCase();
        displayProducts = globalProducts.filter(p => 
            p.name.toLowerCase().includes(kw) || 
            p.desc.toLowerCase().includes(kw)
        );
    }

    if (displayProducts.length === 0) {
        grid.innerHTML = `
            <div class="col-span-2 flex flex-col items-center justify-center py-20 text-gray-400">
                <i class="fa-solid fa-magnifying-glass mb-3 text-3xl opacity-20"></i>
                <p class="text-sm">找不到相關商品...</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = displayProducts.map(p => `
        <div onclick="openProductModal(${p.id})" 
             class="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100 relative transform transition-all duration-300 active:scale-95 hover:shadow-md">
            
            <div class="absolute top-2 left-2 bg-sexify text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10 shadow-sm">
                HOT
            </div>
            
            <div class="aspect-square w-full overflow-hidden bg-gray-50">
                <img src="${p.img}" 
                     alt="${p.name}"
                     class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
            </div>
            
            <div class="p-3">
                <h3 class="font-bold text-xs text-gray-800 mb-1 line-clamp-1 group-hover:text-sexify transition-colors">
                    ${p.name}
                </h3>
                <div class="flex items-end gap-1.5 mt-2">
                    <span class="text-sexify font-black text-sm">🪙 ${p.price}</span>
                    <span class="text-gray-300 text-[10px] line-through mb-0.5">${p.oldPrice}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * 處理搜尋輸入事件
 */
function searchShop() {
    const searchInput = document.getElementById('shop-search');
    const clearBtn = document.getElementById('shop-search-clear-btn');
    
    if (!searchInput) return;
    const keyword = searchInput.value;
    
    if (clearBtn) {
        if (keyword.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    renderShop(keyword);
}

/**
 * 清除搜尋內容並重置列表
 */
function clearShopSearch() {
    const searchInput = document.getElementById('shop-search');
    const clearBtn = document.getElementById('shop-search-clear-btn');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    
    renderShop('');
}

/**
 * 開啟商品詳情模態視窗
 * @param {number} productId 
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
        <div class="fixed inset-0 bg-black/70 z-[3500] flex items-center justify-center p-4 backdrop-blur-md transition-all animate-in fade-in duration-300" 
             onclick="closeProductModal()">
            
            <div class="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden flex flex-col relative shadow-2xl transform animate-in zoom-in-95 duration-300" 
                 onclick="event.stopPropagation()">
                
                <button onclick="closeProductModal()" 
                        class="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white rounded-full w-9 h-9 flex items-center justify-center z-10 backdrop-blur-xl transition-all active:scale-90">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>

                <div class="w-full aspect-square bg-gray-100">
                    <img src="${product.img}" alt="${product.name}" class="w-full h-full object-cover">
                </div>

                <div class="p-6 flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <h2 class="text-xl font-extrabold text-gray-900">${product.name}</h2>
                        <p class="text-gray-500 text-sm leading-relaxed min-h-[3rem]">
                            ${product.desc}
                        </p>
                    </div>
                    
                    <div class="flex flex-col mt-2 pt-4 border-t border-gray-50">
                        <div class="flex items-end gap-2 mb-4">
                            <span class="text-sexify font-black text-2xl">🪙 ${product.price}</span>
                            <span class="text-gray-400 text-xs line-through mb-1">原價 ${product.oldPrice}</span>
                        </div>
                        
                        <div class="flex gap-3 w-full">
                            <button onclick="addToCart(${product.id})" 
                                    class="flex-1 bg-orange-50 text-orange-500 font-bold py-3 rounded-xl hover:bg-orange-100 active:scale-95 transition-all text-sm flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-cart-plus"></i> 加入購物車
                            </button>
                            <button onclick="directPurchase(${product.id})" 
                                    class="flex-1 bg-sexify text-white font-bold py-3 rounded-xl shadow-lg shadow-sexify/20 hover:brightness-110 active:scale-95 transition-all text-sm">
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
    if (!document.getElementById('cart-modal-container')) {
        document.body.style.overflow = '';
    }
}

/**
 * 加入購物車
 * @param {number} productId 
 */
function addToCart(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;
    
    cart.push(product);
    updateCartBadge();
    
    // 簡單的提示回饋
    const toast = document.createElement('div');
    toast.className = 'fixed top-10 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-full text-sm font-bold z-[4000] animate-in slide-in-from-top-5 fade-in duration-300';
    toast.innerText = `已加入購物車：${product.name}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

/**
 * 直接購買（帶有二次確認）
 * @param {number} productId 
 */
function directPurchase(productId) {
    if (confirm('確定要購買嗎？')) {
        confirmPurchase(productId);
    }
}

/**
 * 確認單一商品購買邏輯
 * @param {number} productId 
 */
function confirmPurchase(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;
    
    alert(`購買成功！\n已解鎖「${product.name}」\n扣除金幣：${product.price}`);
    closeProductModal();
}

/**
 * 開啟購物車模態視窗
 */
function openCartModal() {
    let cartContainer = document.getElementById('cart-modal-container');
    if (!cartContainer) {
        cartContainer = document.createElement('div');
        cartContainer.id = 'cart-modal-container';
        document.body.appendChild(cartContainer);
    }

    renderCartContent();
    document.body.style.overflow = 'hidden';
}

/**
 * 關閉購物車模態視窗
 */
function closeCartModal() {
    const cartContainer = document.getElementById('cart-modal-container');
    if (cartContainer) cartContainer.innerHTML = '';
    document.body.style.overflow = '';
}

/**
 * 渲染購物車內部內容與計算總價
 */
function renderCartContent() {
    const cartContainer = document.getElementById('cart-modal-container');
    if (!cartContainer) return;

    let totalAmount = cart.reduce((sum, item) => sum + item.price, 0);
    
    let itemsHTML = '';
    if (cart.length === 0) {
        itemsHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-gray-400">
                <i class="fa-solid fa-cart-shopping mb-4 text-4xl opacity-20"></i>
                <p class="text-sm font-bold">購物車空空如也</p>
                <p class="text-xs mt-1">快去挑選喜歡的商品吧！</p>
            </div>
        `;
    } else {
        itemsHTML = cart.map((item, index) => `
            <div class="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl mb-3 border border-gray-100/50 relative">
                <img src="${item.img}" class="w-16 h-16 rounded-xl object-cover shadow-sm">
                <div class="flex-1 flex flex-col">
                    <h4 class="text-sm font-bold text-gray-800 line-clamp-1">${item.name}</h4>
                    <span class="text-sexify font-black text-sm mt-1">🪙 ${item.price}</span>
                </div>
                <button onclick="removeFromCart(${index})" class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </div>
        `).join('');
    }

    cartContainer.innerHTML = `
        <div class="fixed inset-0 bg-black/70 z-[3500] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-md transition-all animate-in fade-in duration-300" 
             onclick="closeCartModal()">
            
            <div class="bg-white w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden flex flex-col relative shadow-2xl h-[85vh] sm:h-auto sm:max-h-[85vh] transform animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300" 
                 onclick="event.stopPropagation()">
                
                <div class="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <i class="fa-solid fa-cart-shopping"></i> 購物車
                    </h2>
                    <button onclick="closeCartModal()" class="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition-all active:scale-90">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-5 overflow-y-auto flex-1 custom-scrollbar">
                    ${itemsHTML}
                </div>

                <div class="p-5 border-t border-gray-100 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-gray-500 text-sm font-bold">總計金額</span>
                        <span class="text-sexify font-black text-2xl">🪙 ${totalAmount}</span>
                    </div>
                    <button onclick="checkoutCart()" 
                            class="w-full bg-sexify text-white font-bold py-3.5 rounded-xl shadow-lg shadow-sexify/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                            ${cart.length === 0 ? 'disabled' : ''}>
                        去買單 (${cart.length} 件)
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 從購物車中移除商品
 * @param {number} index 
 */
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartBadge();
    renderCartContent(); // 重新渲染購物車內容
}

/**
 * 結算購物車
 */
function checkoutCart() {
    if (cart.length === 0) return;
    
    if (confirm(`確定要一次購買這 ${cart.length} 件商品嗎？`)) {
        let totalAmount = cart.reduce((sum, item) => sum + item.price, 0);
        let itemNames = cart.map(item => `• ${item.name}`).join('\n');
        
        alert(`結帳成功！\n已解鎖以下商品：\n${itemNames}\n\n總共扣除金幣：${totalAmount}`);
        
        // 清空購物車
        cart = [];
        updateCartBadge();
        closeCartModal();
    }
}

/**
 * 監聽 DOM 載入完成，執行初始渲染與 UI 初始化
 */
document.addEventListener('DOMContentLoaded', () => {
    renderShop();
    initCartUI();
});

/**
 * 防禦性重新檢查機制
 */
setTimeout(() => {
    const grid = document.getElementById('shop-grid');
    if (grid && grid.innerHTML.trim() === '') {
        renderShop();
    }
    initCartUI();
}, 300);
