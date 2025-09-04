// FavManager 数据存储管理
// 提供统一的数据存储接口，整合Chrome原生书签

class FavStorage {
    constructor() {
        this.STORAGE_KEYS = {
            SETTINGS: 'favmanager_settings',
            STATS: 'favmanager_stats',
            CUSTOM_DATA: 'favmanager_custom_data', // 存储自定义数据（笔记、标签等）
            BOOKMARK_ORDER: 'favmanager_bookmark_order' // 存储书签排序数据
        };
        
        // Chrome书签管理器实例
        this.chromeBookmarks = null;
        
        this.DEFAULT_SETTINGS = {
            defaultFolderId: '1', // Chrome书签栏ID
            autoSave: true,
            theme: 'light',
            viewMode: 'list',
            itemsPerPage: 20,
            showFavicons: true,
            confirmDelete: true,
            syncWithChrome: true
        };
    }
    
    // 初始化存储
    async init() {
        try {
            // 初始化Chrome书签管理器
            if (typeof chromeBookmarks !== 'undefined') {
                this.chromeBookmarks = chromeBookmarks;
                await this.chromeBookmarks.init();
                this.chromeBookmarks.setupBookmarkListeners();
                console.log('Chrome书签管理器初始化成功');
            } else {
                console.warn('Chrome书签管理器未加载');
            }
            
            const result = await chrome.storage.local.get([
                this.STORAGE_KEYS.SETTINGS
            ]);
            
            // 初始化设置
            if (!result[this.STORAGE_KEYS.SETTINGS]) {
                await this.setSettings(this.DEFAULT_SETTINGS);
            }
            
            console.log('FavStorage 初始化完成');
            return true;
        } catch (error) {
            console.error('FavStorage 初始化失败:', error);
            return false;
        }
    }
    
    // === Chrome 书签相关方法 ===
    
    // 获取所有书签（从Chrome书签）
    async getBookmarks() {
        try {
            console.log('🔍 开始获取书签数据...');
            
            if (!this.chromeBookmarks) {
                console.error('❌ chromeBookmarks实例不存在');
                throw new Error('Chrome书签管理器未初始化');
            }
            
            // 确保chromeBookmarks已经初始化
            console.log('📊 检查chromeBookmarks初始化状态...');
            if (!this.chromeBookmarks.flatBookmarks || this.chromeBookmarks.flatBookmarks.length === 0) {
                console.log('🔄 chromeBookmarks数据为空，重新初始化...');
                await this.chromeBookmarks.init();
            }
            
            const chromeBookmarks = this.chromeBookmarks.getBookmarks();
            console.log('📚 从chromeBookmarks获取到', chromeBookmarks.length, '个书签');
            
            if (chromeBookmarks.length === 0) {
                console.warn('⚠️ Chrome书签数据为空，可能的原因：');
                console.warn('   - Chrome书签权限未授予');
                console.warn('   - Chrome书签为空');
                console.warn('   - Chrome API访问失败');
                
                // 尝试直接检查Chrome API
                try {
                    const tree = await chrome.bookmarks.getTree();
                    console.log('🌳 Chrome书签树结构:', tree);
                    
                    // 重新解析书签
                    this.chromeBookmarks._traverseBookmarks(tree);
                    const retryBookmarks = this.chromeBookmarks.getBookmarks();
                    console.log('🔄 重试后获取到', retryBookmarks.length, '个书签');
                    
                    if (retryBookmarks.length > 0) {
                        return retryBookmarks.map(bookmark => ({
                            ...bookmark,
                            source: 'chrome'
                        }));
                    }
                } catch (apiError) {
                    console.error('❌ Chrome API访问失败:', apiError);
                    throw new Error('Chrome书签API访问失败: ' + apiError.message);
                }
            }
            
            const customData = await this.getCustomData();
            const bookmarkOrder = await this.getBookmarkOrder();
            
            // 合并Chrome书签和自定义数据
            const bookmarks = chromeBookmarks.map(bookmark => ({
                ...bookmark,
                ...(customData[bookmark.id] || {}),
                source: 'chrome'
            }));
            
            console.log('✅ 成功处理', bookmarks.length, '个书签数据');
            
            // 应用自定义排序
            if (Object.keys(bookmarkOrder).length > 0) {
                bookmarks.sort((a, b) => {
                    const orderA = bookmarkOrder[a.id] !== undefined ? bookmarkOrder[a.id] : Infinity;
                    const orderB = bookmarkOrder[b.id] !== undefined ? bookmarkOrder[b.id] : Infinity;
                    return orderA - orderB;
                });
                console.log('🔄 应用了自定义排序');
            }
            
            return bookmarks;
        } catch (error) {
            console.error('❌ 获取书签失败:', error);
            // 不要静默返回空数组，而是抛出错误让上层处理
            throw error;
        }
    }

