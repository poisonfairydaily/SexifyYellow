const dict = {
    'zh': {
        'app_title': '發現',
        'shop_title': '商城',
        'msg_title': '訊息',
        'search_placeholder': '搜尋用戶或內容...',
        'shop_search': '搜尋寫真或商品...',
        'nav_home': '首頁',
        'nav_shop': '商城',
        'nav_msg': '訊息',
        'nav_me': '我',
        'settings': '設定與數據',
        'stats_subs': '訂閱人數',
        'stats_rev': '本月收入',
        'menu_personal': '個人中心',
        'menu_fans_subs': '粉絲與訂閱用戶',
        'menu_bookmarks': '我的收藏',
        'menu_orders': '訂單記錄',
        'menu_contact': '聯絡我們',
        'menu_lang': '切換語言 (EN/ZH)',
        'menu_logout': '登出帳號',
        'edit_profile': '編輯資料',
        'post_detail': '貼文詳情',
        'comments': '留言',
        'no_content': '找不到相關內容...'
    },
    'en': {
        'app_title': 'Discover',
        'shop_title': 'Shop',
        'msg_title': 'Messages',
        'search_placeholder': 'Search users or content...',
        'shop_search': 'Search items...',
        'nav_home': 'Home',
        'nav_shop': 'Shop',
        'nav_msg': 'Inbox',
        'nav_me': 'Me',
        'settings': 'Settings & Analytics',
        'stats_subs': 'Subscribers',
        'stats_rev': 'Revenue',
        'menu_personal': 'Personal Center',
        'menu_fans_subs': 'Fans & Subs',
        'menu_bookmarks': 'Bookmarks',
        'menu_orders': 'Order History',
        'menu_contact': 'Contact Us',
        'menu_lang': 'Language (中/EN)',
        'menu_logout': 'Logout',
        'edit_profile': 'Edit Profile',
        'post_detail': 'Post Detail',
        'comments': 'Comments',
        'no_content': 'No content found...'
    }
};

let currentLang = 'zh';

function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    translatePage();
    if(typeof renderDiscovery === 'function') renderDiscovery();
}

function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[currentLang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = dict[currentLang][key];
            } else {
                el.innerText = dict[currentLang][key];
            }
        }
    });
}

function t(key) {
    return dict[currentLang][key] || key;
}

document.addEventListener('DOMContentLoaded', translatePage);
