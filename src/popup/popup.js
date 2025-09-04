// FavManager Popup 脚本
console.log('FavManager Popup 启动');

// DOM 元素
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const descriptionInput = document.getElementById('description');
const categorySelect = document.getElementById('category');
const tagsInput = document.getElementById('tags');
const noteInput = document.getElementById('note');
const deleteBtn = document.getElementById('delete-btn');
const saveBtn = document.getElementById('save-btn');
const closeBtn = document.getElementById('close-btn');
const starBtn = document.getElementById('star-btn');
const openDashboardLink = document.getElementById('open-dashboard');
const searchBookmarksLink = document.getElementById('search-bookmarks');
const messageEl = document.getElementById('message');
const loadingEl = document.getElementById('loading');

// 标签输入组件
let tagInputComponent;

// 预览相关元素（稍后在DOMContentLoaded中获取）
let previewTooltip, previewTitle, previewUrl, previewScreenshot, previewDescription;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initPopup();
});

// 当前书签ID（如果是更新现有书签）
let currentBookmarkId = null;
let isUpdateMode = false;

// 预览相关变量
let currentScreenshot = '';
let previewTimeout = null;
let isStarred = false;

// 切换到更新模式
function switchToUpdateMode(bookmarkId) {
    isUpdateMode = true;
    currentBookmarkId = bookmarkId;
    
    // 更新页面标题和按钮文字
    document.querySelector('.header h1').innerHTML = '🔄';
    saveBtn.textContent = i18n.t('common_update');
    
    // 显示删除按钮并调整按钮布局
    deleteBtn.classList.remove('hidden');
    document.querySelector('.actions').classList.add('update-mode');
    
    // 在头部显示更新模式指示
    const headerTitle = document.querySelector('.header h1');
    headerTitle.innerHTML = i18n.t('popup_title_updating');
}

// 清空所有表单字段
function clearAllFields() {
    titleInput.value = '';
    urlInput.value = '';
    descriptionInput.value = '';
    noteInput.value = '';
    categorySelect.value = '1'; // 默认选择书签栏
    
    // 强制清空备注字段，防止浏览器自动填充
    setTimeout(() => {
        if (noteInput.value !== '') {
            console.log('检测到备注字段被自动填充，强制清除');
            noteInput.value = '';
        }
    }, 100);
    
    // 清空标签输入框
    tagsInput.value = '';
    
    // 预览功能已移除
    
    // 隐藏预览窗口（如果元素已经获取到）
    if (previewTooltip) {
        hidePreview();
    }
    
    // 重置状态
    isUpdateMode = false;
    currentBookmarkId = null;
    window.existingBookmark = null;
    isStarred = false;
    updateStarButton();
    
    // 隐藏删除按钮，重置按钮文字和布局
    deleteBtn.classList.add('hidden');
    saveBtn.textContent = i18n.t('common_save');
    document.querySelector('.header h1').innerHTML = i18n.t('popup_title_adding');
    document.querySelector('.actions').classList.remove('update-mode');
    
    // 清除可能的草稿数据
    try {
        localStorage.removeItem('favmanager_draft');
    } catch (error) {
        console.log('清除草稿数据失败:', error);
    }
}

