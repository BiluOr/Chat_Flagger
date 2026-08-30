// מעדכן את המספר (badge) על אייקון התוסף לפי כמות הדגלים השמורים
function updateBadge() {
    chrome.storage.local.get({ flags: [] }, (result) => {
        const count = result.flags.length;
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
    });
}

// מעדכן מיד כשה-service worker עולה (למקרה שהתוסף כבר טעון מהתקנה קודמת)
updateBadge();

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

// מאזין לכל שינוי ב-storage (הוספה/מחיקה/ניקוי דגלים) ומעדכן בזמן אמת
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.flags) {
        updateBadge();
    }
});
