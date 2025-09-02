// FavManager Content Script
// 用于获取页面详细信息

console.log('FavManager Content Script 加载');

// 避免重复注入检查
if (window.favManagerContentLoaded) {
    console.log('FavManager Content Script 已经存在，跳过重复加载');
} else {
    window.favManagerContentLoaded = true;
    
    // 监听来自 popup 和 background 的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Content script 收到消息:', request);
        
        if (request.action === 'getPageInfo') {
            try {
                const pageInfo = getPageInfo();
                console.log('准备发送页面信息:', pageInfo);
                
                // 确保返回包含 success 标志的响应
                const response = {
                    ...pageInfo,
                    success: true,
                    timestamp: Date.now()
                };
                
                sendResponse(response);
            } catch (error) {
                console.error('获取页面信息时出错:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    title: document.title || '',
                    url: window.location.href || '',
                    description: '',
                    keywords: [],
                    favicon: ''
                });
            }
        }
        
        // 重要：返回 true 表示异步响应
        return true;
    });
    
    console.log('FavManager Content Script 消息监听器已设置');
}

// 获取页面详细信息
function getPageInfo() {
    try {
        const info = {
            title: document.title,
            url: window.location.href,
            description: getDescription(),
            favicon: getFavicon(),
            keywords: getKeywords(),
            author: getAuthor(),
            publishDate: getPublishDate(),
            contentType: getContentType()
        };
        
        return info;
    } catch (error) {
        console.error('获取页面信息失败:', error);
        return {
            title: document.title,
            url: window.location.href,
            description: '',
            favicon: '',
            keywords: [],
            author: '',
            publishDate: '',
            contentType: 'webpage'
        };
    }
}

// 获取页面描述
function getDescription() {
    // 优先级：meta description > og:description > twitter:description > 第一段文字
    
    // Meta description
    let description = getMetaContent('description');
    if (description && description.trim()) return description.trim();
    
    // Open Graph description
    description = getMetaContent('og:description');
    if (description && description.trim()) return description.trim();
    
    // Twitter description
    description = getMetaContent('twitter:description');
    if (description && description.trim()) return description.trim();
    
    // JSON-LD 结构化数据
    description = getJsonLdDescription();
    if (description) return description;
    
    // 尝试多种选择器获取主要内容
    const contentSelectors = [
        'p',
        'article p',
        '.content p', 
        '.post-content p',
        '.entry-content p',
        'main p',
        '[role="main"] p'
    ];
    
    for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const text = element.textContent.trim();
            if (text.length > 20 && text.length < 1000) { // 合理长度的段落
                return text.length > 200 ? text.substring(0, 200) + '...' : text;
            }
        }
    }
    
    // 尝试获取页面的主要文本内容
    const mainContent = document.querySelector('main') || 
                       document.querySelector('article') || 
                       document.querySelector('.content') ||
                       document.querySelector('#content');
                       
    if (mainContent) {
        const text = mainContent.textContent.trim();
        if (text.length > 20) {
            // 获取前几句话
            const sentences = text.split(/[.!?。！？]/);
            let description = '';
            for (const sentence of sentences) {
                const cleanSentence = sentence.trim();
                if (cleanSentence.length > 10) {
                    description += cleanSentence + '。';
                    if (description.length > 150) break;
                }
                if (description.length > 200) break;
            }
            if (description) return description.length > 200 ? description.substring(0, 200) + '...' : description;
        }
    }
    
    return '';
}

// 获取网站图标
function getFavicon() {
    // 尝试不同的图标来源
    const selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]'
    ];
    
    for (const selector of selectors) {
        const link = document.querySelector(selector);
        if (link && link.href) {
            return link.href;
        }
    }
    
    // 默认 favicon.ico
    return `${window.location.protocol}//${window.location.host}/favicon.ico`;
}

// 获取关键词
function getKeywords() {
    const keywords = new Set();
    
    // Meta keywords
    const metaKeywords = getMetaContent('keywords');
    if (metaKeywords) {
        metaKeywords.split(',').forEach(keyword => {
            const trimmed = keyword.trim();
            if (trimmed) keywords.add(trimmed);
        });
    }
    
    // 从标题中提取关键词
    const titleWords = extractWordsFromText(document.title);
    titleWords.forEach(word => keywords.add(word));
    
    // 从 H1, H2 标签中提取
    const headings = document.querySelectorAll('h1, h2');
    headings.forEach(heading => {
        const words = extractWordsFromText(heading.textContent);
        words.forEach(word => keywords.add(word));
    });
    
    // 基于URL路径猜测关键词
    const pathKeywords = extractKeywordsFromUrl(window.location.href);
    pathKeywords.forEach(keyword => keywords.add(keyword));
    
    return Array.from(keywords).slice(0, 10); // 最多返回10个关键词
}

