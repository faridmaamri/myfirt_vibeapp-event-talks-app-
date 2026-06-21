// Global state
let releasesData = [];
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const feedContainer = document.getElementById('feed-container');
const skeletonLoader = document.getElementById('skeleton-loader');
const refreshBtn = document.getElementById('refresh-btn');
const refreshSpinner = document.getElementById('refresh-spinner');
const cacheStatusText = document.getElementById('cache-time-status');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const categoryFilters = document.getElementById('category-filters');
const floatingHighlightBtn = document.getElementById('floating-highlight-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statIssues = document.getElementById('stat-issues');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const modalClose = document.getElementById('modal-close');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalTweetBtn = document.getElementById('modal-tweet-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountSpan = document.getElementById('char-count');
const charProgressBar = document.getElementById('char-progress-bar');
const modalSourceType = document.getElementById('modal-source-type');
const modalSourceDate = document.getElementById('modal-source-date');

// Max length for X/Twitter
const MAX_TWEET_CHARS = 280;
// Circle circumference for SVG progress (r=8 -> 2 * PI * 8 ≈ 50.26)
const CIRCUMFERENCE = 50.26;

/* ==========================================================================
   Data Fetching & Cache Management
   ========================================================================== */

async function fetchReleases(forceRefresh = false) {
    showLoading(true);
    let url = '/api/releases';
    if (forceRefresh) {
        url += '?refresh=true';
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.status === 'success') {
            releasesData = data.releases;
            updateStats();
            renderReleases();
            
            // Format status time
            const now = new Date();
            cacheStatusText.textContent = `Last sync: ${now.toLocaleTimeString()}`;
            
            // Show toast or info if it was forced refresh
            if (forceRefresh) {
                showToast(data.fetched_fresh ? 'Fresh updates fetched!' : 'Feed is up to date.');
            }
        } else {
            showErrorState(data.message || 'Error fetching release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showErrorState('Could not connect to the server. Please check if Flask is running.');
    } finally {
        showLoading(false);
    }
}

function showLoading(isLoading) {
    if (isLoading) {
        skeletonLoader.style.display = 'block';
        // Clear previous list
        const cards = feedContainer.querySelectorAll('.release-card, .empty-state');
        cards.forEach(c => c.remove());
        refreshBtn.classList.add('spinning');
        refreshBtn.disabled = true;
    } else {
        skeletonLoader.style.display = 'none';
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

function showErrorState(message) {
    feedContainer.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">⚠️</span>
            <h3>Failed to load release notes</h3>
            <p>${message}</p>
            <button class="btn btn-secondary" style="margin-top: 15px;" onclick="fetchReleases(true)">Try Again</button>
        </div>
    `;
}

function showToast(msg) {
    // Simple toast display using standard browser DOM
    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.textContent = msg;
    
    // Quick custom styles inline for absolute separation
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'rgba(15, 21, 36, 0.95)',
        border: '1px solid var(--primary)',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '30px',
        fontSize: '0.9rem',
        fontWeight: '600',
        boxShadow: '0 8px 30px rgba(79, 70, 229, 0.3)',
        zIndex: '2000',
        animation: 'scale-up 0.2s ease-out'
    });
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.9)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ==========================================================================
   Statistics Calculations
   ========================================================================== */

function updateStats() {
    if (!releasesData || releasesData.length === 0) {
        statTotal.textContent = '0';
        statFeatures.textContent = '0';
        statIssues.textContent = '0';
        return;
    }
    
    statTotal.textContent = releasesData.length;
    
    const features = releasesData.filter(r => r.type.toLowerCase() === 'feature').length;
    const issues = releasesData.filter(r => r.type.toLowerCase() === 'issue' || r.type.toLowerCase() === 'fixed').length;
    
    statFeatures.textContent = features;
    statIssues.textContent = issues;
}

/* ==========================================================================
   Rendering and Filtering
   ========================================================================== */

function getCleanTextSnippet(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
}

function renderReleases() {
    // Clear any active skeleton or previous releases
    const existingCards = feedContainer.querySelectorAll('.release-card, .empty-state');
    existingCards.forEach(c => c.remove());
    
    const filtered = releasesData.filter(release => {
        // Category Filter
        const matchesCategory = currentFilter === 'all' || 
            (currentFilter.toLowerCase() === 'issue' && (release.type.toLowerCase() === 'issue' || release.type.toLowerCase() === 'fixed')) ||
            release.type.toLowerCase() === currentFilter.toLowerCase();
            
        // Search Filter
        const cleanContent = release.content_text.toLowerCase();
        const matchesSearch = !searchQuery || 
            release.date.toLowerCase().includes(searchQuery) ||
            release.type.toLowerCase().includes(searchQuery) ||
            cleanContent.includes(searchQuery);
            
        return matchesCategory && matchesSearch;
    });
    
    if (filtered.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
            <span class="empty-icon">🔍</span>
            <h3>No release notes match your criteria</h3>
            <p>Try clearing filters or adjusting your search keyword.</p>
        `;
        feedContainer.appendChild(emptyDiv);
        return;
    }
    
    filtered.forEach(release => {
        const card = document.createElement('article');
        card.className = `release-card type-${release.type.toLowerCase()}`;
        card.dataset.id = release.id;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta">
                    <span class="badge">${release.type}</span>
                    <time class="card-date">${release.date}</time>
                </div>
                <div class="card-actions-top">
                    ${release.link ? `
                        <a href="${release.link}" class="card-action-icon-btn" target="_blank" rel="noopener noreferrer" title="View official release log">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-content">
                ${release.content_html}
            </div>
            
            <div class="card-footer">
                <button class="btn btn-secondary btn-card-copy" data-id="${release.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy Text</span>
                </button>
                <button class="btn btn-card-tweet" data-id="${release.id}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Tweet Release
                </button>
            </div>
        `;
        
        // Attach copy event to the button
        card.querySelector('.btn-card-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            copyReleaseToClipboard(release, e.currentTarget);
        });
        
        // Attach tweet event to the button
        card.querySelector('.btn-card-tweet').addEventListener('click', (e) => {
            e.stopPropagation();
            openTweetComposer(release);
        });
        
        feedContainer.appendChild(card);
    });
}

/* ==========================================================================
   Filters and Search Events
   ========================================================================== */

categoryFilters.addEventListener('click', (e) => {
    const button = e.target.closest('.filter-tag');
    if (!button) return;
    
    // Toggle active class
    categoryFilters.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    currentFilter = button.dataset.type;
    renderReleases();
});

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    
    // Toggle clear button
    if (searchQuery.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    
    renderReleases();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderReleases();
});

refreshBtn.addEventListener('click', () => {
    fetchReleases(true);
});

/* ==========================================================================
   Floating Selected Text Sharing
   ========================================================================== */

document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', handleTextSelection);

function handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
        floatingHighlightBtn.style.display = 'none';
        return;
    }
    
    // Check if anchor node belongs to card content
    let anchor = selection.anchorNode;
    if (!anchor) return;
    
    const targetElement = anchor.nodeType === 3 ? anchor.parentElement : anchor;
    const cardContent = targetElement.closest('.card-content');
    
    if (!cardContent) {
        floatingHighlightBtn.style.display = 'none';
        return;
    }
    
    const card = cardContent.closest('.release-card');
    if (!card) return;
    
    const release = releasesData.find(r => r.id === card.dataset.id);
    if (!release) return;
    
    // Get text position to position button above highlight
    try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Show button first to fetch correct dimensions
        floatingHighlightBtn.style.display = 'flex';
        
        const btnWidth = floatingHighlightBtn.offsetWidth || 130;
        const btnHeight = floatingHighlightBtn.offsetHeight || 38;
        
        // Calculate coords relative to document scroll
        const leftCoord = rect.left + window.scrollX + (rect.width / 2) - (btnWidth / 2);
        const topCoord = rect.top + window.scrollY - btnHeight - 10;
        
        floatingHighlightBtn.style.left = `${leftCoord}px`;
        floatingHighlightBtn.style.top = `${topCoord}px`;
        
        // Store metadata details on the floating button dataset
        floatingHighlightBtn.dataset.text = selectedText;
        floatingHighlightBtn.dataset.type = release.type;
        floatingHighlightBtn.dataset.date = release.date;
        floatingHighlightBtn.dataset.link = release.link;
    } catch (e) {
        console.error('Positioning error for floating selection button:', e);
    }
}

floatingHighlightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    
    const dataset = floatingHighlightBtn.dataset;
    
    // Build prefilled tweet structure for the selection
    const rawText = dataset.text;
    const snippet = rawText.length > 120 ? rawText.substring(0, 117) + '...' : rawText;
    const tweetText = `"${snippet}"\n\nBigQuery Update (${dataset.date}) ${dataset.link}`;
    
    openTweetComposer({
        type: dataset.type,
        date: dataset.date,
        link: dataset.link,
        customText: tweetText
    });
    
    // Clear selection
    window.getSelection().removeAllRanges();
    floatingHighlightBtn.style.display = 'none';
});

// Click outside hides floating selection button
document.addEventListener('mousedown', (e) => {
    if (e.target !== floatingHighlightBtn && !floatingHighlightBtn.contains(e.target)) {
        // Delay slightly to prevent race conditions during selections
        setTimeout(() => {
            const selection = window.getSelection();
            if (!selection.toString().trim()) {
                floatingHighlightBtn.style.display = 'none';
            }
        }, 100);
    }
});

/* ==========================================================================
   Tweet Composer Modal Management
   ========================================================================== */

function openTweetComposer(release) {
    modalSourceType.className = `badge type-${release.type.toLowerCase()}`;
    modalSourceType.textContent = release.type;
    modalSourceDate.textContent = release.date;
    
    // Pre-fill logic
    if (release.customText) {
        tweetTextarea.value = release.customText;
    } else {
        // Strip HTML, get plain text snippet
        const plainText = getCleanTextSnippet(release.content_html);
        const rawTitle = `📢 BigQuery ${release.type}: `;
        
        // Target length calculation
        // Total budget = 280.
        // Link + spacing ~ 30 chars. Title + punctuation ~ 25 chars. Hashtags ~ 25 chars.
        // Remaining for text snippet ~ 200 chars.
        const maxSnippetLen = 160;
        let snippet = plainText.trim();
        if (snippet.length > maxSnippetLen) {
            snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
        }
        
        tweetTextarea.value = `${rawTitle}${snippet}\n\n${release.link ? release.link : ''}`;
    }
    
    updateCharacterCount();
    
    // Open modal
    tweetModal.classList.add('active');
    tweetTextarea.focus();
    
    // Position cursor at the beginning of textarea
    tweetTextarea.setSelectionRange(0, 0);
}

