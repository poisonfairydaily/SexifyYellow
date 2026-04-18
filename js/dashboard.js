/**
 * dashboard.js - 營運管理後台 (支援軟刪除、物理刪除與 AI 深度提醒)
 * 修復版：優化燈箱預覽體驗與退出機制
 */
const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 🛡️ 0. 安全核心：防止 XSS 攻擊 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- 🔐 1. 初始化門禁檢查 ---
window.onload = async () => {
    const listContainer = document.getElementById('audit-list');
    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError) throw new Error("驗證系統出錯: " + authError.message);
        
        if (!session) {
            alert("請先登入管理員帳號");
            window.location.href = 'index.html';
            return;
        }

        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError || !profile?.is_admin) {
            alert("⚠️ 權限不足：你不是管理員！");
            window.location.href = 'index.html';
            return;
        }

        loadAuditList();

    } catch (err) {
        console.error("💥 門禁系統崩潰:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; padding:50px;">系統異常: ${err.message}</td></tr>`;
    }
};

// --- 📂 2. 抓取資料邏輯 ---
async function loadAuditList() {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;">🚀 正在載入活躍商品列表...</td></tr>';

    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, reports(count)')
            .eq('is_archived', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderTable(products);

    } catch (err) {
        console.error("抓取失敗:", err);
        listContainer.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">抓取資料失敗: ${err.message}</td></tr>`;
    }
}

// --- 🖼️ 3. 渲染表格 ---
function renderTable(products) {
    const listContainer = document.getElementById('audit-list');
    listContainer.innerHTML = '';

    if (!products || products.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:50px;color:gray;">目前沒有待處理的活躍商品</td></tr>';
        return;
    }

    products.forEach(p => {
        const report = p.ai_report || {};
        const allFiles = p.image_url?.split(',') || [];
        const imagesHtml = allFiles.map(fileName => {
            const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/previews/${fileName.trim()}`;
            return `<img src="${imgUrl}" onclick="openLightbox('${imgUrl}')" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #eee; cursor: zoom-in;">`;
        }).join('');
        
        let reportCount = 0;
        if (p.reports && p.reports.length > 0) reportCount = p.reports[0].count;

        const getClr = (v) => (v === 'LIKELY' || v === 'VERY_LIKELY') ? '#ff4d4f' : '#8c8c8c';
        const isSuspicious = Object.values(report).some(v => v === 'POSSIBLE' || v === 'LIKELY' || v === 'VERY_LIKELY');

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #eee";
        if (isSuspicious) tr.style.backgroundColor = "#fffbe6";

        tr.innerHTML = `
            <td style="padding: 15px;"><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 190px;">${imagesHtml}</div></td>
            <td style="padding: 15px;">
                <div style="font-weight:bold;">${escapeHTML(p.name)}</div>
                <div style="margin-top:5px;">
                    <span style="font-size:10px; background:#f0f0f0; padding:2px 6px; border-radius:4px;">${p.status}</span>
                    ${p.is_official ? '<span style="font-size:10px; background:#e6f7ff; color:#1890ff; padding:2px 6px; border-radius:4px; margin-left:4px;">官方</span>' : ''}
                </div>
                ${reportCount > 0 ? `<div style="color:#ff4d4f; font-size:11px; margin-top:4px;">⚠️ 被用戶檢舉: ${reportCount} 次</div>` : ''}
            </td>
            <td style="padding: 15px; font-weight:bold; color:#ff2442;">🪙 ${p.price}</td>
            <td style="padding: 15px; font-size: 11px; font-family: monospace;">
                <div style="color: ${getClr(report.violence)}">💀 暴力: ${report.violence || 'N/A'}</div>
                <div style="color: ${getClr(report.racy)}">👙 挑逗: ${report.racy || 'N/A'}</div>
                <div style="color: ${getClr(report.medical)}">🏥 醫療: ${report.medical || 'N/A'}</div>
            </td>
            <td style="padding: 15px;">
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button onclick="updateStatus('${p.id}', 'approved')" style="background:#52c41a; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">通過</button>
                    <button onclick="archiveProduct('${p.id}')" style="background:#faad14; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">下架封存</button>
                    <button onclick="hardDeleteProduct('${p.id}', '${p.image_url}')" 
                            style="background:none; color:#ff4d4f; border:1px solid #ff4d4f; padding:6px; border-radius:8px; cursor:pointer; font-size:10px; font-weight:bold;">
                            徹底刪除 (違規)
                    </button>
                </div>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

// --- 🔍 4. 功能函數 ---

// ✨ 修正版燈箱：解決預覽與退出問題
window.openLightbox = function(url) {
    let overlay = document.getElementById('audit-lightbox');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-lightbox';
        // 使用 fixed 定位，z-index 設為最高
        overlay.style = `
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.9); 
            z-index: 10000; 
            display: none; 
            align-items: center; 
            justify-content: center; 
            cursor: pointer;
            backdrop-filter: blur(5px);
        `;
        
        // 點擊背景任何地方就關閉
        overlay.onclick = function() {
            this.style.display = 'none';
            document.body.style.overflow = 'auto'; // 恢復背景捲動
        };
        
        document.body.appendChild(overlay);
    }

    // 注入大圖，使用 stopPropagation 防止點擊圖片時觸發父層關閉
    overlay.innerHTML = `
        <div style="position:relative; max-width:90%; max-height:90%; display:flex; justify-content:center; align-items:center;">
            <img src="${url}" 
                 style="max-width:100%; max-height:100%; border-radius:8px; box-shadow: 0 0 30px rgba(0,0,0,0.5); cursor: default;"
                 onclick="event.stopPropagation();" 
                 onerror="this.src='https://placehold.co/600x400?text=圖片載入失敗';">
            <div style="position:absolute; top:-40px; right:0; color:white; font-size:30px; font-family:sans-serif; font-weight:bold;">&times;</div>
        </div>
    `;

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // 禁止背景捲動
};

// 軟刪除 (下架)
window.archiveProduct = async (id) => {
    const ok = confirm("確定要下架此商品嗎？\n下架後商品將不再顯示，但會保留歷史交易紀錄。");
    if (!ok) return;

    const { error } = await supabaseClient
        .from('products')
        .update({ is_archived: true })
        .eq('id', id);

    if (error) alert("下架失敗: " + error.message);
    else loadAuditList();
};

// 徹底刪除
window.hardDeleteProduct = async (id, imageUrls) => {
    const ok = confirm("🚨 🚨 🚨 極度警告 🚨 🚨 🚨\n\n此操作將會「永遠刪除」該商品及其所有圖片檔案。\n此操作無法撤銷，確定執行嗎？");
    if (!ok) return;

    try {
        const { error: dbError } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);
        
        if (dbError) throw dbError;

        const fileNames = imageUrls.split(',').map(name => name.trim());
        if (fileNames.length > 0) {
            await supabaseClient.storage.from('products').remove(fileNames);
            await supabaseClient.storage.from('previews').remove(fileNames);
        }

        alert("🗑️ 商品及其檔案已徹底清除。");
        loadAuditList();

    } catch (err) {
        alert("刪除失敗: " + err.message);
    }
};

// 更新審核狀態
window.updateStatus = async (id, newStatus) => {
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', id);
    if (error) alert("操作失敗: " + error.message);
    else loadAuditList();
};
