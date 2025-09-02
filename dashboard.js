// FavManager Dashboard 脚本
console.log('FavManager Dashboard 启动');

// 应用状态
const appState = {
    bookmarks: [],
    folders: [], // 使用文件夹替代分类
    currentFilter: 'all',
    currentSort: 'created-desc',
    searchQuery: '',
    selectedBookmarks: new Set(),
    batchMode: false,
    currentPage: 1,
    itemsPerPage: 20,
    viewMode: 'list' // list 或 cards
};

// DOM 元素
const elements = {
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    viewToggle: document.getElementById('view-toggle'),
    addBookmark: document.getElementById('add-bookmark'),
    menuBtn: document.getElementById('menu-btn'),
    categoryFilter: document.getElementById('category-filter'),
    sortSelect: document.getElementById('sort-select'),
    batchSelect: document.getElementById('batch-select'),
    totalCount: document.getElementById('total-count'),
    bookmarksList: document.getElementById('bookmarks-list'),
    emptyState: document.getElementById('empty-state'),
    noResults: document.getElementById('no-results'),
    clearSearch: document.getElementById('clear-search'),
    batchToolbar: document.getElementById('batch-toolbar'),
    selectedCount: document.getElementById('selected-count'),
    contextMenu: document.getElementById('context-menu'),
    editModal: document.getElementById('edit-modal'),
    messageToast: document.getElementById('message-toast'),
    loading: document.getElementById('loading'),
    categoryList: document.getElementById('category-list'),
    tagCloud: document.getElementById('tag-cloud')
};

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading(true);
        
        // 初始化存储
        await favStorage.init();
        
        // 加载数据
        await loadData();
        
        // 初始化界面
        initUI();
        
        // 绑定事件
        bindEvents();
        
        // 渲染界面
        render();
        
        showLoading(false);
        
        console.log('Dashboard 初始化完成');
    } catch (error) {
        console.error('初始化失败:', error);
        showMessage('初始化失败', 'error');
        showLoading(false);
    }
});

// 加载数据
async function loadData() {
    try {
        appState.bookmarks = await favStorage.getBookmarks();
        appState.folders = await favStorage.getFolders(); // 使用文件夹替代分类
        console.log('数据加载完成:', {
            bookmarks: appState.bookmarks.length,
            folders: appState.folders.length
        });
    } catch (error) {
        console.error('加载数据失败:', error);
        throw error;
    }
}

// 初始化UI
function initUI() {
    // 填充文件夹筛选器
    updateFolderFilter();
    
    // 设置默认排序
    elements.sortSelect.value = appState.currentSort;
    
    // 处理URL hash
    handleURLHash();
}

// 绑定事件监听器
function bindEvents() {
    // 搜索
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.clearSearch.addEventListener('click', clearSearch);
    
    // 视图切换
    elements.viewToggle.addEventListener('click', toggleView);
    
    // 添加收藏
    elements.addBookmark.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
    
    // 菜单
    elements.menuBtn.addEventListener('click', toggleSettingsMenu);
    
    // 筛选和排序
    elements.categoryFilter.addEventListener('change', handleCategoryFilter);
    elements.sortSelect.addEventListener('change', handleSort);
    
    // 批量操作
    elements.batchSelect.addEventListener('click', toggleBatchMode);
    document.getElementById('batch-cancel').addEventListener('click', exitBatchMode);
    document.getElementById('batch-delete').addEventListener('click', batchDelete);
    
    // 分页
    document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page').addEventListener('click', () => changePage(1));
    
    // 弹窗
    document.getElementById('modal-close').addEventListener('click', closeEditModal);
    document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
    document.getElementById('modal-save').addEventListener('click', saveBookmark);
    
    // 右键菜单
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', hideContextMenu);
    
    // 键盘快捷键
    document.addEventListener('keydown', handleKeyboard);
    
    // 侧边栏导航
    document.addEventListener('click', handleNavClick);
    
    // 点击外部关闭菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#settings-menu') && !e.target.closest('#menu-btn')) {
            hideSettingsMenu();
        }
    });
}