function closeTweetComposer() {
    tweetModal.classList.remove('active');
}

function updateCharacterCount() {
    const text = tweetTextarea.value;
    const len = text.length;
    const remaining = MAX_TWEET_CHARS - len;
    
    charCountSpan.textContent = remaining;
    
    // Progress circle stroke-dashoffset calculation
    const progress = Math.min(len / MAX_TWEET_CHARS, 1);
    const offset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);
    charProgressBar.style.strokeDashoffset = offset;
    
    // Toggle warning states
    const container = document.querySelector('.char-counter-container');
    if (remaining <= 0) {
        container.className = 'char-counter-container danger';
        modalTweetBtn.disabled = true;
        modalTweetBtn.style.opacity = '0.5';
        modalTweetBtn.style.cursor = 'not-allowed';
    } else if (remaining <= 20) {
        container.className = 'char-counter-container warning';
        modalTweetBtn.disabled = false;
        modalTweetBtn.style.opacity = '1';
        modalTweetBtn.style.cursor = 'pointer';
    } else {
        container.className = 'char-counter-container';
        modalTweetBtn.disabled = false;
        modalTweetBtn.style.opacity = '1';
        modalTweetBtn.style.cursor = 'pointer';
    }
}

// Append Hashtag helper
document.querySelectorAll('.tag-append-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        let currentText = tweetTextarea.value;
        
        // Avoid duplicate tags
        if (currentText.includes(tag)) {
            showToast(`Tag ${tag} is already in the tweet.`);
            return;
        }
        
        // Check if there is text already
        if (currentText.length > 0 && !currentText.endsWith(' ') && !currentText.endsWith('\n')) {
            currentText += ' ';
        }
        
        tweetTextarea.value = currentText + tag;
        updateCharacterCount();
        tweetTextarea.focus();
    });
});