// 初始化弹窗
async function initPopup() {
    try {
        // 获取预览相关DOM元素
        previewTooltip = document.getElementById('preview-tooltip');
        previewTitle = document.getElementById('preview-title');
        previewUrl = document.getElementById('preview-url');
        previewScreenshot = document.getElementById('preview-screenshot');
        previewDescription = document.getElementById('preview-description');
        
        // 清空所有表单字段，确保没有残留数据
        clearAllFields();
        
        // 防止浏览器自动填充
        preventAutofill();
        
        // 加载文件夹数据
        await loadFolders();
        
        // 获取当前标签页信息
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab) {
            console.log('当前标签页信息:', tab);
            
            // 检查页面是否已被收藏
            await favStorage.init();
            console.log('FavStorage 初始化完成');
            
            window.existingBookmark = await favStorage.findBookmarkByUrl(tab.url);
            const existingBookmark = window.existingBookmark;
            
            console.log('查找已收藏页面结果:', existingBookmark);
            
            if (existingBookmark) {
                // 更新模式：填充已有数据
                console.log('找到已有收藏:', existingBookmark);
                
                // 填充表单数据
                titleInput.value = existingBookmark.title || '';
                urlInput.value = existingBookmark.url || '';
                descriptionInput.value = existingBookmark.description || '';
                noteInput.value = existingBookmark.note || '';
                
                // 设置文件夹
                if (existingBookmark.parentId) {
                    categorySelect.value = existingBookmark.parentId;
                }
                
                // 切换到更新模式
                switchToUpdateMode(existingBookmark.id);
                
                // 设置星标状态
                isStarred = existingBookmark.starred || false;
                updateStarButton();
                
                // 显示截图（如果有）
                if (existingBookmark.screenshot) {
                    updateScreenshot(existingBookmark.screenshot);
                }
                
            } else {
                // 新增模式：设置基本信息
                titleInput.value = tab.title || '';
                urlInput.value = tab.url || '';
                
                // 预览功能已移除，信息直接显示在输入框中
            }
            
            // 获取并显示截图
            try {
                const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { 
                    format: 'png', 
                    quality: 80 
                });
                updateScreenshot(screenshot);
            } catch (error) {
                console.log('获取截图失败:', error);
            }
            
            // 尝试获取更详细的页面信息
            try {
                // 先检查是否是特殊页面（chrome://、about:、file:// 等）
                if (tab.url.startsWith('chrome://') || 
                    tab.url.startsWith('chrome-extension://') ||
                    tab.url.startsWith('about:') ||
                    tab.url.startsWith('moz-extension://') ||
                    tab.url.startsWith('file://')) {
                    
                    console.log('特殊页面，跳过内容脚本注入');
                    // 系统页面无需特殊处理，信息已在输入框中
                } else {
                    // 先注入内容脚本，然后发送消息
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    // 等待一小段时间让脚本加载
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
                    if (response && response.success) {
                        // 更新描述
                        if (response.description) {
                            descriptionInput.value = response.description;
                        }
                        // 描述直接显示在输入框中，无需预览
                        
                        // 不再自动设置标签，让用户手动输入
                        
                        // 根据内容类型智能推荐文件夹
                        const suggestedFolder = suggestFolder(tab.url, response);
                        if (suggestedFolder) {
                            categorySelect.value = suggestedFolder;
                        }
                    } else {
                        throw new Error('无响应或响应失败');
                    }
                }
            } catch (error) {
                console.log('无法获取详细页面信息:', error);
                // 尝试基本的页面信息提取
                try {
                    const basicInfo = await extractBasicPageInfo(tab);
                    if (basicInfo.description) {
                        descriptionInput.value = basicInfo.description;
                    }
                    // 信息直接显示在输入框中
                } catch (fallbackError) {
                    console.log('备用方案也失败:', fallbackError);
                    // 页面信息已在输入框中显示
                }
            }
        }
        
        // 初始化标签输入组件
        tagInputComponent = new TagInput(tagsInput, {
            maxTags: 8,
            placeholder: '添加标签，用空格或逗号分隔...'
        });
        
        // 如果是更新模式，设置已有标签
        if (isUpdateMode && window.existingBookmark && window.existingBookmark.tags) {
            tagInputComponent.setTags(window.existingBookmark.tags);
        }
        
        // 设置焦点到标题输入框而不是备注输入框
        titleInput.focus();
        
        // 添加备注字段的实时监控
        monitorNoteField();
        
        // 设置预览事件监听器
        setupPreviewListeners();
        
    } catch (error) {
        console.error('初始化失败:', error);
        showMessage('初始化失败', 'error');
    }
}

// 防止浏览器自动填充
function preventAutofill() {
    // 延迟检查和清空可能的自动填充内容
    const checkAndClear = () => {
        // 如果不是更新模式，且备注字段有内容，则清除
        if (!isUpdateMode && noteInput.value !== '') {
            console.log('防止自动填充：清除备注字段内容');
            noteInput.value = '';
        }
        // 同样检查其他字段
        if (!isUpdateMode && descriptionInput.value !== '' && !descriptionInput.value.startsWith('http')) {
            // 如果描述不是正常的网页描述，可能是自动填充
            const suspiciousContent = descriptionInput.value.toLowerCase();
            if (suspiciousContent.includes('visa') || suspiciousContent.includes('application') || suspiciousContent.length > 200) {
                console.log('防止自动填充：清除可疑的描述内容');
                descriptionInput.value = '';
            }
        }
    };
    
    // 多次检查，防止延迟的自动填充
    setTimeout(checkAndClear, 50);
    setTimeout(checkAndClear, 200);
    setTimeout(checkAndClear, 500);
    setTimeout(checkAndClear, 1000);
}