    // 获取所有文件夹（从Chrome书签）
    async getFolders() {
        try {
            if (this.chromeBookmarks) {
                return this.chromeBookmarks.getFolders();
            }
            return [];
        } catch (error) {
            console.error('获取文件夹失败:', error);
            return [];
        }
    }

    // 获取文件夹树结构
    async getFolderTree() {
        try {
            if (this.chromeBookmarks) {
                return this.chromeBookmarks.getFolderTree();
            }
            return [];
        } catch (error) {
            console.error('获取文件夹树失败:', error);
            return [];
        }
    }

    // 获取文件夹统计信息
    async getFolderStats() {
        try {
            if (this.chromeBookmarks) {
                return this.chromeBookmarks.getFolderStats();
            }
            return {};
        } catch (error) {
            console.error('获取文件夹统计失败:', error);
            return {};
        }
    }

    // 根据文件夹ID获取书签
    async getBookmarksByFolder(folderId) {
        try {
            if (this.chromeBookmarks) {
                const chromeBookmarks = this.chromeBookmarks.getBookmarksByFolder(folderId);
                const customData = await this.getCustomData();
                
                return chromeBookmarks.map(bookmark => ({
                    ...bookmark,
                    ...(customData[bookmark.id] || {}),
                    source: 'chrome'
                }));
            }
            return [];
        } catch (error) {
            console.error('获取文件夹书签失败:', error);
            return [];
        }
    }

    // 搜索书签
    async searchBookmarks(query) {
        try {
            if (this.chromeBookmarks) {
                const results = this.chromeBookmarks.searchBookmarks(query);
                const customData = await this.getCustomData();
                
                return results.map(bookmark => ({
                    ...bookmark,
                    ...(customData[bookmark.id] || {}),
                    source: 'chrome'
                }));
            }
            return [];
        } catch (error) {
            console.error('搜索书签失败:', error);
            return [];
        }
    }

    // 获取最近添加的书签
    async getRecentBookmarks(limit = 10) {
        try {
            if (this.chromeBookmarks) {
                const recentBookmarks = this.chromeBookmarks.getRecentBookmarks(limit);
                const customData = await this.getCustomData();
                
                return recentBookmarks.map(bookmark => ({
                    ...bookmark,
                    ...(customData[bookmark.id] || {}),
                    source: 'chrome'
                }));
            }
            return [];
        } catch (error) {
            console.error('获取最近书签失败:', error);
            return [];
        }
    }

    // === Chrome 书签操作方法 ===

    // 检查页面是否已被收藏
    async findBookmarkByUrl(url) {
        try {
            if (!this.chromeBookmarks) {
                await this.init();
            }
            
            // 使用Chrome书签API精确查找URL
            const bookmarks = this.chromeBookmarks.findBookmarkByUrl(url);
            console.log('搜索收藏结果:', bookmarks);
            
            if (bookmarks && bookmarks.length > 0) {
                // 获取第一个匹配的书签
                const bookmark = bookmarks[0];
                console.log('找到的Chrome书签:', bookmark);
                
                // 获取自定义数据
                const customData = await this.getCustomData(bookmark.id);
                console.log(`获取书签 ${bookmark.id} 的自定义数据:`, customData);
                
                const result = {
                    ...bookmark,
                    ...customData,
                    isExisting: true
                };
                
                console.log('最终返回的书签数据:', result);
                return result;
            }
            
            return null;
            
        } catch (error) {
            console.error('查找收藏失败:', error);
            return null;
        }
    }

    // 添加书签到Chrome
    async addBookmark(bookmark) {
        try {
            if (!this.chromeBookmarks) {
                throw new Error('Chrome书签管理器未初始化');
            }

            // 创建Chrome书签
            const chromeBookmark = await this.chromeBookmarks.createBookmark({
                parentId: bookmark.folderId || this.DEFAULT_SETTINGS.defaultFolderId,
                title: bookmark.title,
                url: bookmark.url
            });

            // 保存自定义数据（描述、标签、笔记等）
            // 始终保存自定义数据，即使某些字段为空
            await this.saveCustomData(chromeBookmark.id, {
                description: bookmark.description || '',
                tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
                note: bookmark.note || '',
                screenshot: bookmark.screenshot || '',
                starred: bookmark.starred || false,
                favicon: bookmark.favicon || `chrome://favicon/size/16@2x/${bookmark.url}`,
                createdAt: bookmark.createdAt || new Date().toISOString()
            });
            
            console.log('自定义数据已保存:', {
                bookmarkId: chromeBookmark.id,
                description: bookmark.description || '',
                tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
                note: bookmark.note || ''
            });

            // 更新统计
            await this.updateStats('bookmarkAdded');

            return chromeBookmark;
        } catch (error) {
            console.error('添加书签失败:', error);
            throw error;
        }
    }

