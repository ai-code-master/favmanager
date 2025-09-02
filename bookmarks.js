// Chrome 书签管理模块
console.log('Chrome Bookmarks Manager 加载');

class ChromeBookmarksManager {
    constructor() {
        this.bookmarkTree = null;
        this.flatBookmarks = [];
        this.folders = [];
    }

    // 初始化：读取Chrome书签
    async init() {
        try {
            console.log('开始读取Chrome书签...');
            this.bookmarkTree = await chrome.bookmarks.getTree();
            console.log('Chrome书签树:', this.bookmarkTree);
            
            this.flatBookmarks = [];
            this.folders = [];
            
            // 遍历书签树并扁平化
            this._traverseBookmarks(this.bookmarkTree);
            
            console.log('解析完成:', {
                bookmarks: this.flatBookmarks.length,
                folders: this.folders.length
            });
            
            return {
                bookmarks: this.flatBookmarks,
                folders: this.folders
            };
        } catch (error) {
            console.error('读取Chrome书签失败:', error);
            throw error;
        }
    }

    // 递归遍历书签树
    _traverseBookmarks(nodes, parentPath = '') {
        for (const node of nodes) {
            const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;
            
            if (node.children) {
                // 这是一个文件夹
                if (node.title) { // 跳过根节点
                    this.folders.push({
                        id: node.id,
                        title: node.title,
                        parentId: node.parentId,
                        path: currentPath,
                        level: parentPath.split('/').filter(p => p).length,
                        children: node.children.length,
                        dateAdded: node.dateAdded,
                        dateModified: node.dateModified
                    });
                }
                
                // 递归处理子节点
                this._traverseBookmarks(node.children, currentPath);
            } else {
                // 这是一个书签
                this.flatBookmarks.push({
                    id: node.id,
                    title: node.title,
                    url: node.url,
                    parentId: node.parentId,
                    folderPath: parentPath,
                    dateAdded: node.dateAdded,
                    index: node.index,
                    favicon: this._getFaviconUrl(node.url)
                });
            }
        }
    }

    // 获取网站图标URL
    _getFaviconUrl(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            return `chrome://favicon/${url}`;
        } catch (error) {
            return '';
        }
    }

    // 获取所有书签
    getBookmarks() {
        return this.flatBookmarks;
    }

    // 获取所有文件夹
    getFolders() {
        return this.folders;
    }

    // 获取文件夹树结构
    getFolderTree() {
        const tree = [];
        const folderMap = new Map();
        
        // 创建文件夹映射
        for (const folder of this.folders) {
            folderMap.set(folder.id, {
                ...folder,
                children: []
            });
        }
        
        // 构建树结构
        for (const folder of this.folders) {
            const folderNode = folderMap.get(folder.id);
            if (folder.parentId && folderMap.has(folder.parentId)) {
                folderMap.get(folder.parentId).children.push(folderNode);
            } else {
                tree.push(folderNode);
            }
        }
        
        return tree;
    }

    // 根据文件夹ID获取书签
    getBookmarksByFolder(folderId) {
        return this.flatBookmarks.filter(bookmark => bookmark.parentId === folderId);
    }

    // 搜索书签
    searchBookmarks(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.flatBookmarks.filter(bookmark => 
            bookmark.title.toLowerCase().includes(lowercaseQuery) ||
            bookmark.url.toLowerCase().includes(lowercaseQuery) ||
            bookmark.folderPath.toLowerCase().includes(lowercaseQuery)
        );
    }

    // 在Chrome中创建书签
    async createBookmark(bookmark) {
        try {
            const chromeBookmark = await chrome.bookmarks.create({
                parentId: bookmark.parentId || '1', // 默认放在书签栏
                title: bookmark.title,
                url: bookmark.url,
                index: bookmark.index
            });
            
            console.log('Chrome书签创建成功:', chromeBookmark);
            
            // 刷新本地数据
            await this.init();
            
            return chromeBookmark;
        } catch (error) {
            console.error('创建Chrome书签失败:', error);
            throw error;
        }
    }

    // 更新Chrome书签
    async updateBookmark(id, updates) {
        try {
            const result = await chrome.bookmarks.update(id, updates);
            console.log('Chrome书签更新成功:', result);
            
            // 刷新本地数据
            await this.init();
            
            return result;
        } catch (error) {
            console.error('更新Chrome书签失败:', error);
            throw error;
        }
    }

    // 删除Chrome书签
    async removeBookmark(id) {
        try {
            await chrome.bookmarks.remove(id);
            console.log('Chrome书签删除成功:', id);
            
            // 刷新本地数据
            await this.init();
            
            return true;
        } catch (error) {
            console.error('删除Chrome书签失败:', error);
            throw error;
        }
    }

    // 创建文件夹
    async createFolder(title, parentId = '1') {
        try {
            const folder = await chrome.bookmarks.create({
                parentId: parentId,
                title: title
            });
            
            console.log('Chrome文件夹创建成功:', folder);
            
            // 刷新本地数据
            await this.init();
            
            return folder;
        } catch (error) {
            console.error('创建Chrome文件夹失败:', error);
            throw error;
        }
    }

    // 移动书签到指定文件夹
    async moveBookmark(id, parentId, index) {
        try {
            const result = await chrome.bookmarks.move(id, {
                parentId: parentId,
                index: index
            });
            
            console.log('Chrome书签移动成功:', result);
            
            // 刷新本地数据
            await this.init();
            
            return result;
        } catch (error) {
            console.error('移动Chrome书签失败:', error);
            throw error;
        }
    }

    // 获取最近添加的书签
    getRecentBookmarks(limit = 10) {
        return this.flatBookmarks
            .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
            .slice(0, limit);
    }

    // 获取文件夹统计信息
    getFolderStats() {
        const stats = {};
        
        for (const folder of this.folders) {
            const bookmarkCount = this.getBookmarksByFolder(folder.id).length;
            stats[folder.id] = {
                ...folder,
                bookmarkCount: bookmarkCount
            };
        }
        
        return stats;
    }

    // 监听Chrome书签变化
    setupBookmarkListeners() {
        // 监听书签创建
        chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
            console.log('Chrome书签创建事件:', id, bookmark);
            await this.init(); // 重新加载数据
            // 可以触发自定义事件通知UI更新
        });

        // 监听书签移除
        chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
            console.log('Chrome书签删除事件:', id, removeInfo);
            await this.init();
        });

        // 监听书签更改
        chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
            console.log('Chrome书签更改事件:', id, changeInfo);
            await this.init();
        });

        // 监听书签移动
        chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
            console.log('Chrome书签移动事件:', id, moveInfo);
            await this.init();
        });
    }
}

// 创建全局实例
const chromeBookmarks = new ChromeBookmarksManager();

console.log('Chrome Bookmarks Manager 加载完成');