// 获取作者信息
function getAuthor() {
    // 尝试多种方式获取作者
    const selectors = [
        '[rel="author"]',
        '[name="author"]',
        '.author',
        '.by-author',
        '.post-author',
        '.article-author'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent || element.getAttribute('content') || '';
            if (text.trim()) {
                return text.trim();
            }
        }
    }
    
    // Meta author
    return getMetaContent('author') || '';
}

// 获取发布日期
function getPublishDate() {
    // JSON-LD 结构化数据
    const jsonLdDate = getJsonLdDate();
    if (jsonLdDate) return jsonLdDate;
    
    // Meta 标签
    const metaDate = getMetaContent('article:published_time') || 
                    getMetaContent('datePublished') ||
                    getMetaContent('date');
    if (metaDate) return metaDate;
    
    // 时间标签
    const timeElement = document.querySelector('time[datetime]');
    if (timeElement) {
        return timeElement.getAttribute('datetime');
    }
    
    return '';
}

// 识别内容类型
function getContentType() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    
    // 视频网站
    if (url.includes('youtube.com') || url.includes('youtu.be') || 
        url.includes('bilibili.com') || url.includes('vimeo.com')) {
        return 'video';
    }
    
    // 代码仓库
    if (url.includes('github.com') || url.includes('gitlab.com') || 
        url.includes('bitbucket.org')) {
        return 'repository';
    }
    
    // 技术文档
    if (url.includes('docs.') || url.includes('/docs/') || 
        title.includes('documentation') || title.includes('api reference')) {
        return 'documentation';
    }
    
    // 博客文章
    if (document.querySelector('article') || 
        title.includes('blog') || url.includes('/blog/')) {
        return 'article';
    }
    
    // 问答网站
    if (url.includes('stackoverflow.com') || url.includes('zhihu.com') ||
        url.includes('quora.com')) {
        return 'qa';
    }
    
    // 新闻网站
    if (url.includes('news') || document.querySelector('.news') ||
        document.querySelector('[class*="news"]')) {
        return 'news';
    }
    
    return 'webpage';
}

// 辅助函数：获取 Meta 标签内容
function getMetaContent(name) {
    const selectors = [
        `meta[name="${name}"]`,
        `meta[property="${name}"]`,
        `meta[itemprop="${name}"]`
    ];
    
    for (const selector of selectors) {
        const meta = document.querySelector(selector);
        if (meta) {
            const content = meta.getAttribute('content');
            if (content && content.trim()) {
                return content.trim();
            }
        }
    }
    return '';
}

// 从 JSON-LD 结构化数据获取描述
function getJsonLdDescription() {
    try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            const data = JSON.parse(script.textContent);
            if (data.description) {
                return data.description;
            }
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.description) {
                        return item.description;
                    }
                }
            }
        }
    } catch (error) {
        // 忽略解析错误
    }
    return '';
}

// 从 JSON-LD 获取日期
function getJsonLdDate() {
    try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            const data = JSON.parse(script.textContent);
            const date = data.datePublished || data.dateCreated || data.dateModified;
            if (date) return date;
            
            if (Array.isArray(data)) {
                for (const item of data) {
                    const itemDate = item.datePublished || item.dateCreated || item.dateModified;
                    if (itemDate) return itemDate;
                }
            }
        }
    } catch (error) {
        // 忽略解析错误
    }
    return '';
}

// 从文本中提取关键词
function extractWordsFromText(text) {
    if (!text) return [];
    
    // 清理和分词
    const words = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff\s]/g, ' ') // 保留中英文字符
        .split(/\s+/)
        .filter(word => word.length >= 2 && word.length <= 20)
        .filter(word => !isStopWord(word));
    
    return [...new Set(words)].slice(0, 5);
}

// 从URL中提取关键词
function extractKeywordsFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const segments = path.split('/').filter(segment => 
            segment && segment.length > 1 && !segment.match(/^\d+$/)
        );
        
        const keywords = segments.flatMap(segment => 
            segment.split(/[-_]/).filter(word => 
                word.length > 2 && !isStopWord(word)
            )
        );
        
        return [...new Set(keywords)].slice(0, 3);
    } catch (error) {
        return [];
    }
}

// 停用词检查（简化版）
function isStopWord(word) {
    const stopWords = new Set([
        // 英文停用词
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
        // 中文停用词
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'
    ]);
    
    return stopWords.has(word.toLowerCase());
}

// 页面加载完成后的初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('FavManager Content Script 初始化完成');
    // 可以在这里添加页面监控或其他初始化逻辑
}