// 渲染界面
function render() {
    const filteredBookmarks = getFilteredBookmarks();
    const paginatedBookmarks = getPaginatedBookmarks(filteredBookmarks);
    
    renderBookmarksList(paginatedBookmarks);
    renderSidebar();
    renderStats(filteredBookmarks);
    renderPagination(filteredBookmarks);
    
    // 更新空状态
    if (appState.bookmarks.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.noResults.classList.add('hidden');
    } else if (filteredBookmarks.length === 0) {
        elements.emptyState.classList.add('hidden');
        elements.noResults.classList.remove('hidden');
    } else {
        elements.emptyState.classList.add('hidden');
        elements.noResults.classList.add('hidden');
    }
}

// 渲染收藏夹列表
function renderBookmarksList(bookmarks) {
    const container = elements.bookmarksList;
    
    if (bookmarks.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const html = bookmarks.map(bookmark => createBookmarkHTML(bookmark)).join('');
    container.innerHTML = html;
    
    // 绑定事件
    container.querySelectorAll('.bookmark-item').forEach(item => {
        const bookmarkId = item.dataset.id;
        
        // 点击标题打开链接
        const titleLink = item.querySelector('.bookmark-title a');
        if (titleLink) {
            titleLink.addEventListener('click', (e) => {
                e.preventDefault();
                openBookmark(bookmarkId);
            });
        }
        
        // 编辑按钮
        const editBtn = item.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editBookmark(bookmarkId);
            });
        }
        
        // 删除按钮
        const deleteBtn = item.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBookmark(bookmarkId);
            });
        }
        
        // 复选框（批量模式）
        const checkbox = item.querySelector('.bookmark-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                toggleBookmarkSelection(bookmarkId, e.target.checked);
            });
        }
    });
}

// 创建收藏夹HTML
function createBookmarkHTML(bookmark) {
    const faviconUrl = bookmark.favicon || '';
    const faviconHTML = faviconUrl 
        ? `<img src="${faviconUrl}" alt="" class="bookmark-favicon" onerror="this.classList.add('default'); this.innerHTML='🔖';">`
        : `<div class="bookmark-favicon default">🔖</div>`;
    
    const categoryInfo = appState.categories.find(c => c.id === bookmark.category);
    const categoryName = categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : bookmark.category;
    
    // 截图预览
    const screenshotHTML = bookmark.screenshot 
        ? `<div class="bookmark-screenshot">
            <img src="${bookmark.screenshot}" alt="网页预览" class="screenshot-thumb" />
           </div>`
        : '';
    
    const tagsHTML = bookmark.tags.length > 0 
        ? `<div class="bookmark-tags">
            ${bookmark.tags.map(tag => `<span class="bookmark-tag">${tag}</span>`).join('')}
           </div>`
        : '';
    
    const noteHTML = bookmark.note 
        ? `<div class="bookmark-note">${escapeHtml(bookmark.note)}</div>`
        : '';
    
    const descriptionHTML = bookmark.description 
        ? `<div class="bookmark-description">${escapeHtml(bookmark.description)}</div>`
        : '';
    
    const createdDate = new Date(bookmark.createdAt).toLocaleDateString('zh-CN');
    
    return `
        <div class="bookmark-item" data-id="${bookmark.id}">
            ${appState.batchMode ? `<input type="checkbox" class="bookmark-checkbox">` : ''}
            <div class="bookmark-left">
                ${faviconHTML}
                ${screenshotHTML}
            </div>
            <div class="bookmark-info">
                <div class="bookmark-title">
                    <a href="${bookmark.url}" target="_blank">${escapeHtml(bookmark.title)}</a>
                </div>
                <div class="bookmark-url">${bookmark.url}</div>
                ${descriptionHTML}
                ${noteHTML}
                <div class="bookmark-meta">
                    <span class="bookmark-category">${categoryName}</span>
                    ${tagsHTML}
                    <span class="bookmark-date">${createdDate}</span>
                </div>
            </div>
            <div class="bookmark-actions">
                <button class="action-btn edit-btn">编辑</button>
                <button class="action-btn delete-btn">删除</button>
            </div>
        </div>
    `;
}

// 渲染侧边栏
function renderSidebar() {
    renderCategoryList();
    renderTagCloud();
    updateCounts();
}

