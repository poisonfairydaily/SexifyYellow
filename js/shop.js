// 商店數據與渲染邏輯
function renderShop() {
    const products = [
        { name: "福利私密圖", price: 49.0, oldPrice: 99.0, img: "https://picsum.photos/300/300?random=20" },
        { name: "1對1 私密聊天", price: 149.0, oldPrice: 299.0, img: "https://picsum.photos/300/300?random=21" },
        { name: "數位寫真集", price: 129.0, oldPrice: 199.0, img: "https://picsum.photos/300/300?random=22" },
        { name: "VIP 專屬 1個月", price: 99.0, oldPrice: 150.0, img: "https://picsum.photos/300/300?random=23" },
        { name: "限量拍立得", price: 399.0, oldPrice: 499.0, img: "https://picsum.photos/300/300?random=24" },
        { name: "聲音個性包", price: 29.0, oldPrice: 59.0, img: "https://picsum.photos/300/300?random=25" }
    ];
    
    document.getElementById('shop-grid').innerHTML = products.map(p => `
        <div class="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col border border-gray-100/50 relative">
            <div class="absolute top-1 left-1 bg-sexify text-white text-[8px] font-black px-1.5 py-0.5 rounded-full z-10 scale-90">HOT</div>
            
            <div class="aspect-square w-full overflow-hidden">
                <img src="${p.img}" class="w-full h-full object-cover active:scale-110 transition-transform duration-500">
            </div>
            <div class="p-2.5 flex-1 flex flex-col justify-between">
                <h4 class="text-[11px] font-bold truncate text-gray-800">${p.name}</h4>
                <div class="flex items-end gap-1.5 mt-1">
                    <p class="text-sexify font-black text-smleading-none">$${p.price.toFixed(1)}</p>
                    <p class="text-gray-300 line-through text-[9px] font-medium pb-0.5">$${p.oldPrice.toFixed(1)}</p>
                </div>
            </div>
        </div>
    `).join('');
}
