/**
 * admin.js - 究極管理員核心版 (穩定原生 UI 版 + 檢舉系統)
 * 功能：雙桶 R2 對接、WebP 壓縮、AI 報告解析、全域內容控制、用戶行為檢舉審查
 */

const SUPABASE_URL = 'https://shsmvbeebuxscnvnmlzf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoc212YmVlYnV4c2Nudm5tbHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDU5MTgsImV4cCI6MjA5MDQyMTkxOH0.kK5A0RYj6RrzBJHMleKcFQp4wVq7hCm-lVDTbnxrFJQ';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✨ Worker 代理網址 (結尾不要帶斜槓)
const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev';

const loginSec = document.getElementById('login-section');
const adminSec = document.getElementById('admin-section'); 
const adminDash = document.getElementById('admin-dashboard'); 
const statusText = document.getElementById('status');
const previewContainer = document.getElementById('preview-container');

// --- 🛡️ 0. 安全與顏色核心 ---
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getAiColor(v) {
    if (v === 'VERY_LIKELY' || v === 'LIKELY') return '#ff4d4f'; 
    if (v === 'POSSIBLE') return '#faad14'; 
    return '#8c8c8c'; 
}

// --- 🔐 1. 初始化與門禁系統 ---
window.onload = async () => {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            if(loginSec) loginSec.style.display = 'block';
            return;
        }

        const { data: profile, error: pError } = await supabaseClient
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();

        if (pError || !profile?.is_admin) {
            alert("⚠️ 權限不足：您不是管理員");
            await supabaseClient.auth.signOut();
            location.reload();
            return;
        }

        if(loginSec) loginSec.style.display = 'none';
        
        if(adminDash) {
            adminDash.style.display = 'flex';
            
            // 載入所有資料庫內容
            loadPendingProducts();
            loadRecentPosts();
            loadAuditList(); 
            loadUserReports(); // ✨ 載入檢舉清單
        } else if (adminSec) {
            adminSec.style.display = 'block';
        }
        
    } catch (err) {
        console.error("初始化失敗:", err);
        if(loginSec) loginSec.style.display = 'block';
    }
};

// --- 🔄 2. 頁籤切換邏輯 (純 CSS 控制，永不黑屏) ---
window.switchTab = function(tabId) {
    // 隱藏所有內容區塊
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // 取消所有按鈕的高亮狀態
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 顯示目標區塊
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    
    // 高亮當前點擊的按鈕
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
};

// --- 🖼️ 3. 預覽與影像處理工具 ---
const pImageInput = document.getElementById('p-image');
if (pImageInput) {
    pImageInput.addEventListener('change', (e) => {
        if(!previewContainer) return;
        previewContainer.innerHTML = '';
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.className = 'preview-img';
                img.style = "width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin: 4px; border: 1px solid #eee;";
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}

// --- 🚀 4. 官方商品上架 (自動進入 MY_BUCKET) ---
const uploadBtn = document.getElementById('upload-btn');
if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const rawName = document.getElementById('p-name')?.value.trim();
        const price = document.getElementById('p-price')?.value;
        const desc = document.getElementById('p-desc')?.value.trim() || ''; 
        const files = document.getElementById('p-image')?.files;

        if (!rawName || !price || !files || files.length === 0) return alert("請填寫標題、價格與圖片");

        uploadBtn.disabled = true;
        if(statusText) statusText.innerText = "⏳ 執行管理員權限上傳中...";

        try {
            if(statusText) statusText.innerText = `🔍 AI 掃描與壓縮中 (0/${files.length})...`;
            let completedCount = 0;

            const uploadPromises = Array.from(files).map(async (file, i) => {
                const base64Str = await fileToBase64(file);
                const { data: audit } = await supabaseClient.functions.invoke('vision-audit', {
                    body: { imageBase64: base64Str }
                });

                const aiReport = audit?.safeSearchAnnotation || audit;

                const webpBlob = await window.generateWebPBlob(file);
                const fileName = `product_official_${Date.now()}_${i}.webp`;

                const publicUrl = await uploadToR2(webpBlob, fileName);

                completedCount++;
                if(statusText) statusText.innerText = `🔍 AI 掃描與壓縮中 (${completedCount}/${files.length})...`;

                return { publicUrl, aiReport };
            });

            const results = await Promise.all(uploadPromises);

            const uploadedFileUrls = results.map(r => r.publicUrl);
            const lastAiReport = results.length > 0 ? results[results.length - 1].aiReport : null;

            const { error: dbError } = await supabaseClient.from('products').insert([{
                name: rawName,
                price: parseInt(price),
                description: desc, 
                image_url: uploadedFileUrls.join(','),
                user_id: (await supabaseClient.auth.getUser()).data.user.id,  
                status: 'approved',
                is_official: true, 
                ai_report: lastAiReport
            }]);

            if (dbError) throw dbError;
            alert("🎉 官方商品已成功發布！");
            location.reload();

        } catch (err) {
            console.error(err);
            if(statusText) statusText.textContent = "❌ 出錯了：" + err.message;
            uploadBtn.disabled = false;
        }
    });
}

