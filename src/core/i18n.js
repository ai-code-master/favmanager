// FavManager i18n 国际化工具
console.log('FavManager i18n 工具加载');

class I18nManager {
    constructor() {
        this.currentLanguage = 'en';
        this.initialized = false;
    }

    // 初始化i18n
    async init() {
        if (this.initialized) return;
        
        try {
            // 获取当前语言
            this.currentLanguage = chrome.i18n.getUILanguage();
            console.log('当前语言:', this.currentLanguage);
            
            // 初始化页面翻译
            this.translatePage();
            
            this.initialized = true;
            console.log('i18n 初始化完成');
        } catch (error) {
            console.error('i18n 初始化失败:', error);
        }
    }

    // 获取翻译文本
    t(key, params = []) {
        try {
            return chrome.i18n.getMessage(key, params);
        } catch (error) {
            console.warn(`翻译key未找到: ${key}`);
            return key; // 返回key作为fallback
        }
    }

    // 翻译整个页面
    translatePage() {
        // 翻译所有带 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        // 翻译 placeholder 属性
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // 翻译 title 属性
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.title = translation;
            }
        });

        // 翻译 alt 属性
        document.querySelectorAll('[data-i18n-alt]').forEach(element => {
            const key = element.getAttribute('data-i18n-alt');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.alt = translation;
            }
        });

        // 翻译页面title
        const titleElement = document.querySelector('title[data-i18n]');
        if (titleElement) {
            const key = titleElement.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
                document.title = translation;
            }
        }
    }

    // 动态翻译单个元素
    translateElement(element, key, attribute = 'textContent') {
        const translation = this.t(key);
        if (translation && translation !== key) {
            if (attribute === 'textContent') {
                element.textContent = translation;
            } else if (attribute === 'placeholder') {
                element.placeholder = translation;
            } else if (attribute === 'title') {
                element.title = translation;
            } else if (attribute === 'alt') {
                element.alt = translation;
            } else {
                element.setAttribute(attribute, translation);
            }
        }
    }

    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // 检查是否为RTL语言
    isRTL() {
        const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
        const lang = this.currentLanguage.split('-')[0];
        return rtlLanguages.includes(lang);
    }

    // 格式化消息（带参数）
    formatMessage(key, params = {}) {
        const template = this.t(key);
        if (!template || template === key) return key;
        
        // 替换参数占位符
        return template.replace(/\$(\w+)\$/g, (match, paramName) => {
            return params[paramName] !== undefined ? params[paramName] : match;
        });
    }

    // 获取支持的语言列表
    getSupportedLanguages() {
        return [
            { code: 'en', name: 'English' },
            { code: 'zh-CN', name: '简体中文' },
            { code: 'zh-TW', name: '繁體中文' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' }
        ];
    }

    // 设置页面方向
    setPageDirection() {
        const direction = this.isRTL() ? 'rtl' : 'ltr';
        document.documentElement.dir = direction;
        document.documentElement.lang = this.currentLanguage;
    }

    // 观察DOM变化，自动翻译新添加的元素
    observeDOM() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 翻译新添加的元素
                        const element = node;
                        
                        // 检查元素自身
                        if (element.hasAttribute('data-i18n')) {
                            const key = element.getAttribute('data-i18n');
                            this.translateElement(element, key);
                        }
                        
                        if (element.hasAttribute('data-i18n-placeholder')) {
                            const key = element.getAttribute('data-i18n-placeholder');
                            this.translateElement(element, key, 'placeholder');
                        }
                        
                        if (element.hasAttribute('data-i18n-title')) {
                            const key = element.getAttribute('data-i18n-title');
                            this.translateElement(element, key, 'title');
                        }
                        
                        // 检查子元素
                        const i18nElements = element.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]');
                        i18nElements.forEach(child => {
                            if (child.hasAttribute('data-i18n')) {
                                const key = child.getAttribute('data-i18n');
                                this.translateElement(child, key);
                            }
                            if (child.hasAttribute('data-i18n-placeholder')) {
                                const key = child.getAttribute('data-i18n-placeholder');
                                this.translateElement(child, key, 'placeholder');
                            }
                            if (child.hasAttribute('data-i18n-title')) {
                                const key = child.getAttribute('data-i18n-title');
                                this.translateElement(child, key, 'title');
                            }
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// 创建全局i18n实例
const i18n = new I18nManager();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        i18n.init();
    });
} else {
    i18n.init();
}

// 导出全局变量
window.i18n = i18n;

console.log('FavManager i18n 工具加载完成');