let allFlags = [];
let searchTerm = '';
let tagFilter = 'all';

const TAG_COLORS = {
    'חשוב': '#e8710a',
    'לבדוק': '#1a73e8',
    'רעיון': '#a142f4'
};

function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAndRender();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTerm = e.target.value.trim().toLowerCase();
        renderFlags();
    });

    document.querySelectorAll('.tag-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tagFilter = btn.dataset.tag;
            document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderFlags();
        });
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('האם אתה בטוח שברצונך למחוק את כל הדגלים? הפעולה בלתי הפיכה.')) {
            chrome.storage.local.set({ flags: [] }, loadAndRender);
        }
    });
});

function loadAndRender() {
    chrome.storage.local.get({ flags: [] }, (result) => {
        // מיגרציה: דגלים ישנים (מגרסה קודמת) שנוצרו בלי id/tag מקבלים אותם עכשיו
        let needsMigration = false;
        const migrated = result.flags.map(f => {
            if (!f.id) {
                needsMigration = true;
                return { ...f, id: generateId(), tag: f.tag || null };
            }
            return f;
        });

        allFlags = migrated;
        if (needsMigration) {
            chrome.storage.local.set({ flags: migrated });
        }
        renderFlags();
    });
}

function renderFlags() {
    const container = document.getElementById('flagsList');
    const clearBtn = document.getElementById('clearAllBtn');
    container.innerHTML = '';

    if (allFlags.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.innerHTML = "אין דגלים עדיין.<br>סמן טקסט בעמוד ולחץ על Shift + F כדי לשמור.";
        container.appendChild(emptyMsg);
        clearBtn.style.display = 'none';
        return;
    }
    clearBtn.style.display = 'inline-block';

    const filtered = allFlags.filter(f => {
        const matchesSearch = !searchTerm ||
            f.fullText.toLowerCase().includes(searchTerm) ||
            f.text.toLowerCase().includes(searchTerm);
        const matchesTag = tagFilter === 'all' ||
            (tagFilter === 'none' ? !f.tag : f.tag === tagFilter);
        return matchesSearch && matchesTag;
    });

    if (filtered.length === 0) {
        const noResults = document.createElement('p');
        noResults.style.cssText = "color:gray; font-size:13px; text-align:center;";
        noResults.textContent = 'לא נמצאו דגלים תואמים לחיפוש/לסינון.';
        container.appendChild(noResults);
        return;
    }

    filtered.slice().reverse().forEach((flag) => {
        const item = document.createElement('div');
        item.className = 'flag-item';

        const textDiv = document.createElement('div');
        textDiv.className = 'flag-text';
        const strong = document.createElement('strong');
        strong.textContent = flag.text;
        textDiv.appendChild(strong);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta-row';

        const dateSpan = document.createElement('span');
        dateSpan.className = 'date';
        dateSpan.textContent = flag.timestamp;
        metaDiv.appendChild(dateSpan);

        if (flag.tag) {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag-chip';
            tagSpan.textContent = flag.tag;
            tagSpan.style.backgroundColor = TAG_COLORS[flag.tag] || '#777';
            metaDiv.appendChild(tagSpan);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        const goBtn = document.createElement('button');
        goBtn.className = 'link-btn';
        goBtn.textContent = 'תחזור לשיחה';
        goBtn.addEventListener('click', () => {
            chrome.storage.local.set({ activeSearchText: flag.fullText }, () => {
                window.open(flag.url, '_blank');
            });
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.title = 'מחק דגל זה';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => {
            deleteFlag(flag.id);
        });

        actionsDiv.appendChild(goBtn);
        actionsDiv.appendChild(delBtn);

        item.appendChild(textDiv);
        item.appendChild(metaDiv);
        item.appendChild(actionsDiv);
        container.appendChild(item);
    });
}

function deleteFlag(id) {
    const updated = allFlags.filter(f => f.id !== id);
    chrome.storage.local.set({ flags: updated }, loadAndRender);
}
