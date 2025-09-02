// FavManager 数据存储管理
// 提供统一的数据存储接口，整合Chrome原生书签

class FavStorage {
    constructor() {
        this.STORAGE_KEYS = {
            BOOKMARKS: 'favmanager_bookmarks',
            FOLDERS: 'favmanager_folders', 
            SETTINGS: 'favmanager_settings',
            STATS: 'favmanager_stats'
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
    
    // 收藏夹相关方法
    async getBookmarks() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEYS.BOOKMARKS);
            return result[this.STORAGE_KEYS.BOOKMARKS] || [];
        } catch (error) {
            console.error('获取收藏夹失败:', error);
            return [];
        }
    }
    
    async setBookmarks(bookmarks) {
        try {
            await chrome.storage.local.set({
                [this.STORAGE_KEYS.BOOKMARKS]: bookmarks
            });
            return true;
        } catch (error) {
            console.error('保存收藏夹失败:', error);
            return false;
        }
    }
    
    async addBookmark(bookmark) {
        try {
            const bookmarks = await this.getBookmarks();
            
            // 检查是否已存在
            const exists = bookmarks.some(b => b.url === bookmark.url);
            if (exists) {
                throw new Error('该网址已存在于收藏夹中');
            }
            
            // 生成ID和时间戳
            bookmark.id = this.generateId();
            bookmark.createdAt = new Date().toISOString();
            bookmark.updatedAt = bookmark.createdAt;
            
            // 添加到列表开头
            bookmarks.unshift(bookmark);
            
            await this.setBookmarks(bookmarks);
            
            // 更新统计
            await this.updateStats('bookmarkAdded');
            
            return bookmark;
        } catch (error) {
            console.error('添加收藏失败:', error);
            throw error;
        }
    }
    
    async updateBookmark(id, updates) {
        try {
            const bookmarks = await this.getBookmarks();
            const index = bookmarks.findIndex(b => b.id === id);
            
            if (index === -1) {
                throw new Error('收藏不存在');
            }
            
            // 更新书签
            bookmarks[index] = {
                ...bookmarks[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            await this.setBookmarks(bookmarks);
            return bookmarks[index];
        } catch (error) {
            console.error('更新收藏失败:', error);
            throw error;
        }
    }
    
    async deleteBookmark(id) {
        try {
            const bookmarks = await this.getBookmarks();
            const filteredBookmarks = bookmarks.filter(b => b.id !== id);
            
            if (filteredBookmarks.length === bookmarks.length) {
                throw new Error('收藏不存在');
            }
            
            await this.setBookmarks(filteredBookmarks);
            
            // 更新统计
            await this.updateStats('bookmarkDeleted');
            
            return true;
        } catch (error) {
            console.error('删除收藏失败:', error);
            throw error;
        }
    }
    
    async deleteBookmarks(ids) {
        try {
            const bookmarks = await this.getBookmarks();
            const filteredBookmarks = bookmarks.filter(b => !ids.includes(b.id));
            
            await this.setBookmarks(filteredBookmarks);
            
            // 更新统计
            const deletedCount = bookmarks.length - filteredBookmarks.length;
            await this.updateStats('bookmarkDeleted', deletedCount);
            
            return deletedCount;
        } catch (error) {
            console.error('批量删除收藏失败:', error);
            throw error;
        }
    }
    
    // 搜索收藏
    async searchBookmarks(query, filters = {}) {
        try {
            const bookmarks = await this.getBookmarks();
            let results = bookmarks;
            
            // 文本搜索
            if (query && query.trim()) {
                const searchTerm = query.toLowerCase();
                results = results.filter(bookmark => 
                    bookmark.title.toLowerCase().includes(searchTerm) ||
                    bookmark.url.toLowerCase().includes(searchTerm) ||
                    (bookmark.description && bookmark.description.toLowerCase().includes(searchTerm)) ||
                    (bookmark.note && bookmark.note.toLowerCase().includes(searchTerm)) ||
                    bookmark.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                );
            }
            
            // 分类筛选
            if (filters.category && filters.category !== 'all') {
                results = results.filter(bookmark => bookmark.category === filters.category);
            }
            
            // 标签筛选
            if (filters.tags && filters.tags.length > 0) {
                results = results.filter(bookmark => 
                    filters.tags.some(tag => bookmark.tags.includes(tag))
                );
            }
            
            // 日期筛选
            if (filters.dateFrom || filters.dateTo) {
                results = results.filter(bookmark => {
                    const bookmarkDate = new Date(bookmark.createdAt);
                    if (filters.dateFrom && bookmarkDate < new Date(filters.dateFrom)) return false;
                    if (filters.dateTo && bookmarkDate > new Date(filters.dateTo)) return false;
                    return true;
                });
            }
            
            // 更新搜索统计
            await this.updateStats('searchPerformed');
            
            return results;
        } catch (error) {
            console.error('搜索收藏失败:', error);
            return [];
        }
    }
    
    // 分类相关方法
    async getCategories() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEYS.CATEGORIES);
            return result[this.STORAGE_KEYS.CATEGORIES] || this.DEFAULT_CATEGORIES;
        } catch (error) {
            console.error('获取分类失败:', error);
            return this.DEFAULT_CATEGORIES;
        }
    }
    
    async setCategories(categories) {
        try {
            await chrome.storage.local.set({
                [this.STORAGE_KEYS.CATEGORIES]: categories
            });
            return true;
        } catch (error) {
            console.error('保存分类失败:', error);
            return false;
        }
    }
    
    async addCategory(category) {
        try {
            const categories = await this.getCategories();
            
            // 检查是否已存在
            const exists = categories.some(c => c.name === category.name || c.id === category.id);
            if (exists) {
                throw new Error('分类已存在');
            }
            
            category.id = category.id || this.generateId();
            categories.push(category);
            
            await this.setCategories(categories);
            return category;
        } catch (error) {
            console.error('添加分类失败:', error);
            throw error;
        }
    }
    
    // 设置相关方法
    async getSettings() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEYS.SETTINGS);
            return { ...this.DEFAULT_SETTINGS, ...result[this.STORAGE_KEYS.SETTINGS] };
        } catch (error) {
            console.error('获取设置失败:', error);
            return this.DEFAULT_SETTINGS;
        }
    }
    
    async setSettings(settings) {
        try {
            const currentSettings = await this.getSettings();
            const newSettings = { ...currentSettings, ...settings };
            
            await chrome.storage.local.set({
                [this.STORAGE_KEYS.SETTINGS]: newSettings
            });
            return newSettings;
        } catch (error) {
            console.error('保存设置失败:', error);
            return false;
        }
    }
    
    // 统计相关方法
    async getStats() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEYS.STATS);
            const defaultStats = {
                totalBookmarks: 0,
                totalSearches: 0,
                totalClicks: 0,
                bookmarksAddedToday: 0,
                searchesToday: 0,
                clicksToday: 0,
                lastUpdated: new Date().toISOString(),
                dailyStats: {}
            };
            return { ...defaultStats, ...result[this.STORAGE_KEYS.STATS] };
        } catch (error) {
            console.error('获取统计失败:', error);
            return {};
        }
    }
    
    async updateStats(action, count = 1) {
        try {
            const stats = await this.getStats();
            const today = new Date().toISOString().split('T')[0];
            
            // 初始化今日统计
            if (!stats.dailyStats[today]) {
                stats.dailyStats[today] = {
                    bookmarksAdded: 0,
                    searches: 0,
                    clicks: 0
                };
            }
            
            // 更新统计
            switch (action) {
                case 'bookmarkAdded':
                    stats.totalBookmarks += count;
                    stats.bookmarksAddedToday += count;
                    stats.dailyStats[today].bookmarksAdded += count;
                    break;
                case 'bookmarkDeleted':
                    stats.totalBookmarks = Math.max(0, stats.totalBookmarks - count);
                    break;
                case 'searchPerformed':
                    stats.totalSearches += count;
                    stats.searchesToday += count;
                    stats.dailyStats[today].searches += count;
                    break;
                case 'bookmarkClicked':
                    stats.totalClicks += count;
                    stats.clicksToday += count;
                    stats.dailyStats[today].clicks += count;
                    break;
            }
            
            stats.lastUpdated = new Date().toISOString();
            
            // 清理过期的日统计（保留30天）
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
            
            Object.keys(stats.dailyStats).forEach(date => {
                if (date < cutoffDate) {
                    delete stats.dailyStats[date];
                }
            });
            
            await chrome.storage.local.set({
                [this.STORAGE_KEYS.STATS]: stats
            });
            
            return stats;
        } catch (error) {
            console.error('更新统计失败:', error);
        }
    }
    
    // 数据导出
    async exportData(format = 'json') {
        try {
            const bookmarks = await this.getBookmarks();
            const categories = await this.getCategories();
            const settings = await this.getSettings();
            
            const data = {
                bookmarks,
                categories,
                settings,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            
            if (format === 'json') {
                return JSON.stringify(data, null, 2);
            } else if (format === 'csv') {
                return this.convertToCSV(bookmarks);
            }
            
            return data;
        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }
    
    // 数据导入
    async importData(data, options = {}) {
        try {
            const { merge = false, validate = true } = options;
            
            if (validate) {
                if (!this.validateImportData(data)) {
                    throw new Error('导入数据格式无效');
                }
            }
            
            if (merge) {
                // 合并模式
                const existingBookmarks = await this.getBookmarks();
                const existingUrls = new Set(existingBookmarks.map(b => b.url));
                
                const newBookmarks = data.bookmarks.filter(b => !existingUrls.has(b.url));
                const mergedBookmarks = [...existingBookmarks, ...newBookmarks];
                
                await this.setBookmarks(mergedBookmarks);
            } else {
                // 替换模式
                await this.setBookmarks(data.bookmarks);
                if (data.categories) {
                    await this.setCategories(data.categories);
                }
            }
            
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            throw error;
        }
    }
    
    // 辅助方法
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    convertToCSV(bookmarks) {
        const headers = ['标题', '网址', '描述', '分类', '标签', '备注', '创建时间'];
        const rows = bookmarks.map(bookmark => [
            bookmark.title,
            bookmark.url,
            bookmark.description || '',
            bookmark.category,
            bookmark.tags.join(';'),
            bookmark.note || '',
            bookmark.createdAt
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
            
        return csvContent;
    }
    
    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.bookmarks)) return false;
        
        // 验证收藏夹数据格式
        for (const bookmark of data.bookmarks) {
            if (!bookmark.title || !bookmark.url) return false;
        }
        
        return true;
    }
}

// 导出实例
window.favStorage = new FavStorage();