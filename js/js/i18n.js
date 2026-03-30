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
        'menu_purchased': '已購買內容',
        'menu_creator': '成為創作者',
        'menu_help': '幫助中心',
        'menu_personal': '個人中心',
        'menu_fans_subs': '粉絲與訂閱用戶',
        'menu_lang': '切換語言 (EN/ZH)',
        'menu_logout': '登出帳號',
        'edit_profile': '編輯資料',
        'edit_avatar': '更換頭像',
        'post_free': '免費公開',
        'post_paid': '付費解鎖',
        'subscribe': '訂閱',
        'subscribed': '已訂閱',
        'chat_input': '發送訊息...',
        'send': '發送',
        'no_content': '找不到相關內容...',
        'age_title': '此空間包含成人內容',
        'age_desc': '進入即代表您已滿 18 歲',
        'age_btn': '確認進入',
        'tip': '打賞'
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
        'menu_purchased': 'Purchased',
        'menu_creator': 'Become a Creator',
        'menu_help': 'Help Center',
        'menu_personal': 'Personal Center',
        'menu_fans_subs': 'Fans & Subscriptions',
        'menu_lang': 'Language (中/EN)',
        'menu_logout': 'Logout',
        'edit_profile': 'Edit Profile',
        'edit_avatar': 'Change Avatar',
        'post_free': 'Free',
        'post_paid': 'Paid',
        'subscribe': 'Subscribe',
        'subscribed': 'Subscribed',
        'chat_input': 'Send a message...',
        'send': 'Send',
        'no_content': 'No content found...',
        'age_title': 'Adult Content Warning',
        'age_desc': 'By entering, you confirm you are 18+',
        'age_btn': 'Enter',
        'tip': 'Tip'
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