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
            console.log('📚 开始读取Chrome书签...');
            
            // 检查权限
            try {
                const permissions = await chrome.permissions.getAll();
                console.log('🔐 当前扩展权限:', permissions.permissions);
                if (!permissions.permissions.includes('bookmarks')) {
                    throw new Error('缺少bookmarks权限，请在manifest.json中添加');
                }
            } catch (permError) {
                console.warn('⚠️ 权限检查失败，继续尝试访问书签API:', permError);
            }
            
            console.log('🌳 获取Chrome书签树...');
            this.bookmarkTree = await chrome.bookmarks.getTree();
            console.log('✅ Chrome书签树获取成功');
            console.log('📊 书签树结构概览:', this.bookmarkTree.map(node => ({
                id: node.id,
                title: node.title,
                children: node.children ? node.children.length : 0
            })));
            
            if (!this.bookmarkTree || this.bookmarkTree.length === 0) {
                console.error('❌ Chrome书签树为空或null');
                throw new Error('Chrome书签树为空');
            }
            
            this.flatBookmarks = [];
            this.folders = [];
            
            // 遍历书签树并扁平化
            this._traverseBookmarks(this.bookmarkTree);
            
            console.log('解析完成:', {
                bookmarks: this.flatBookmarks.length,
                folders: this.folders.length
            });
            
            console.log('发现的文件夹详情:', this.folders.map(f => ({
                id: f.id,
                title: f.title,
                level: f.level,
                children: f.children,
                isDefault: f.isDefault
            })));
            
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
    _traverseBookmarks(nodes, parentPath = '', level = 0) {
        for (const node of nodes) {
            const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;
            
            if (node.children) {
                // 这是一个文件夹
                // Chrome书签结构说明：
                // - id '0': 根节点（不显示）
                // - id '1': 书签栏 (Bookmarks Bar)
                // - id '2': 其他书签 (Other Bookmarks)
                // - id '3': 移动设备书签 (Mobile Bookmarks)
                
                const isRootFolder = node.id === '0';
                const isBookmarksBar = node.id === '1';
                const isOtherBookmarks = node.id === '2';
                const isMobileBookmarks = node.id === '3';
                
                if (!isRootFolder) {
                    let displayTitle = node.title;
                    let displayLevel = level;
                    
                    // 特殊处理Chrome默认文件夹
                    if (isBookmarksBar) {
                        displayTitle = '书签栏';
                    } else if (isOtherBookmarks) {
                        displayTitle = '其他书签';
                    } else if (isMobileBookmarks) {
                        displayTitle = '移动设备书签';
                    }
                    
                    this.folders.push({
                        id: node.id,
                        title: displayTitle,
                        originalTitle: node.title,
                        parentId: node.parentId,
                        path: currentPath,
                        level: displayLevel,
                        children: node.children ? node.children.length : 0,
                        dateAdded: node.dateAdded,
                        dateModified: node.dateModified,
                        isDefault: isBookmarksBar || isOtherBookmarks || isMobileBookmarks,
                        isEmpty: !node.children || node.children.length === 0
                    });
                    
                    console.log(`发现文件夹: ${displayTitle} (ID: ${node.id}, 级别: ${displayLevel}, 子项: ${node.children ? node.children.length : 0})`);
                }
                
                // 递归处理子节点，如果不是根节点则增加层级
                this._traverseBookmarks(node.children, currentPath, isRootFolder ? level : level + 1);
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
            // 使用Chrome的内部favicon API，可以获得Chrome缓存的真实favicon
            return `chrome://favicon/size/16@2x/${url}`;
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

    // 根据URL精确查找书签
    findBookmarkByUrl(url) {
        console.log('在flatBookmarks中查找URL:', url);
        console.log('当前flatBookmarks数量:', this.flatBookmarks.length);
        
        const bookmark = this.flatBookmarks.find(bookmark => bookmark.url === url);
        console.log('找到的书签:', bookmark);
        return bookmark ? [bookmark] : [];
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

    // 创建文件夹
    async createFolder(folderData) {
        try {
            const result = await chrome.bookmarks.create({
                parentId: folderData.parentId || '1',
                title: folderData.title
            });
            console.log('Chrome文件夹创建成功:', result);
            
            // 刷新本地数据
            await this.init();
            
            return result;
        } catch (error) {
            console.error('创建Chrome文件夹失败:', error);
            throw error;
        }
    }

    // 更新文件夹
    async updateFolder(id, updates) {
        try {
            const result = await chrome.bookmarks.update(id, updates);
            console.log('Chrome文件夹更新成功:', result);
            
            // 刷新本地数据
            await this.init();
            
            return result;
        } catch (error) {
            console.error('更新Chrome文件夹失败:', error);
            throw error;
        }
    }

    // 删除文件夹（安全删除：先移动内容到其他书签）
    async removeFolder(id) {
        try {
            // 获取文件夹信息
            const [folder] = await chrome.bookmarks.get(id);
            if (!folder) {
                throw new Error('文件夹不存在');
            }
            
            // 获取文件夹的子项
            const children = await chrome.bookmarks.getChildren(id);
            console.log(`文件夹 ${folder.title} 中有 ${children.length} 个子项`);
            
            // 将所有子项移动到"其他书签"（ID: '2'）
            for (const child of children) {
                await chrome.bookmarks.move(child.id, {
                    parentId: '2'  // 其他书签的ID
                });
                console.log(`已移动 ${child.title} 到其他书签`);
            }
            
            // 现在删除空文件夹
            await chrome.bookmarks.removeTree(id);
            console.log('Chrome文件夹删除成功');
            
            // 刷新本地数据
            await this.init();
            
            return children.length; // 返回移动的项目数量
        } catch (error) {
            console.error('删除Chrome文件夹失败:', error);
            throw error;
        }
    }

    // 移动文件夹
    async moveFolder(id, parentId, index) {
        try {
            const result = await chrome.bookmarks.move(id, {
                parentId: parentId,
                index: index
            });
            console.log('Chrome文件夹移动成功:', result);
            
            // 刷新本地数据
            await this.init();
            
            return result;
        } catch (error) {
            console.error('移动Chrome文件夹失败:', error);
            throw error;
        }
    }
}

// 创建全局实例
const chromeBookmarks = new ChromeBookmarksManager();

console.log('Chrome Bookmarks Manager 加载完成');