// 监控备注字段，防止意外的自动填充
function monitorNoteField() {
    let lastNoteValue = '';
    
    const monitor = () => {
        if (!isUpdateMode && noteInput.value !== lastNoteValue) {
            const currentValue = noteInput.value;
            
            // 检查是否包含可疑的自动填充内容
            if (currentValue.length > 50 && (
                currentValue.toLowerCase().includes('visa') ||
                currentValue.toLowerCase().includes('application') ||
                currentValue.toLowerCase().includes('november 2004') ||
                currentValue.toLowerCase().includes('december 2004')
            )) {
                console.log('检测到可疑的自动填充内容，已清除:', currentValue);
                noteInput.value = '';
                showMessage('检测到异常内容已清除', 'info');
            }
            
            lastNoteValue = noteInput.value;
        }
    };
    
    // 使用多种方式监控字段变化
    noteInput.addEventListener('input', monitor);
    noteInput.addEventListener('change', monitor);
    noteInput.addEventListener('paste', () => setTimeout(monitor, 10));
    
    // 定期检查
    const intervalId = setInterval(monitor, 1000);
    
    // 页面关闭前清理定时器
    window.addEventListener('beforeunload', () => {
        clearInterval(intervalId);
    });
}

// 预览功能
function showPreview() {
    if (!previewTooltip) {
        return;
    }
    
    const title = titleInput.value.trim() || '未设置标题';
    const url = urlInput.value.trim() || '未设置网址';  
    const description = descriptionInput.value.trim() || '暂无描述';
    
    // 更新预览内容
    if (previewTitle) previewTitle.textContent = title;
    if (previewUrl) previewUrl.textContent = url;
    if (previewDescription) previewDescription.textContent = description;
    
    // 更新截图
    if (previewScreenshot) {
        if (currentScreenshot) {
            previewScreenshot.innerHTML = `<img src="${currentScreenshot}" alt="页面截图">`;
        } else {
            previewScreenshot.innerHTML = '<div class="screenshot-placeholder">📸</div>';
        }
    }
    
    // 固定将预览窗口添加到网址输入框的父容器中
    const urlRow = urlInput.closest('.form-row');
    if (urlRow && !urlRow.contains(previewTooltip)) {
        urlRow.appendChild(previewTooltip);
    }
    
    // 显示预览窗口
    previewTooltip.style.display = 'block';
    previewTooltip.classList.remove('hidden');
}

function hidePreview() {
    if (previewTooltip) {
        previewTooltip.style.display = 'none';
        previewTooltip.classList.add('hidden');
    }
}

// 存储截图数据
function updateScreenshot(screenshotDataUrl) {
    if (screenshotDataUrl) {
        currentScreenshot = screenshotDataUrl;
    }
}

// 加载文件夹数据
async function loadFolders() {
    try {
        console.log('开始加载文件夹...');
        
        // 等待存储初始化
        if (!favStorage.chromeBookmarks) {
            await favStorage.init();
        }
        
        const folders = await favStorage.getFolders();
        console.log('加载的所有文件夹:', folders);
        
        // 清空现有选项
        categorySelect.innerHTML = '';
        
        // 按层级排序文件夹
        const sortedFolders = folders.sort((a, b) => {
            // 先按层级排序，再按标题排序
            if (a.level !== b.level) {
                return a.level - b.level;
            }
            return a.title.localeCompare(b.title);
        });
        
        console.log('排序后的文件夹:', sortedFolders);
        
        // 添加所有文件夹选项
        sortedFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            
            // 创建层级缩进
            const indent = '  '.repeat(Math.max(0, folder.level - 1));
            const icon = folder.isDefault ? '📚' : '📁';
            
            option.textContent = `${indent}${icon} ${folder.title}`;
            
            // 如果文件夹为空，添加提示
            if (folder.isEmpty) {
                option.textContent += ' (空)';
            }
            
            categorySelect.appendChild(option);
            
            console.log(`添加文件夹选项: ${option.textContent} (ID: ${folder.id})`);
        });
        
        // 如果没有找到文件夹，添加默认选项
        if (sortedFolders.length === 0) {
            console.warn('未找到任何文件夹，添加默认选项');
            const defaultOptions = [
                { value: '1', text: '📚 书签栏' },
                { value: '2', text: '📚 其他书签' }
            ];
            
            defaultOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                categorySelect.appendChild(option);
            });
        }
        
        console.log('文件夹加载完成，总计:', categorySelect.options.length, '个选项');
        
    } catch (error) {
        console.error('加载文件夹失败:', error);
        // 失败时设置默认选项
        categorySelect.innerHTML = `
            <option value="1">📚 书签栏</option>
            <option value="2">📚 其他书签</option>
        `;
    }
}

