// מזהה ייחודי לכל דגל (לא תלוי בקריפטו כדי שיעבוד גם באתרי http)
function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// 1. שמירת ההודעה (Shift + F)
document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key.toLowerCase() === 'f') {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText.length > 0) {
            chrome.storage.local.get({ flags: [] }, (result) => {
                const fullUrl = window.location.href;

                const newFlag = {
                    id: generateId(),
                    text: selectedText.substring(0, 60) + (selectedText.length > 60 ? "..." : ""),
                    fullText: selectedText,
                    url: fullUrl,
                    timestamp: new Date().toLocaleString(),
                    tag: null
                };

                const updatedFlags = [...result.flags, newFlag];

                chrome.storage.local.set({ flags: updatedFlags }, () => {
                    showTagToast(newFlag.id);
                });
            });
        }
    }
});

// טוסט לאחר שמירה: מאשר שמירה ומאפשר לתייג באופן מיידי (אופציונלי)
function showTagToast(flagId) {
    const toast = document.createElement('div');
    toast.setAttribute('dir', 'rtl');
    toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:#333; color:white; padding:12px 14px; border-radius:8px; z-index:2147483647; font-family:sans-serif; box-shadow: 0px 4px 10px rgba(0,0,0,0.3); font-size:13px; display:flex; flex-direction:column; gap:8px; max-width:260px;";

    const title = document.createElement('div');
    title.textContent = "🚩 ההודעה סומנה ונשמרה!";
    title.style.cssText = "font-weight:bold;";
    toast.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = "אפשר להוסיף תגית (אופציונלי):";
    subtitle.style.cssText = "font-size:11px; color:#ccc;";
    toast.appendChild(subtitle);

    const tagsRow = document.createElement('div');
    tagsRow.style.cssText = "display:flex; gap:6px; flex-wrap:wrap;";

    const tags = [
        { label: '⭐ חשוב', value: 'חשוב' },
        { label: '🔍 לבדוק', value: 'לבדוק' },
        { label: '💡 רעיון', value: 'רעיון' }
    ];

    tags.forEach(t => {
        const btn = document.createElement('button');
        btn.textContent = t.label;
        btn.style.cssText = "background:#4CAF50; color:white; border:none; padding:5px 8px; border-radius:5px; font-size:12px; cursor:pointer; font-family:inherit;";
        btn.addEventListener('mouseenter', () => btn.style.opacity = '0.85');
        btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
        btn.addEventListener('click', () => {
            applyTag(flagId, t.value);
            title.textContent = `✓ תויג בתור "${t.value}"`;
            tagsRow.remove();
            subtitle.remove();
            setTimeout(() => toast.remove(), 1200);
        });
        tagsRow.appendChild(btn);
    });

    toast.appendChild(tagsRow);
    document.body.appendChild(toast);

    // נעלם לבד אחרי 6 שניות אם המשתמש לא בחר תגית
    setTimeout(() => {
        if (document.body.contains(toast)) toast.remove();
    }, 6000);
}

function applyTag(flagId, tagValue) {
    chrome.storage.local.get({ flags: [] }, (result) => {
        const updated = result.flags.map(f => f.id === flagId ? { ...f, tag: tagValue } : f);
        chrome.storage.local.set({ flags: updated });
    });
}

// מזריק פעם אחת (per page) את ה-CSS הדרוש לאנימציית הפעימה
function injectPulseStyle() {
    if (document.getElementById('chat-flagger-pulse-style')) return;
    const style = document.createElement('style');
    style.id = 'chat-flagger-pulse-style';
    style.textContent = `
        @keyframes chatFlaggerPulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 214, 0, 0.65); }
            70% { box-shadow: 0 0 0 14px rgba(255, 214, 0, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 214, 0, 0); }
        }
        .chat-flagger-pulse {
            animation: chatFlaggerPulse 1s ease-out 3;
        }
        .chat-flagger-mark {
            background-color: #fff000 !important;
            color: #000000 !important;
            border-radius: 4px;
            transition: background-color 0.4s ease, color 0.4s ease;
        }
    `;
    document.head.appendChild(style);
}

// מנרמל רווחים/ירידות שורה כדי שהשוואת טקסט תעבוד גם כשהאתר מרנדר
// את הטקסט עם רווחים שונים מהבחירה המקורית בדפדפן
function normalizeWhitespace(str) {
    return str.replace(/\s+/g, ' ').trim();
}

