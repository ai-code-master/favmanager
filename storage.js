// FavManager 数据存储管理
// 提供统一的数据存储接口，整合Chrome原生书签

class FavStorage {
    constructor() {
        this.STORAGE_KEYS = {
            SETTINGS: 'favmanager_settings',
            STATS: 'favmanager_stats',
            CUSTOM_DATA: 'favmanager_custom_data' // 存储自定义数据（笔记、标签等）
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
            if (this.chromeBookmarks) {
                const chromeBookmarks = this.chromeBookmarks.getBookmarks();
                const customData = await this.getCustomData();
                
                // 合并Chrome书签和自定义数据
                return chromeBookmarks.map(bookmark => ({
                    ...bookmark,
                    ...(customData[bookmark.id] || {}),
                    source: 'chrome'
                }));
            }
            return [];
        } catch (error) {
            console.error('获取书签失败:', error);
            return [];
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
            if (bookmark.description || bookmark.tags || bookmark.note) {
                await this.saveCustomData(chromeBookmark.id, {
                    description: bookmark.description || '',
                    tags: bookmark.tags || [],
                    note: bookmark.note || '',
                    screenshot: bookmark.screenshot || '',
                    customData: bookmark.customData || {}
                });
            }

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
            }

            // 更新自定义数据
            const customUpdates = {};
            if ('description' in updates) customUpdates.description = updates.description;
            if ('tags' in updates) customUpdates.tags = updates.tags;
            if ('note' in updates) customUpdates.note = updates.note;
            if ('screenshot' in updates) customUpdates.screenshot = updates.screenshot;

            if (Object.keys(customUpdates).length > 0) {
                await this.saveCustomData(id, customUpdates);
            }

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
    async getCustomData() {
        try {
            const result = await chrome.storage.local.get([this.STORAGE_KEYS.CUSTOM_DATA]);
            return result[this.STORAGE_KEYS.CUSTOM_DATA] || {};
        } catch (error) {
            console.error('获取自定义数据失败:', error);
            return {};
        }
    }

    // 保存自定义数据
    async saveCustomData(bookmarkId, data) {
        try {
            const customData = await this.getCustomData();
            customData[bookmarkId] = {
                ...customData[bookmarkId],
                ...data,
                updatedAt: new Date().toISOString()
            };

            await chrome.storage.local.set({
                [this.STORAGE_KEYS.CUSTOM_DATA]: customData
            });

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
}

// 创建全局实例
const favStorage = new FavStorage();

console.log('FavStorage 加载完成');