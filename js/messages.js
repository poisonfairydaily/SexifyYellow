let globalProducts = [
    { name: "福利私密圖", price: 49.0, oldPrice: 99.0, img: "https://picsum.photos/300/300?random=20" },
    { name: "1對1 私密聊天", price: 149.0, oldPrice: 299.0, img: "https://picsum.photos/300/300?random=21" },
    { name: "數位寫真集", price: 129.0, oldPrice: 199.0, img: "https://picsum.photos/300/300?random=22" },
    { name: "VIP 專屬 1個月", price: 99.0, oldPrice: 150.0, img: "https://picsum.photos/300/300?random=23" },
    { name: "限量拍立得", price: 399.0, oldPrice: 499.0, img: "https://picsum.photos/300/300?random=24" },
    { name: "聲音個性包", price: 29.0, oldPrice: 59.0, img: "https://picsum.photos/300/300?random=25" }
];

function renderShop(filterKeyword = '') {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    let displayProducts = globalProducts;
    if (filterKeyword.trim() !== '') {
        const kw = filterKeyword.toLowerCase();
        displayProducts = globalProducts.filter(p => p.name.toLowerCase().includes(kw));
    }

    if (displayProducts.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-10 text-gray-400 text-sm">找不到相關商品...</div>`;
        return;
    }

    grid.innerHTML = displayProducts.map(p => `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100/50 relative">
            <div class="absolute top-2 left-2 bg-sexify text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10 shadow">HOT</div>
            <div class="aspect-square w-full overflow-hidden">
                <img src="${p.img}" class="w-full h-full object-cover active:scale-110 transition-transform duration-500">
            </div>
            <div class="p-3">
                <h3 class="font-bold text-xs text-gray-800 mb-1 line-clamp-1">${p.name}</h3>
                <div class="flex items-end gap-1.5 mt-2">
                    <span class="text-sexify font-black text-sm">🪙 ${p.price}</span>
                    <span class="text-gray-300 text-[10px] line-through mb-0.5">${p.oldPrice}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// 供商城搜尋框呼叫
function searchShop() {
    const keyword = document.getElementById('shop-search').value;
    renderShop(keyword);
}