    // 更新书签
    async updateBookmark(id, updates) {
        try {
            if (!this.chromeBookmarks) {
                throw new Error('Chrome书签管理器未初始化');
            }

            // 更新Chrome书签基本信息
            const chromeUpdates = {};
            if (updates.title) chromeUpdates.title = updates.title;
            if (updates.url) chromeUpdates.url = updates.url;

            if (Object.keys(chromeUpdates).length > 0) {
                await this.chromeBookmarks.updateBookmark(id, chromeUpdates);
                console.log('Chrome书签基本信息更新成功');
            }

            // 处理文件夹移动
            if (updates.folderId) {
                await this.chromeBookmarks.moveBookmark(id, updates.folderId);
                console.log('书签移动成功，新文件夹ID:', updates.folderId);
            }

            // 获取现有自定义数据
            const existingCustomData = await this.getCustomData(id) || {};
            
            // 更新自定义数据
            const customUpdates = {
                ...existingCustomData,
                updatedAt: new Date().toISOString()
            };
            
            if ('description' in updates) customUpdates.description = updates.description;
            if ('tags' in updates) customUpdates.tags = updates.tags;
            if ('note' in updates) customUpdates.note = updates.note;
            if ('screenshot' in updates) customUpdates.screenshot = updates.screenshot;
            if ('starred' in updates) customUpdates.starred = updates.starred;

            await this.saveCustomData(id, customUpdates);
            console.log('自定义数据更新成功');

            // 更新统计
            await this.updateStats('bookmarkUpdated');

            return true;
        } catch (error) {
            console.error('更新书签失败:', error);
            throw error;
        }
    }

    // 删除书签
    async deleteBookmark(id) {
        try {
            if (!this.chromeBookmarks) {
                throw new Error('Chrome书签管理器未初始化');
            }

            // 删除Chrome书签
            await this.chromeBookmarks.removeBookmark(id);

            // 删除自定义数据
            await this.removeCustomData(id);

            // 更新统计
            await this.updateStats('bookmarkDeleted');

            return true;
        } catch (error) {
            console.error('删除书签失败:', error);
            throw error;
        }
    }

    // 批量删除书签
    async deleteBookmarks(ids) {
        try {
            const errors = [];
            for (const id of ids) {
                try {
                    await this.deleteBookmark(id);
                } catch (error) {
                    errors.push({ id, error: error.message });
                }
            }
            
            if (errors.length > 0) {
                console.warn('部分书签删除失败:', errors);
            }
            
            return { success: ids.length - errors.length, errors };
        } catch (error) {
            console.error('批量删除书签失败:', error);
            throw error;
        }
    }

    // 创建文件夹
    async createFolder(title, parentId) {
        try {
            if (!this.chromeBookmarks) {
                throw new Error('Chrome书签管理器未初始化');
            }

            return await this.chromeBookmarks.createFolder(title, parentId);
        } catch (error) {
            console.error('创建文件夹失败:', error);
            throw error;
        }
    }

    // 移动书签
    async moveBookmark(id, parentId, index) {
        try {
            if (!this.chromeBookmarks) {
                throw new Error('Chrome书签管理器未初始化');
            }

            return await this.chromeBookmarks.moveBookmark(id, parentId, index);
        } catch (error) {
            console.error('移动书签失败:', error);
            throw error;
        }
    }

    // === 自定义数据管理 ===

    // 获取自定义数据
    async getCustomData(bookmarkId = null) {
        try {
            const result = await chrome.storage.local.get([this.STORAGE_KEYS.CUSTOM_DATA]);
            const allCustomData = result[this.STORAGE_KEYS.CUSTOM_DATA] || {};
            
            // 如果指定了bookmarkId，返回特定书签的数据
            if (bookmarkId) {
                return allCustomData[bookmarkId] || {};
            }
            
            // 否则返回所有数据
            return allCustomData;
        } catch (error) {
            console.error('获取自定义数据失败:', error);
            return bookmarkId ? {} : {};
        }
    }