// --- 🛡️ 5. 待審核清單 (Pending Products) ---
window.loadPendingProducts = async function() {
    const grid = document.getElementById('products-grid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10">載入中...</div>';
    
    try {
        const { data, error } = await supabaseClient.from('products')
            .select('*, profiles!user_id(display_name)')
            .eq('is_official', false)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        grid.innerHTML = (data || []).map(item => {
            let firstImg = item.image_url.split(',')[0];
            let imgPath = firstImg;
            if (firstImg.includes('r2.dev') || firstImg.includes('workers.dev')) {
                imgPath = `${WORKER_URL}/products/${firstImg.split('/').pop()}`;
            }

            const report = item.ai_report?.safeSearchAnnotation || item.ai_report || {};
            const valAdult = report.adult || report.adultLikelihood || 'N/A';

            return `
            <div class="bg-white border rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-44 bg-gray-100 relative cursor-zoom-in" onclick="openLightbox('${imgPath}')">
                    <img src="${imgPath}" class="w-full h-full object-cover">
                    <span class="absolute top-2 left-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-1 rounded">待審核</span>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-bold text-sm truncate">${escapeHTML(item.name)}</h3>
                    <p class="text-[10px] text-gray-500 mb-2">來自: ${escapeHTML(item.profiles?.display_name)}</p>
                    <div class="mb-4 text-[10px] ${getAiColor(valAdult) === '#ff4d4f' ? 'bg-red-50' : 'bg-gray-50'} p-2 rounded">
                        🔞 成人偵測: <span style="color:${getAiColor(valAdult)}">${valAdult}</span>
                    </div>
                    <div class="mt-auto flex gap-2">
                        <button onclick="approveProduct('${item.id}')" class="flex-1 bg-green-500 text-white font-bold py-2 rounded-lg text-xs">核准</button>
                        <button onclick="hardDeleteProduct('${item.id}', '${item.image_url}')" class="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-lg text-xs">刪除</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

// --- 🛡️ 6. 活躍商品列表中控 (Audit List) ---
window.loadAuditList = async function() {
    const listContainer = document.getElementById('audit-list');
    if(!listContainer) return;

    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*, profiles!user_id(display_name)')
            .eq('is_archived', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        listContainer.innerHTML = (products || []).map(p => {
            const report = p.ai_report?.safeSearchAnnotation || p.ai_report || {};
            const imagesHtml = (p.image_url?.split(',') || []).map(url => {
                let imgUrl = url;
                if (url.includes('r2.dev') || url.includes('workers.dev')) {
                    imgUrl = `${WORKER_URL}/products/${url.split('/').pop()}`;
                }
                return `<img src="${imgUrl}" onclick="openLightbox('${imgUrl}')" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; margin: 2px;">`;
            }).join('');

            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${imagesHtml}</td>
                    <td style="padding: 10px;">
                        <div class="font-bold">${escapeHTML(p.name)}</div>
                        <div style="font-size:10px; color:gray;">${escapeHTML(p.profiles?.display_name)}</div>
                    </td>
                    <td style="padding: 10px; font-weight:bold; color:#ff2442;">🪙 ${p.price || p.price_usd}</td>
                    <td style="padding: 10px; font-size:10px;">🔞成人: ${report.adult || 'N/A'}<br>💀暴力: ${report.violence || 'N/A'}</td>
                    <td style="padding: 10px;">
                        <button onclick="archiveProduct('${p.id}')" style="background:#faad14; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">下架</button>
                        <button onclick="hardDeleteProduct('${p.id}', '${p.image_url}')" style="background:none; color:#ff4d4f; border:none; font-size:10px; margin-left:10px;">徹底刪除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch(e) { console.error(e); }
};

// --- 🛡️ 7. 用戶貼文管理 (對接 POST_BUCKET) ---
window.loadRecentPosts = async function() {
    const grid = document.getElementById('posts-grid');
    if(!grid) return;
    
    try {
        const { data, error } = await supabaseClient.from('posts')
            .select('*, profiles!user_id(display_name)')
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;

        grid.innerHTML = (data || []).map(post => {
            let imgPath = post.media_url;
            if (imgPath && (imgPath.includes('r2.dev') || imgPath.includes('workers.dev'))) {
                imgPath = `${WORKER_URL}/media/${imgPath.split('/').pop()}`;
            }

            return `
            <div class="bg-white border rounded-2xl overflow-hidden shadow-sm p-3">
                <img src="${imgPath}" class="w-full h-32 object-cover rounded-lg mb-2" onclick="openLightbox('${imgPath}')" onerror="this.src='https://placehold.co/200?text=No+Image'">
                <p class="text-[11px] text-gray-800 line-clamp-2">${escapeHTML(post.caption)}</p>
                <p class="text-[10px] text-blue-500 font-bold mt-1">@${escapeHTML(post.profiles?.display_name)}</p>
                <button onclick="deleteRecord('posts', '${post.id}')" class="w-full bg-red-500 text-white text-[10px] py-1 rounded-lg mt-2">強制刪除貼文</button>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};


// --- 🚨 8. 用戶檢舉管理中心 (User Reports) ---
// --- 🚨 8. 用戶檢舉管理中心 (User Reports) - 防彈查詢版 ---
window.loadUserReports = async function() {
    const list = document.getElementById('user-reports-list');
    if(!list) return;

    try {
        // 第一步：先單純拉取檢舉紀錄 (不使用容易報錯的 Join)
        const { data: reports, error } = await supabaseClient
            .from('user_reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!reports || reports.length === 0) {
            list.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-gray-400 font-bold">🎉 目前沒有待處理的檢舉</td></tr>`;
            return;
        }

        // 第二步：收集所有牽涉到的 User IDs (檢舉人 + 被檢舉人)
        const userIds = [...new Set(reports.flatMap(r => [r.reporter_id, r.reported_user_id]))];

        // 第三步：一次過抓取這些使用者的 Profiles
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, display_name, username')
            .in('id', userIds);

        // 建立字典方便對應 (ID -> Profile)
        const profMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

        // 渲染畫面
        list.innerHTML = reports.map(r => {
            const statusColor = r.status === 'resolved' ? 'text-green-600 bg-green-50' : (r.status === 'dismissed' ? 'text-gray-500 bg-gray-100' : 'text-red-600 bg-red-50');
            const statusText = r.status === 'resolved' ? '已處分' : (r.status === 'dismissed' ? '已駁回' : '待處理');
            
            // 抓出名字，找不到就顯示未知
            const reporter = profMap[r.reporter_id] || { display_name: '未知用戶', username: 'unknown' };
            const reported = profMap[r.reported_user_id] || { display_name: '未知用戶', username: 'unknown' };
            
            // 處理證據圖片
            let imgHtml = '';
            if (r.screenshot_url) imgHtml += `<img src="${r.screenshot_url}" onclick="openLightbox('${r.screenshot_url}')" class="w-10 h-10 rounded object-cover cursor-zoom-in border border-red-200" title="用戶上傳的截圖">`;
            if (r.evidence_image) imgHtml += `<img src="${r.evidence_image}" onclick="openLightbox('${r.evidence_image}')" class="w-10 h-10 rounded object-cover cursor-zoom-in border border-gray-200 ml-1" title="原訊息夾帶的媒體">`;

            return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="p-3">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${statusColor}">${statusText}</span>
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-900">${escapeHTML(reported.display_name)}</div>
                    <div class="text-[10px] text-gray-400">@${escapeHTML(reported.username)}</div>
                    <div class="text-[9px] text-gray-300 mt-1">檢舉人: ${escapeHTML(reporter.display_name)}</div>
                </td>
                <td class="p-3 max-w-xs">
                    <div class="text-xs font-bold text-red-500 mb-1">事由: ${escapeHTML(r.reason)}</div>
                    ${r.evidence_text ? `<div class="text-[11px] text-gray-600 bg-gray-100 p-2 rounded line-clamp-2">" ${escapeHTML(r.evidence_text)} "</div>` : ''}
                </td>
                <td class="p-3 flex items-center">${imgHtml || '<span class="text-xs text-gray-300">無圖片</span>'}</td>
                <td class="p-3">
                    ${r.status === 'pending' ? `
                        <button onclick="updateReportStatus('${r.id}', 'resolved')" class="bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 rounded mr-1">處分/警告</button>
                        <button onclick="updateReportStatus('${r.id}', 'dismissed')" class="bg-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded mt-1">無違規駁回</button>
                    ` : `
                        <button onclick="deleteRecord('user_reports', '${r.id}')" class="text-gray-300 hover:text-red-500 text-[10px] underline mt-1">刪除紀錄</button>
                    `}
                </td>
            </tr>`;
        }).join('');

    } catch (e) {
        console.error("載入檢舉清單失敗:", e);
        list.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500">載入失敗: ${escapeHTML(e.message)}</td></tr>`;
    }
};

// --- 🛠️ 9. 全域管理功能 (刪除/下架/燈箱) ---
window.approveProduct = async (id) => {
    if(!confirm("核准上架？")) return;
    const { error } = await supabaseClient.from('products').update({ status: 'approved' }).eq('id', id);
    if (!error) { loadPendingProducts(); loadAuditList(); }
};

window.archiveProduct = async (id) => {
    if(!confirm("確定下架？")) return;
    const { error } = await supabaseClient.from('products').update({ is_archived: true, status: 'rejected' }).eq('id', id);
    if (!error) { loadAuditList(); loadPendingProducts(); }
};

window.hardDeleteProduct = async (id, imageUrls) => {
    if(!confirm("🚨 警告：這將永久刪除該商品及所有關聯數據，確定嗎？")) return;
    try {
        await supabaseClient.from('reports').delete().eq('product_id', id);
        const { error } = await supabaseClient.from('products').delete().eq('id', id);
        if (error) throw error;
        alert("🗑️ 已徹底刪除");
        loadAuditList(); loadPendingProducts();
    } catch(e) { alert("刪除受阻，可能已有訂單紀錄。"); }
};

window.deleteRecord = async (table, id) => {
    if(!confirm(`確定要刪除這筆紀錄嗎？`)) return;
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (!error) { 
        alert("已刪除"); 
        if (table === 'posts') loadRecentPosts(); 
        if (table === 'user_reports') loadUserReports();
    }
};

window.openLightbox = function(url) {
    let overlay = document.getElementById('audit-lightbox');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-lightbox';
        overlay.style = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); cursor: pointer;`;
        overlay.onclick = () => { overlay.style.display = 'none'; };
        document.body.appendChild(overlay);
    }
    // 判斷是否為影片
    if(url.match(/\.(mp4|webm|mov|ogg)$/i)) {
        overlay.innerHTML = `<video src="${url}" controls autoplay class="max-w-[90%] max-h-[90%] rounded-lg border-2 border-white"></video>`;
    } else {
        overlay.innerHTML = `<img src="${url}" style="max-width:90%; max-height:90%; border-radius:10px; border:2px solid white;">`;
    }
    overlay.style.display = 'flex';
};
