// FavManager 后台服务
console.log('FavManager 后台服务启动');

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('FavManager 已安装');
  
  // 初始化存储数据
  chrome.storage.local.set({
    bookmarks: [],
    categories: ['工作', '学习', '生活', '工具', '娱乐', '其他'],
    settings: {
      defaultCategory: '其他',
      autoSave: true
    }
  });

  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'add-bookmark',
    title: chrome.i18n.getMessage('context_menu_add_bookmark'),
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'open-dashboard',
    title: chrome.i18n.getMessage('context_menu_open_manager'),
    contexts: ['page']
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-bookmark') {
    // 获取当前页面信息并保存
    saveCurrentTab(tab);
  } else if (info.menuItemId === 'open-dashboard') {
    // 打开管理页面
    chrome.tabs.create({ url: 'src/pages/dashboard/dashboard.html' });
  }
});

// 保存当前标签页到收藏
async function saveCurrentTab(tab) {
  try {
    // 向 content script 发送消息获取页面详细信息
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    
    // 获取网页截图
    let screenshot = '';
    try {
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 80 });
    } catch (error) {
      console.log('截图失败:', error);
    }
    
    const bookmark = {
      id: generateId(),
      title: response.title || tab.title,
      url: tab.url,
      description: response.description || '',
      favicon: response.favicon || tab.favIconUrl || '',
      screenshot: screenshot,
      category: '其他',
      tags: response.keywords ? response.keywords.slice(0, 3) : [],
      note: '',
      createdAt: new Date().toISOString()
    };

    // 获取现有收藏
    const result = await chrome.storage.local.get(['bookmarks']);
    const bookmarks = result.bookmarks || [];

    // 检查是否已存在
    const exists = bookmarks.some(b => b.url === bookmark.url);
    if (!exists) {
      bookmarks.unshift(bookmark);
      await chrome.storage.local.set({ bookmarks });
      
      // 显示通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FavManager',
        message: chrome.i18n.getMessage('msg_bookmark_added', [bookmark.title])
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FavManager',
        message: chrome.i18n.getMessage('msg_bookmark_exists')
      });
    }
  } catch (error) {
    console.error('保存收藏失败:', error);
  }
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 处理来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveBookmark') {
    saveBookmark(request.bookmark)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启
  }
  
  if (request.action === 'getBookmarks') {
    chrome.storage.local.get(['bookmarks'])
      .then(result => sendResponse({ bookmarks: result.bookmarks || [] }))
      .catch(error => sendResponse({ bookmarks: [] }));
    return true;
  }
  
  if (request.action === 'deleteBookmark') {
    deleteBookmark(request.id)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 保存收藏
async function saveBookmark(bookmark) {
  const result = await chrome.storage.local.get(['bookmarks']);
  const bookmarks = result.bookmarks || [];
  
  if (bookmark.id) {
    // 更新现有收藏
    const index = bookmarks.findIndex(b => b.id === bookmark.id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmark, updatedAt: new Date().toISOString() };
    }
  } else {
    // 添加新收藏
    bookmark.id = generateId();
    bookmark.createdAt = new Date().toISOString();
    bookmarks.unshift(bookmark);
  }
  
  await chrome.storage.local.set({ bookmarks });
}

// 删除收藏
async function deleteBookmark(id) {
  const result = await chrome.storage.local.get(['bookmarks']);
  const bookmarks = result.bookmarks || [];
  const filteredBookmarks = bookmarks.filter(b => b.id !== id);
  await chrome.storage.local.set({ bookmarks: filteredBookmarks });
}