    // 保存自定义数据
    async saveCustomData(bookmarkId, data) {
        try {
            console.log(`开始保存书签 ${bookmarkId} 的自定义数据:`, data);
            
            const customData = await this.getCustomData();
            console.log('当前所有自定义数据:', customData);
            
            customData[bookmarkId] = {
                ...customData[bookmarkId],
                ...data,
                updatedAt: new Date().toISOString()
            };
            
            console.log(`准备保存的书签 ${bookmarkId} 数据:`, customData[bookmarkId]);

            await chrome.storage.local.set({
                [this.STORAGE_KEYS.CUSTOM_DATA]: customData
            });

            console.log(`书签 ${bookmarkId} 自定义数据保存成功`);
            
            // 验证保存结果
            const savedData = await this.getCustomData(bookmarkId);
            console.log(`验证保存结果 - 书签 ${bookmarkId}:`, savedData);

            return true;
        } catch (error) {
            console.error('保存自定义数据失败:', error);
            return false;
        }
    }

    // 删除自定义数据
    async removeCustomData(bookmarkId) {
        try {
            const customData = await this.getCustomData();
            delete customData[bookmarkId];

            await chrome.storage.local.set({
                [this.STORAGE_KEYS.CUSTOM_DATA]: customData
            });

            return true;
        } catch (error) {
            console.error('删除自定义数据失败:', error);
            return false;
        }
    }

    // === 设置管理 ===

    async getSettings() {
        try {
            const result = await chrome.storage.local.get([this.STORAGE_KEYS.SETTINGS]);
            return { ...this.DEFAULT_SETTINGS, ...result[this.STORAGE_KEYS.SETTINGS] };
        } catch (error) {
            console.error('获取设置失败:', error);
            return this.DEFAULT_SETTINGS;
        }
    }

    async setSettings(settings) {
        try {
            await chrome.storage.local.set({
                [this.STORAGE_KEYS.SETTINGS]: settings
            });
            return true;
        } catch (error) {
            console.error('保存设置失败:', error);
            return false;
        }
    }

    async updateSettings(updates) {
        try {
            const currentSettings = await this.getSettings();
            const newSettings = { ...currentSettings, ...updates };
            return await this.setSettings(newSettings);
        } catch (error) {
            console.error('更新设置失败:', error);
            return false;
        }
    }

    // === 统计信息 ===

    async getStats() {
        try {
            const result = await chrome.storage.local.get([this.STORAGE_KEYS.STATS]);
            return result[this.STORAGE_KEYS.STATS] || {
                bookmarksAdded: 0,
                bookmarksDeleted: 0,
                bookmarksClicked: 0,
                lastUsed: null
            };
        } catch (error) {
            console.error('获取统计失败:', error);
            return {};
        }
    }

    async updateStats(action) {
        try {
            const stats = await this.getStats();
            stats[action] = (stats[action] || 0) + 1;
            stats.lastUsed = new Date().toISOString();

            await chrome.storage.local.set({
                [this.STORAGE_KEYS.STATS]: stats
            });

            return true;
        } catch (error) {
            console.error('更新统计失败:', error);
            return false;
        }
    }

    // === 书签排序管理 ===

    // 获取书签排序数据
    async getBookmarkOrder() {
        try {
            const result = await chrome.storage.local.get([this.STORAGE_KEYS.BOOKMARK_ORDER]);
            return result[this.STORAGE_KEYS.BOOKMARK_ORDER] || {};
        } catch (error) {
            console.error('获取书签排序失败:', error);
            return {};
        }
    }

    // 保存书签排序
    async saveBookmarkOrder(orderMap) {
        try {
            console.log('保存书签排序数据:', orderMap);
            
            await chrome.storage.local.set({
                [this.STORAGE_KEYS.BOOKMARK_ORDER]: orderMap
            });

            console.log('书签排序数据保存成功');
            return true;
        } catch (error) {
            console.error('保存书签排序失败:', error);
            return false;
        }
    }

    // 清空书签排序（重置为默认排序）
    async clearBookmarkOrder() {
        try {
            await chrome.storage.local.remove([this.STORAGE_KEYS.BOOKMARK_ORDER]);
            console.log('书签排序数据已清空');
            return true;
        } catch (error) {
            console.error('清空书签排序失败:', error);
            return false;
        }
    }

    // 移动单个书签的排序位置
    async moveBookmarkOrder(bookmarkId, newIndex) {
        try {
            const orderMap = await this.getBookmarkOrder();
            orderMap[bookmarkId] = newIndex;
            return await this.saveBookmarkOrder(orderMap);
        } catch (error) {
            console.error('移动书签排序失败:', error);
            return false;
        }
    }
    
}

// 创建全局实例
const favStorage = new FavStorage();

console.log('FavStorage 加载完成');