// 智能推荐文件夹
function suggestFolder(url, pageInfo) {
    try {
        // 暂时返回默认的书签栏，后续可以根据网站类型推荐不同文件夹
        return '1'; // 书签栏ID
    } catch (error) {
        return '1';
    }
}

// 绑定事件监听器
deleteBtn.addEventListener('click', () => {
    deleteBookmark();
});

saveBtn.addEventListener('click', () => {
    saveBookmark();
});

closeBtn.addEventListener('click', () => {
    window.close();
});

starBtn.addEventListener('click', () => {
    toggleStar();
});

// 星标切换功能
async function toggleStar() {
    // 如果不是更新模式，只切换状态，不立即保存
    if (!isUpdateMode || !currentBookmarkId) {
        isStarred = !isStarred;
        updateStarButton();
        // 在新增模式时给用户提示
        showMessage(isStarred ? i18n.t('msg_star_set') : i18n.t('msg_star_unset'), 'info');
        return;
    }
    
    // 更新模式：立即保存星标状态
    try {
        showLoading(true, 'star');
        
        const newStarred = !isStarred;
        await favStorage.init();
        
        const success = await favStorage.updateBookmark(currentBookmarkId, { 
            starred: newStarred 
        });
        
        if (success) {
            isStarred = newStarred;
            updateStarButton();
            showMessage(newStarred ? i18n.t('msg_star_added') : i18n.t('msg_star_removed'), 'success');
        } else {
            throw new Error('更新失败');
        }
        
    } catch (error) {
        console.error('更新星标失败:', error);
        showMessage('星标操作失败：' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function updateStarButton() {
    if (isStarred) {
        starBtn.classList.add('starred');
        starBtn.title = i18n.t('tooltip_remove_star');
    } else {
        starBtn.classList.remove('starred');
        starBtn.title = i18n.t('tooltip_add_star');
    }
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        saveBookmark();
    } else if (e.key === 'Escape') {
        hidePreview();
        window.close();
    }
});

// 添加预览触发区域的鼠标事件
function setupPreviewListeners() {
    const previewTriggers = [titleInput, urlInput, descriptionInput];
    
    previewTriggers.forEach(element => {
        if (!element) {
            return;
        }
        
        element.addEventListener('mouseenter', () => {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(showPreview, 300); // 减少延迟到300ms
        });
        
        element.addEventListener('mouseleave', () => {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(hidePreview, 200); // 延迟200ms隐藏
        });
        
        // 输入时实时更新预览内容（如果预览正在显示）
        element.addEventListener('input', () => {
            if (!previewTooltip.classList.contains('hidden')) {
                showPreview();
            }
        });
    });
    
    // 鼠标进入预览窗口时保持显示
    previewTooltip.addEventListener('mouseenter', () => {
        clearTimeout(previewTimeout);
    });
    
    // 鼠标离开预览窗口时隐藏
    previewTooltip.addEventListener('mouseleave', () => {
        hidePreview();
    });
}

openDashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'src/pages/dashboard/dashboard.html' });
    window.close();
});

searchBookmarksLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'src/pages/dashboard/dashboard.html#search' });
    window.close();
});