// מאתר את המיכל הפנימי עם הכי הרבה תוכן נגלל (heuristic ל-lazy loading)
function findScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = getComputedStyle(el);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 100;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    return candidates[0];
}

// עוטף את הטווח שנמצא באלמנט צביעה זמני, ומחזיר אותו לקדמותו אחרי 5 שניות.
// אם עטיפה מדויקת נכשלת (למשל הטווח חוצה גבולות מסובכים), נופלים חזרה
// לצביעת האלמנט האב המשותף - פחות מדויק אבל תמיד עובד.
function highlightRange(range) {
    injectPulseStyle();
    try {
        const mark = document.createElement('span');
        mark.className = 'chat-flagger-mark chat-flagger-pulse';
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            const parent = mark.parentNode;
            if (!parent) return;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
        }, 5000);
    } catch (err) {
        let node = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        if (!node) return;
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node.classList.add('chat-flagger-mark', 'chat-flagger-pulse');
        setTimeout(() => {
            node.classList.remove('chat-flagger-mark', 'chat-flagger-pulse');
        }, 5000);
    }
}

// חיפוש מהיר באמצעות window.find (אותו מנגנון שעומד מאחורי Ctrl+F בדפדפן).
// מהיר בהרבה מסריקת DOM ידנית, וגם מוצא טקסט שפרוס על פני כמה תגיות נפרדות.
function tryFindAndHighlight(text) {
    if (!text || typeof window.find !== 'function') return false;
    window.getSelection().removeAllRanges();
    const found = window.find(text, false, false, true, false, true, false);
    if (!found) return false;
    const sel = window.getSelection();
    if (sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    highlightRange(range.cloneRange());
    window.getSelection().removeAllRanges();
    return true;
}

// ניסיון אחרון (איטי אך יסודי) - סריקת DOM ידנית, למקרים נדירים שבהם
// window.find לא זמין או לא הצליח בכלל.
function manualDomFallback(normalizedFull) {
    const elements = Array.from(document.querySelectorAll("p, div, span, li, td"));
    const containingElements = elements.filter(el =>
        el.textContent && normalizeWhitespace(el.textContent).includes(normalizedFull)
    );
    if (containingElements.length === 0) return false;

    containingElements.sort((a, b) => a.textContent.length - b.textContent.length);
    const targetElement = containingElements[0];

    injectPulseStyle();
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetElement.classList.add('chat-flagger-mark', 'chat-flagger-pulse');
    setTimeout(() => {
        targetElement.classList.remove('chat-flagger-mark', 'chat-flagger-pulse');
    }, 5000);
    return true;
}

// 2. מנגנון מציאה וצביעה חסין לאתרים מודרניים
chrome.storage.local.get(['activeSearchText'], (result) => {
    if (!result.activeSearchText) return;

    const searchText = result.activeSearchText;
    const normalizedFull = normalizeWhitespace(searchText);
    const normalizedPrefix = normalizedFull.length > 80 ? normalizedFull.substring(0, 80) : normalizedFull;

    let attempts = 0;
    const maxAttempts = 60; // 30 שניות - אבל כל ניסיון עכשיו מהיר בהרבה בזכות window.find
    const scrollContainer = findScrollContainer();

    const searchInterval = setInterval(() => {
        attempts++;

        if (attempts > maxAttempts) {
            clearInterval(searchInterval);
            chrome.storage.local.remove('activeSearchText');
            // ניסיון אחרון עם השיטה הידנית, למקרה ש-window.find לא תפס
            manualDomFallback(normalizedFull);
            return;
        }

        // אחרי 10 שניות מתחילים לנסות גם התאמה לפי תחילת הטקסט (80 תווים ראשונים)
        const useFallbackText = attempts > 20;
        const found = tryFindAndHighlight(normalizedFull) ||
            (useFallbackText && tryFindAndHighlight(normalizedPrefix));

        if (found) {
            clearInterval(searchInterval);
            chrome.storage.local.remove('activeSearchText');
            return;
        }

        // עוזר לטעינה עצלה (lazy loading) של הודעות ישנות - גוללים מעט למעלה כל שנייה
        if (attempts % 2 === 0) {
            if (scrollContainer) {
                scrollContainer.scrollTop -= 700;
            } else {
                window.scrollBy(0, -700);
            }
        }
    }, 500);
});
