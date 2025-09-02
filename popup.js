// FavManager Popup 脚本
console.log('FavManager Popup 启动');

// DOM 元素
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const descriptionInput = document.getElementById('description');
const categorySelect = document.getElementById('category');
const tagsInput = document.getElementById('tags');
const noteInput = document.getElementById('note');
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const openDashboardLink = document.getElementById('open-dashboard');
const searchBookmarksLink = document.getElementById('search-bookmarks');
const messageEl = document.getElementById('message');
const loadingEl = document.getElementById('loading');

// 预览区域元素
const titlePreview = document.getElementById('title-preview');
const urlPreview = document.getElementById('url-preview');
const descriptionPreview = document.getElementById('description-preview');
const screenshotContainer = document.getElementById('page-screenshot');

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initPopup();
});

// 初始化弹窗
async function initPopup() {
    try {
        // 加载文件夹数据
        await loadFolders();
        
        // 获取当前标签页信息
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab) {
            // 设置基本信息
            titleInput.value = tab.title || '';
            urlInput.value = tab.url || '';
            
            // 更新预览区域
            updatePreview({
                title: tab.title,
                url: tab.url,
                description: '正在获取页面描述...'
            });
            
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
                    updatePreview({
                        title: tab.title,
                        url: tab.url,
                        description: '系统页面，无法获取描述'
                    });
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
                            updatePreview({
                                title: tab.title,
                                url: tab.url,
                                description: response.description
                            });
                        } else {
                            updatePreview({
                                title: tab.title,
                                url: tab.url,
                                description: '未找到页面描述'
                            });
                        }
                        
                        // 更新标签
                        if (response.keywords && response.keywords.length > 0) {
                            tagsInput.value = response.keywords.slice(0, 5).join(', ');
                        }
                        
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
                        updatePreview({
                            title: tab.title,
                            url: tab.url,
                            description: basicInfo.description
                        });
                    } else {
                        updatePreview({
                            title: tab.title,
                            url: tab.url,
                            description: '无法获取页面描述'
                        });
                    }
                } catch (fallbackError) {
                    console.log('备用方案也失败:', fallbackError);
                    updatePreview({
                        title: tab.title,
                        url: tab.url,
                        description: '无法获取页面描述'
                    });
                }
            }
        }
        
        // 设置焦点到备注输入框
        noteInput.focus();
        
    } catch (error) {
        console.error('初始化失败:', error);
        showMessage('初始化失败', 'error');
    }
}

// 更新预览区域
function updatePreview(pageInfo) {
    if (pageInfo.title) {
        titlePreview.textContent = pageInfo.title;
    }
    if (pageInfo.url) {
        urlPreview.textContent = pageInfo.url;
    }
    if (pageInfo.description) {
        descriptionPreview.textContent = pageInfo.description;
        descriptionPreview.style.display = pageInfo.description ? 'block' : 'none';
    }
}

// 更新截图显示
function updateScreenshot(screenshotDataUrl) {
    if (screenshotDataUrl) {
        const img = document.createElement('img');
        img.src = screenshotDataUrl;
        img.alt = '页面截图';
        
        // 清空容器并添加图片
        screenshotContainer.innerHTML = '';
        screenshotContainer.appendChild(img);
    }
}

// 加载文件夹数据
async function loadFolders() {
    try {
        // 等待存储初始化
        if (!favStorage.chromeBookmarks) {
            await favStorage.init();
        }
        
        const folders = await favStorage.getFolders();
        console.log('加载的文件夹:', folders);
        
        // 清空现有选项
        categorySelect.innerHTML = '<option value="1">书签栏</option>';
        
        // 添加文件夹选项
        folders.forEach(folder => {
            if (folder.title && folder.title !== '书签栏' && folder.title !== '其他书签') {
                const option = document.createElement('option');
                option.value = folder.id;
                const indent = '  '.repeat(folder.level || 0);
                option.textContent = `${indent}📁 ${folder.title}`;
                categorySelect.appendChild(option);
            }
        });
        
        // 添加默认的Chrome文件夹
        const otherOption = document.createElement('option');
        otherOption.value = '2';
        otherOption.textContent = '📁 其他书签';
        categorySelect.appendChild(otherOption);
        
    } catch (error) {
        console.error('加载文件夹失败:', error);
        // 失败时设置默认选项
        categorySelect.innerHTML = '<option value="1">书签栏</option><option value="2">其他书签</option>';
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
cancelBtn.addEventListener('click', () => {
    window.close();
});

saveBtn.addEventListener('click', () => {
    saveBookmark();
});

// 回车键保存
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        saveBookmark();
    } else if (e.key === 'Escape') {
        window.close();
    }
});

openDashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'dashboard.html' });
    window.close();
});

searchBookmarksLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'dashboard.html#search' });
    window.close();
});

// 保存收藏
async function saveBookmark() {
    // 验证必填字段
    if (!titleInput.value.trim()) {
        showMessage('请输入标题', 'error');
        titleInput.focus();
        return;
    }
    
    if (!urlInput.value.trim()) {
        showMessage('请输入网址', 'error');
        urlInput.focus();
        return;
    }
    
    // 验证URL格式
    if (!isValidUrl(urlInput.value.trim())) {
        showMessage('请输入有效的网址', 'error');
        urlInput.focus();
        return;
    }
    
    // 显示加载状态
    showLoading(true);
    
    try {
        // 获取网页截图
        let screenshot = '';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 80 });
        } catch (error) {
            console.log('截图失败:', error);
        }

        // 构建收藏数据
        const bookmark = {
            title: titleInput.value.trim(),
            url: urlInput.value.trim(),
            description: descriptionInput.value.trim(),
            folderId: categorySelect.value || '1', // 文件夹ID而不是分类
            tags: parseTagsInput(tagsInput.value),
            note: noteInput.value.trim(),
            screenshot: screenshot,
            createdAt: new Date().toISOString()
        };
        
        // 直接使用FavStorage保存到Chrome书签
        await favStorage.init();
        const response = await favStorage.addBookmark(bookmark);
        
        if (response) {
            showMessage('保存成功！', 'success');
            // 2秒后关闭弹窗
            setTimeout(() => {
                window.close();
            }, 1500);
        } else {
            throw new Error('保存失败');
        }
        
    } catch (error) {
        console.error('保存收藏失败:', error);
        showMessage('保存失败：' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// 解析标签输入
function parseTagsInput(input) {
    if (!input.trim()) return [];
    return input
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 10); // 限制最多10个标签
}

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
    
    // 3秒后隐藏消息
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 3000);
}

// 显示/隐藏加载状态
function showLoading(show) {
    if (show) {
        loadingEl.classList.remove('hidden');
        saveBtn.disabled = true;
    } else {
        loadingEl.classList.add('hidden');
        saveBtn.disabled = false;
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
            tags: tagsInput.value,
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
                if (!descriptionInput.value && draft.description) descriptionInput.value = draft.description;
                if (draft.category !== '其他') categorySelect.value = draft.category;
                if (!tagsInput.value && draft.tags) tagsInput.value = draft.tags;
                if (!noteInput.value && draft.note) noteInput.value = draft.note;
            }
            // 清除草稿
            localStorage.removeItem('favmanager_draft');
        }
    } catch (error) {
        console.log('恢复草稿失败:', error);
    }
}

// 为输入框绑定草稿保存事件和实时预览更新
[titleInput, descriptionInput, categorySelect, tagsInput, noteInput].forEach(el => {
    el.addEventListener('input', saveDraft);
    el.addEventListener('change', saveDraft);
});

// 绑定实时预览更新
titleInput.addEventListener('input', updatePreviewFromInputs);
urlInput.addEventListener('input', updatePreviewFromInputs);
descriptionInput.addEventListener('input', updatePreviewFromInputs);

// 从输入框更新预览
function updatePreviewFromInputs() {
    updatePreview({
        title: titleInput.value || '无标题',
        url: urlInput.value || '',
        description: descriptionInput.value || ''
    });
}

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

// 当URL改变时，自动建议标签
urlInput.addEventListener('blur', () => {
    if (urlInput.value && !tagsInput.value) {
        const suggestions = suggestTags(urlInput.value);
        if (suggestions.length > 0) {
            tagsInput.value = suggestions.join(', ');
        }
    }
});

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