// 渲染分类列表
function renderCategoryList() {
    const container = elements.categoryList;
    const categoryCounts = getCategoryCounts();
    
    const html = appState.categories.map(category => {
        const count = categoryCounts[category.id] || 0;
        const isActive = appState.currentFilter === category.id;
        
        return `
            <li>
                <a href="#" class="nav-link ${isActive ? 'active' : ''}" data-filter="${category.id}">
                    ${category.icon} ${category.name} <span>${count}</span>
                </a>
            </li>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 渲染标签云
function renderTagCloud() {
    const container = elements.tagCloud;
    const tagCounts = getTagCounts();
    const tags = Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20); // 只显示前20个标签
    
    if (tags.length === 0) {
        container.innerHTML = '<div class="tag-item">暂无标签</div>';
        return;
    }
    
    const maxCount = Math.max(...tags.map(([, count]) => count));
    
    const html = tags.map(([tag, count]) => {
        const size = Math.max(12, Math.min(16, 12 + (count / maxCount) * 4));
        return `<a href="#" class="tag-item" data-tag="${tag}" style="font-size: ${size}px">${tag}</a>`;
    }).join('');
    
    container.innerHTML = html;
}

// 获取筛选后的收藏夹
function getFilteredBookmarks() {
    let filtered = [...appState.bookmarks];
    
    // 文本搜索
    if (appState.searchQuery) {
        const query = appState.searchQuery.toLowerCase();
        filtered = filtered.filter(bookmark => 
            bookmark.title.toLowerCase().includes(query) ||
            bookmark.url.toLowerCase().includes(query) ||
            (bookmark.description && bookmark.description.toLowerCase().includes(query)) ||
            (bookmark.note && bookmark.note.toLowerCase().includes(query)) ||
            bookmark.tags.some(tag => tag.toLowerCase().includes(query))
        );
    }
    
    // 分类筛选
    if (appState.currentFilter !== 'all') {
        if (appState.currentFilter === 'starred') {
            filtered = filtered.filter(bookmark => bookmark.starred);
        } else if (appState.currentFilter === 'recent') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filtered = filtered.filter(bookmark => new Date(bookmark.createdAt) > oneWeekAgo);
        } else {
            filtered = filtered.filter(bookmark => bookmark.category === appState.currentFilter);
        }
    }
    
    // 排序
    filtered.sort((a, b) => {
        switch (appState.currentSort) {
            case 'created-desc':
                return new Date(b.createdAt) - new Date(a.createdAt);
            case 'created-asc':
                return new Date(a.createdAt) - new Date(b.createdAt);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            case 'url-asc':
                return a.url.localeCompare(b.url);
            default:
                return 0;
        }
    });
    
    return filtered;
}

// 获取分页后的收藏夹
function getPaginatedBookmarks(bookmarks) {
    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    return bookmarks.slice(start, end);
}

// 事件处理函数
function handleSearch() {
    appState.searchQuery = elements.searchInput.value.trim();
    appState.currentPage = 1;
    render();
}

function clearSearch() {
    elements.searchInput.value = '';
    appState.searchQuery = '';
    appState.currentPage = 1;
    render();
}

function handleCategoryFilter() {
    appState.currentFilter = elements.categoryFilter.value || 'all';
    appState.currentPage = 1;
    render();
}

function handleSort() {
    appState.currentSort = elements.sortSelect.value;
    render();
}

function toggleView() {
    appState.viewMode = appState.viewMode === 'list' ? 'cards' : 'list';
    
    // 更新按钮图标
    elements.viewToggle.textContent = appState.viewMode === 'list' ? '📋' : '🎯';
    
    // 切换CSS类
    const container = document.querySelector('.bookmarks-container');
    container.classList.toggle('view-cards', appState.viewMode === 'cards');
    
    render();
}

function toggleBatchMode() {
    appState.batchMode = !appState.batchMode;
    appState.selectedBookmarks.clear();
    
    // 更新UI
    document.body.classList.toggle('batch-mode', appState.batchMode);
    elements.batchSelect.textContent = appState.batchMode ? '退出批量' : '批量选择';
    
    if (appState.batchMode) {
        elements.batchToolbar.classList.remove('hidden');
    } else {
        elements.batchToolbar.classList.add('hidden');
    }
    
    render();
}

function exitBatchMode() {
    appState.batchMode = false;
    appState.selectedBookmarks.clear();
    document.body.classList.remove('batch-mode');
    elements.batchSelect.textContent = '批量选择';
    elements.batchToolbar.classList.add('hidden');
    render();
}

// 打开收藏夹
async function openBookmark(id) {
    const bookmark = appState.bookmarks.find(b => b.id === id);
    if (bookmark) {
        chrome.tabs.create({ url: bookmark.url });
        
        // 更新点击统计
        await favStorage.updateStats('bookmarkClicked');
    }
}

// 编辑收藏夹
function editBookmark(id) {
    const bookmark = appState.bookmarks.find(b => b.id === id);
    if (!bookmark) return;
    
    // 填充表单
    document.getElementById('edit-title').value = bookmark.title;
    document.getElementById('edit-url').value = bookmark.url;
    document.getElementById('edit-description').value = bookmark.description || '';
    document.getElementById('edit-category').value = bookmark.category;
    document.getElementById('edit-tags').value = bookmark.tags.join(', ');
    document.getElementById('edit-note').value = bookmark.note || '';
    
    // 设置当前编辑的ID
    elements.editModal.dataset.bookmarkId = id;
    
    // 显示弹窗
    elements.editModal.classList.remove('hidden');
    document.getElementById('edit-title').focus();
}

// 保存收藏夹
async function saveBookmark() {
    const id = elements.editModal.dataset.bookmarkId;
    const bookmark = appState.bookmarks.find(b => b.id === id);
    if (!bookmark) return;
    
    try {
        showLoading(true);
        
        const updates = {
            title: document.getElementById('edit-title').value.trim(),
            url: document.getElementById('edit-url').value.trim(),
            description: document.getElementById('edit-description').value.trim(),
            category: document.getElementById('edit-category').value,
            tags: document.getElementById('edit-tags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag),
            note: document.getElementById('edit-note').value.trim()
        };
        
        await favStorage.updateBookmark(id, updates);
        await loadData();
        render();
        
        closeEditModal();
        showMessage('保存成功', 'success');
        
    } catch (error) {
        console.error('保存失败:', error);
        showMessage('保存失败', 'error');
    } finally {
        showLoading(false);
    }
}

// 删除收藏夹
async function deleteBookmark(id) {
    const bookmark = appState.bookmarks.find(b => b.id === id);
    if (!bookmark) return;
    
    if (await showConfirm('确认删除', `确定要删除收藏"${bookmark.title}"吗？`)) {
        try {
            await favStorage.deleteBookmark(id);
            await loadData();
            render();
            showMessage('删除成功', 'success');
        } catch (error) {
            console.error('删除失败:', error);
            showMessage('删除失败', 'error');
        }
    }
}

// 辅助函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(show) {
    elements.loading.classList.toggle('hidden', !show);
}

function showMessage(text, type = 'info') {
    const messageEl = elements.messageToast;
    document.getElementById('message-text').textContent = text;
    messageEl.className = `message-toast ${type}`;
    messageEl.classList.remove('hidden');
    
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 3000);
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('confirm-dialog');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const handleConfirm = () => {
            dialog.classList.add('hidden');
            document.getElementById('confirm-ok').removeEventListener('click', handleConfirm);
            document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
            resolve(true);
        };
        
        const handleCancel = () => {
            dialog.classList.add('hidden');
            document.getElementById('confirm-ok').removeEventListener('click', handleConfirm);
            document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
            resolve(false);
        };
        
        document.getElementById('confirm-ok').addEventListener('click', handleConfirm);
        document.getElementById('confirm-cancel').addEventListener('click', handleCancel);
        
        dialog.classList.remove('hidden');
    });
}

function closeEditModal() {
    elements.editModal.classList.add('hidden');
}

function getCategoryCounts() {
    const counts = {};
    appState.bookmarks.forEach(bookmark => {
        counts[bookmark.category] = (counts[bookmark.category] || 0) + 1;
    });
    return counts;
}

function getTagCounts() {
    const counts = {};
    appState.bookmarks.forEach(bookmark => {
        bookmark.tags.forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });
    return counts;
}

function updateCounts() {
    const total = appState.bookmarks.length;
    const starred = appState.bookmarks.filter(b => b.starred).length;
    const recent = appState.bookmarks.filter(b => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return new Date(b.createdAt) > oneWeekAgo;
    }).length;
    
    document.getElementById('all-count').textContent = total;
    document.getElementById('starred-count').textContent = starred;
    document.getElementById('recent-count').textContent = recent;
}

function updateCategoryFilter() {
    const select = elements.categoryFilter;
    select.innerHTML = '<option value="">所有分类</option>';
    
    appState.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = `${category.icon} ${category.name}`;
        select.appendChild(option);
    });
    
    // 同时更新编辑弹窗的分类选择器
    const editSelect = document.getElementById('edit-category');
    if (editSelect) {
        editSelect.innerHTML = '<option value="other">其他</option>';
        appState.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon} ${category.name}`;
            editSelect.appendChild(option);
        });
    }
}

