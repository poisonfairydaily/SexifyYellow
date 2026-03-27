// 個人頁照片牆渲染邏輯
function renderProfile() {
    const grid = document.getElementById('user-gallery');
    if(grid.innerHTML !== "") return; // 防止重複渲染
    let items = "";
    for(let i=1; i<=12; i++) {
        items += `<div class="aspect-square bg-gray-100 overflow-hidden"><img src="https://picsum.photos/200/200?random=${i+50}" class="w-full h-full object-cover hover:scale-110 transition duration-300"></div>`;
    }
    grid.innerHTML = items;
}