tweetTextarea.addEventListener('input', updateCharacterCount);

modalClose.addEventListener('click', closeTweetComposer);
modalCancelBtn.addEventListener('click', closeTweetComposer);

// Close on clicking outside modal card
tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
        closeTweetComposer();
    }
});

// Post tweet action
modalTweetBtn.addEventListener('click', () => {
    const text = tweetTextarea.value;
    if (text.length > MAX_TWEET_CHARS) {
        return;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetComposer();
    showToast('Redirected to X / Twitter intent.');
});

/* ==========================================================================
   Utility Helpers (Copy to Clipboard & CSV Export)
   ========================================================================== */

function copyReleaseToClipboard(release, button) {
    const formattedText = `BigQuery Update [${release.type}] - ${release.date}\n\n${release.content_text}\n\nRead more: ${release.link}`;
    
    navigator.clipboard.writeText(formattedText).then(() => {
        const btnText = button.querySelector('span');
        const originalHtml = button.innerHTML;
        
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="color: #10b981;">Copied!</span>
        `;
        button.disabled = true;
        
        setTimeout(() => {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard.');
    });
}

function exportToCSV() {
    if (!releasesData || releasesData.length === 0) {
        showToast('No data to export.');
        return;
    }
    
    const filtered = releasesData.filter(release => {
        const matchesCategory = currentFilter === 'all' || 
            (currentFilter.toLowerCase() === 'issue' && (release.type.toLowerCase() === 'issue' || release.type.toLowerCase() === 'fixed')) ||
            release.type.toLowerCase() === currentFilter.toLowerCase();
            
        const cleanContent = release.content_text.toLowerCase();
        const matchesSearch = !searchQuery || 
            release.date.toLowerCase().includes(searchQuery) ||
            release.type.toLowerCase().includes(searchQuery) ||
            cleanContent.includes(searchQuery);
            
        return matchesCategory && matchesSearch;
    });
    
    if (filtered.length === 0) {
        showToast('No filtered data to export.');
        return;
    }
    
    const escapeCSV = (text) => {
        if (!text) return '';
        let escaped = text.replace(/"/g, '""');
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('"')) {
            escaped = `"${escaped}"`;
        }
        return escaped;
    };
    
    let csvRows = [];
    csvRows.push(['ID', 'Date', 'Type', 'Content Plain Text', 'Source Link'].map(escapeCSV).join(','));
    
    filtered.forEach(r => {
        csvRows.push([
            r.id,
            r.date,
            r.type,
            r.content_text,
            r.link
        ].map(escapeCSV).join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const filterStr = currentFilter !== 'all' ? `_${currentFilter.toLowerCase()}` : '';
        const searchStr = searchQuery ? `_search_${searchQuery.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
        const filename = `bigquery_release_notes${filterStr}${searchStr}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Exported ${filtered.length} items to CSV.`);
    } catch (e) {
        console.error('CSV Export Error: ', e);
        showToast('Failed to export CSV.');
    }
}

// Export button listener
exportCsvBtn.addEventListener('click', exportToCSV);

/* ==========================================================================
   App Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
});