// 删除收藏
async function deleteBookmark() {
    if (!isUpdateMode || !currentBookmarkId) {
        showMessage(i18n.t('msg_no_bookmark_to_delete'), 'error');
        return;
    }
    
    // 显示加载状态
    showLoading(true, 'delete');
    
    try {
        await favStorage.init();
        const success = await favStorage.deleteBookmark(currentBookmarkId);
        
        if (success) {
            showMessage(i18n.t('msg_delete_success'), 'success');
            
            // 删除成功后隐藏删除按钮
            deleteBtn.classList.add('hidden');
            document.querySelector('.actions').classList.remove('update-mode');
            
            // 重置状态为新增模式
            isUpdateMode = false;
            currentBookmarkId = null;
            window.existingBookmark = null;
            
            // 更新按钮文字和图标
            saveBtn.textContent = i18n.t('common_save');
            document.querySelector('.header h1').innerHTML = i18n.t('popup_title_adding');
        } else {
            throw new Error('删除失败');
        }
        
    } catch (error) {
        console.error('删除收藏失败:', error);
        showMessage('删除失败：' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 保存收藏
async function saveBookmark() {
    // 验证必填字段
    if (!titleInput.value.trim()) {
        showMessage(i18n.t('msg_title_required'), 'error');
        titleInput.focus();
        return;
    }
    
    if (!urlInput.value.trim()) {
        showMessage(i18n.t('msg_url_required'), 'error');
        urlInput.focus();
        return;
    }
    
    // 验证URL格式
    if (!isValidUrl(urlInput.value.trim())) {
        showMessage(i18n.t('msg_url_invalid'), 'error');
        urlInput.focus();
        return;
    }
    
    // 显示加载状态
    showLoading(true);
    
    try {
        // 获取网页截图（新增模式或用户要求更新截图时）
        let screenshot = '';
        if (!isUpdateMode) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 80 });
            } catch (error) {
                console.log('截图失败:', error);
            }
        }

        // 构建收藏数据
        const bookmarkData = {
            title: titleInput.value.trim(),
            url: urlInput.value.trim(),
            description: descriptionInput.value.trim(),
            folderId: categorySelect.value || '1',
            tags: tagInputComponent ? tagInputComponent.getTags() : [],
            note: noteInput.value.trim(),
            starred: isStarred
        };
        
        // 添加截图（新增模式时）
        if (!isUpdateMode && screenshot) {
            bookmarkData.screenshot = screenshot;
            bookmarkData.createdAt = new Date().toISOString();
        }
        
        await favStorage.init();
        
        let response;
        if (isUpdateMode && currentBookmarkId) {
            // 更新现有书签（排除starred字段，因为星标是即时保存的）
            const { starred, ...updateData } = bookmarkData;
            console.log('更新现有书签:', currentBookmarkId, updateData);
            response = await favStorage.updateBookmark(currentBookmarkId, updateData);
            
            if (response) {
                showMessage(i18n.t('msg_update_success'), 'success');
            } else {
                throw new Error('更新失败');
            }
        } else {
            // 新增书签
            console.log('新增书签:', bookmarkData);
            response = await favStorage.addBookmark(bookmarkData);
            
            if (response) {
                showMessage(i18n.t('msg_save_success'), 'success');
                // 保存成功后切换到更新模式
                switchToUpdateMode(response.id);
            } else {
                throw new Error('保存失败');
            }
        }
        
        // 不自动关闭窗口，让用户手动关闭
        
    } catch (error) {
        console.error('保存收藏失败:', error);
        showMessage((isUpdateMode ? '更新' : '保存') + '失败：' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// parseTagsInput 函数已被 TagInput 组件替代

// 验证URL格式
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// 显示消息
function showMessage(text, type = 'info') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    
    // 根据消息类型设置不同的显示时间
    const displayTime = type === 'success' ? 2000 : 3000;
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, displayTime);
}

// 显示/隐藏加载状态
function showLoading(show, operation = null) {
    if (show) {
        loadingEl.classList.remove('hidden');
        saveBtn.disabled = true;
        deleteBtn.disabled = true;
        closeBtn.disabled = true;
        starBtn.disabled = true;
        
        // 根据操作类型显示不同的加载文本
        const loadingText = loadingEl.querySelector('span');
        if (loadingText) {
            if (operation === 'delete') {
                loadingText.textContent = '删除中...';
            } else if (operation === 'star') {
                loadingText.textContent = '更新星标...';
            } else {
                loadingText.textContent = isUpdateMode ? '更新中...' : '保存中...';
            }
        }
    } else {
        loadingEl.classList.add('hidden');
        saveBtn.disabled = false;
        deleteBtn.disabled = false;
        closeBtn.disabled = false;
        starBtn.disabled = false;
    }
}

// 自动保存草稿（可选功能）
let draftSaveTimeout;
function saveDraft() {
    clearTimeout(draftSaveTimeout);
    draftSaveTimeout = setTimeout(() => {
        const draft = {
            title: titleInput.value,
            description: descriptionInput.value,
            category: categorySelect.value,
            tags: tagInputComponent ? tagInputComponent.getTags() : [],
            note: noteInput.value,
            savedAt: Date.now()
        };
        localStorage.setItem('favmanager_draft', JSON.stringify(draft));
    }, 1000);
}