function renderStats(filteredBookmarks) {
    elements.totalCount.textContent = filteredBookmarks.length;
}

function renderPagination(filteredBookmarks) {
    const totalPages = Math.ceil(filteredBookmarks.length / appState.itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.classList.add('hidden');
        return;
    }
    
    pagination.classList.remove('hidden');
    document.getElementById('page-info').textContent = `第 ${appState.currentPage} 页，共 ${totalPages} 页`;
    document.getElementById('prev-page').disabled = appState.currentPage === 1;
    document.getElementById('next-page').disabled = appState.currentPage === totalPages;
}

function changePage(delta) {
    const filteredBookmarks = getFilteredBookmarks();
    const totalPages = Math.ceil(filteredBookmarks.length / appState.itemsPerPage);
    
    appState.currentPage = Math.max(1, Math.min(totalPages, appState.currentPage + delta));
    render();
}

// 其他事件处理
function handleContextMenu(e) {
    const bookmarkItem = e.target.closest('.bookmark-item');
    if (bookmarkItem) {
        e.preventDefault();
        showContextMenu(e.pageX, e.pageY, bookmarkItem.dataset.id);
    }
}

function showContextMenu(x, y, bookmarkId) {
    const menu = elements.contextMenu;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
    menu.dataset.bookmarkId = bookmarkId;
}