// 恢复草稿
function restoreDraft() {
    try {
        const draftStr = localStorage.getItem('favmanager_draft');
        if (draftStr) {
            const draft = JSON.parse(draftStr);
            // 如果草稿是最近1小时内的，则恢复
            if (Date.now() - draft.savedAt < 60 * 60 * 1000) {
                if (!titleInput.value && draft.title) titleInput.value = draft.title;
                if (!descriptionInput.value && draft.description) {
                    // 检查是否为可疑的内容
                    const suspiciousContent = draft.description.toLowerCase();
                    if (!suspiciousContent.includes('visa') && !suspiciousContent.includes('application')) {
                        descriptionInput.value = draft.description;
                    }
                }
                if (draft.category !== '其他') categorySelect.value = draft.category;
                if (tagInputComponent && draft.tags && Array.isArray(draft.tags)) {
                    tagInputComponent.setTags(draft.tags);
                }
                if (!noteInput.value && draft.note) {
                    // 检查备注内容是否可疑
                    const suspiciousNote = draft.note.toLowerCase();
                    if (!suspiciousNote.includes('visa') && !suspiciousNote.includes('application')) {
                        noteInput.value = draft.note;
                    }
                }
            }
            // 清除草稿
            localStorage.removeItem('favmanager_draft');
        }
    } catch (error) {
        console.log('恢复草稿失败:', error);
    }
}

// 为输入框绑定草稿保存事件和实时预览更新
[titleInput, descriptionInput, categorySelect, noteInput].forEach(el => {
    el.addEventListener('input', saveDraft);
    el.addEventListener('change', saveDraft);
});

// 标签组件的草稿保存需要单独处理
if (tagInputComponent) {
    tagsInput.addEventListener('change', saveDraft);
}

// 实时预览功能已移除，信息直接在输入框中编辑

// 智能标签建议（基于URL）
function suggestTags(url) {
    const suggestions = [];
    
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();
        
        // 基于域名的标签建议
        if (domain.includes('github')) suggestions.push('开发', '代码', '开源');
        else if (domain.includes('stackoverflow')) suggestions.push('编程', '问答', '开发');
        else if (domain.includes('youtube')) suggestions.push('视频', '学习', '娱乐');
        else if (domain.includes('bilibili')) suggestions.push('视频', '学习', '娱乐');
        else if (domain.includes('zhihu')) suggestions.push('问答', '知识', '学习');
        else if (domain.includes('juejin')) suggestions.push('技术', '前端', '开发');
        else if (domain.includes('csdn')) suggestions.push('技术', '博客', '开发');
        else if (domain.includes('medium')) suggestions.push('文章', '技术', '设计');
        else if (domain.includes('figma')) suggestions.push('设计', '工具', 'UI');
        else if (domain.includes('dribbble')) suggestions.push('设计', '灵感', 'UI');
        else if (domain.includes('behance')) suggestions.push('设计', '作品集', '创意');
        
        return suggestions.slice(0, 3); // 最多3个建议
    } catch (error) {
        return [];
    }
}

// 移除自动标签建议功能

// 页面加载时恢复草稿
window.addEventListener('load', () => {
    setTimeout(restoreDraft, 100);
});

// 备用的页面信息提取函数
async function extractBasicPageInfo(tab) {
    try {
        // 使用 fetch API 获取页面内容（仅适用于同源页面）
        const response = await fetch(tab.url);
        if (response.ok) {
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // 尝试提取描述
            let description = '';
            const metaDesc = doc.querySelector('meta[name="description"]');
            const ogDesc = doc.querySelector('meta[property="og:description"]');
            const twitterDesc = doc.querySelector('meta[name="twitter:description"]');
            
            if (metaDesc) {
                description = metaDesc.getAttribute('content');
            } else if (ogDesc) {
                description = ogDesc.getAttribute('content');
            } else if (twitterDesc) {
                description = twitterDesc.getAttribute('content');
            } else {
                // 尝试从第一个段落获取
                const firstP = doc.querySelector('p');
                if (firstP && firstP.textContent) {
                    description = firstP.textContent.slice(0, 200);
                }
            }
            
            return { description: description.trim() };
        }
    } catch (error) {
        console.log('备用提取方法失败:', error);
        return { description: '' };
    }
    return { description: '' };
}

console.log('FavManager Popup 脚本加载完成');