function hideContextMenu() {
    elements.contextMenu.classList.add('hidden');
}

function handleNavClick(e) {
    if (e.target.classList.contains('nav-link')) {
        e.preventDefault();
        
        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // 更新筛选状态
        appState.currentFilter = e.target.dataset.filter;
        appState.currentPage = 1;
        render();
    }
    
    if (e.target.classList.contains('tag-item')) {
        e.preventDefault();
        const tag = e.target.dataset.tag;
        elements.searchInput.value = tag;
        handleSearch();
    }
}

function handleKeyboard(e) {
    // Ctrl/Cmd + F: 聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        elements.searchInput.focus();
    }
    
    // Escape: 关闭弹窗和菜单
    if (e.key === 'Escape') {
        closeEditModal();
        hideContextMenu();
        hideSettingsMenu();
    }
}

function toggleSettingsMenu() {
    const menu = document.getElementById('settings-menu');
    const rect = elements.menuBtn.getBoundingClientRect();
    
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    menu.classList.toggle('hidden');
}

function hideSettingsMenu() {
    document.getElementById('settings-menu').classList.add('hidden');
}

function handleURLHash() {
    const hash = window.location.hash.substring(1);
    if (hash === 'search') {
        elements.searchInput.focus();
    }
}

function toggleBookmarkSelection(id, selected) {
    if (selected) {
        appState.selectedBookmarks.add(id);
    } else {
        appState.selectedBookmarks.delete(id);
    }
    
    elements.selectedCount.textContent = appState.selectedBookmarks.size;
}

async function batchDelete() {
    if (appState.selectedBookmarks.size === 0) return;
    
    const count = appState.selectedBookmarks.size;
    if (await showConfirm('批量删除', `确定要删除选中的 ${count} 个收藏吗？`)) {
        try {
            await favStorage.deleteBookmarks([...appState.selectedBookmarks]);
            await loadData();
            exitBatchMode();
            render();
            showMessage(`成功删除 ${count} 个收藏`, 'success');
        } catch (error) {
            console.error('批量删除失败:', error);
            showMessage('批量删除失败', 'error');
        }
    }
}

console.log('Dashboard 脚本加载完成');