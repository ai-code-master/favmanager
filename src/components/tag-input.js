// 智能标签输入组件
console.log('Tag Input 组件加载');

class TagInput {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            maxTags: 10,
            placeholder: '添加标签...',
            ...options
        };
        
        this.tags = [];
        this.isComposing = false; // 中文输入状态
        this.suggestions = [];
        this.selectedSuggestion = -1;
        
        this.init();
    }
    
    init() {
        this.createElements();
        this.bindEvents();
        this.loadTagHistory();
    }
    
    createElements() {
        // 创建容器
        this.container = document.createElement('div');
        this.container.className = 'tag-input-container';
        
        // 创建标签容器
        this.tagsContainer = document.createElement('div');
        this.tagsContainer.className = 'tags-container';
        
        // 创建输入框
        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.placeholder = this.options.placeholder;
        this.textInput.className = 'tag-text-input';
        
        // 创建建议列表
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.className = 'tag-suggestions';
        this.suggestionsContainer.style.display = 'none';
        
        // 组装结构
        this.container.appendChild(this.tagsContainer);
        this.container.appendChild(this.textInput);
        this.container.appendChild(this.suggestionsContainer);
        
        // 替换原输入框
        this.input.parentNode.insertBefore(this.container, this.input);
        this.input.style.display = 'none';
        
        // 同步原输入框的样式类
        this.container.className += ' ' + this.input.className;
    }
    
    bindEvents() {
        // 文本输入事件
        this.textInput.addEventListener('input', (e) => {
            if (!this.isComposing) {
                this.handleInput(e.target.value);
            }
        });
        
        // 中文输入法处理
        this.textInput.addEventListener('compositionstart', () => {
            this.isComposing = true;
            console.log('输入法开始');
        });
        
        this.textInput.addEventListener('compositionend', (e) => {
            this.isComposing = false;
            console.log('输入法结束:', e.target.value);
            this.handleInput(e.target.value);
        });
        
        // 键盘事件
        this.textInput.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        // 防止拼音输入法冲突
        this.textInput.addEventListener('keyup', (e) => {
            if (e.key === ' ' && !this.isComposing && e.target.value.trim()) {
                // 延迟处理，确保输入法已完成
                setTimeout(() => {
                    if (!this.isComposing) {
                        this.handleSpaceInput();
                    }
                }, 10);
            }
        });
        
        // 失焦事件
        this.textInput.addEventListener('blur', () => {
            setTimeout(() => {
                this.hideSuggestions();
            }, 200);
        });
        
        // 聚焦事件
        this.textInput.addEventListener('focus', () => {
            if (this.textInput.value) {
                this.showSuggestions(this.textInput.value);
            }
        });
        
        // 点击容器聚焦到输入框
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container || e.target === this.tagsContainer) {
                this.textInput.focus();
            }
        });
    }
    
    handleInput(value) {
        const trimmedValue = value.trim();
        
        if (trimmedValue) {
            this.showSuggestions(trimmedValue);
        } else {
            this.hideSuggestions();
        }
    }
    
    handleKeyDown(e) {
        const value = this.textInput.value.trim();
        
        switch (e.key) {
            case 'Enter':
            case ',':
                e.preventDefault();
                if (this.selectedSuggestion >= 0) {
                    // 选择建议的标签
                    const suggestion = this.suggestions[this.selectedSuggestion];
                    this.addTag(suggestion.name);
                } else if (value) {
                    // 添加输入的标签
                    this.addTag(value);
                }
                break;
                
            case ' ':
                // 只有在不是中文输入状态时才处理空格
                if (!this.isComposing && value) {
                    // 更严格的拼音检测
                    const currentValue = this.textInput.value;
                    const isProbablyPinyin = this.isProbablyPinyin(currentValue);
                    
                    console.log('空格检测:', {
                        isComposing: this.isComposing,
                        currentValue,
                        isProbablyPinyin,
                        value
                    });
                    
                    // 如果不是拼音输入，则添加标签
                    if (!isProbablyPinyin) {
                        e.preventDefault();
                        if (this.selectedSuggestion >= 0) {
                            const suggestion = this.suggestions[this.selectedSuggestion];
                            this.addTag(suggestion.name);
                        } else {
                            this.addTag(value);
                        }
                    }
                }
                break;
                
            case 'Backspace':
                // 退格键仅用于删除输入框中的文字，不删除已添加的标签
                // 标签只能通过点击 × 按钮删除
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                this.navigateSuggestions(1);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.navigateSuggestions(-1);
                break;
                
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }
    
    // 处理空格输入（延迟处理，避免输入法冲突）
    handleSpaceInput() {
        const value = this.textInput.value.trim();
        if (value && !this.isComposing && !this.isProbablyPinyin(this.textInput.value)) {
            if (this.selectedSuggestion >= 0) {
                const suggestion = this.suggestions[this.selectedSuggestion];
                this.addTag(suggestion.name);
            } else {
                this.addTag(value);
            }
        }
    }
    
    // 检测是否可能是拼音输入
    isProbablyPinyin(text) {
        if (!text || typeof text !== 'string') return false;
        
        const trimmed = text.trim();
        
        // 如果已经包含中文字符，不是拼音
        if (/[\u4e00-\u9fff]/.test(trimmed)) {
            return false;
        }
        
        // 如果是纯数字或符号，不是拼音
        if (/^[0-9\s\W]+$/.test(trimmed)) {
            return false;
        }
        
        // 如果长度很长，可能不是拼音
        if (trimmed.length > 12) {
            return false;
        }
        
        // 检查是否符合拼音模式
        const pinyinPattern = /^[a-z]+$/i;
        const commonPinyinSyllables = [
            'zh', 'ch', 'sh', 'ang', 'ing', 'ong', 'ai', 'ao', 'ei', 'ou',
            'an', 'en', 'in', 'un', 'iang', 'iong', 'uang', 'uan'
        ];
        
        // 如果是纯英文且长度适中，可能是拼音
        if (pinyinPattern.test(trimmed) && trimmed.length >= 2 && trimmed.length <= 8) {
            // 检查是否包含常见拼音音节
            const hasCommonSyllables = commonPinyinSyllables.some(syllable => 
                trimmed.includes(syllable)
            );
            
            // 如果包含常见音节，或者是短的英文序列，认为是拼音
            return hasCommonSyllables || trimmed.length <= 4;
        }
        
        return false;
    }
    
    addTag(tagName) {
        const cleanTag = tagName.trim();
        
        if (!cleanTag || this.tags.includes(cleanTag)) {
            this.textInput.value = '';
            this.hideSuggestions();
            return;
        }
        
        if (this.tags.length >= this.options.maxTags) {
            this.textInput.value = '';
            this.hideSuggestions();
            return;
        }
        
        this.tags.push(cleanTag);
        this.renderTags();
        this.updateOriginalInput();
        this.saveTagHistory(cleanTag);
        
        this.textInput.value = '';
        this.hideSuggestions();
        this.textInput.focus();
    }
    
    removeTag(index) {
        if (index >= 0 && index < this.tags.length) {
            this.tags.splice(index, 1);
            this.renderTags();
            this.updateOriginalInput();
        }
    }
    
    renderTags() {
        this.tagsContainer.innerHTML = '';
        
        this.tags.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag-item';
            tagEl.innerHTML = `
                <span class="tag-name">#${tag}</span>
                <button type="button" class="tag-remove" data-index="${index}">×</button>
            `;
            
            // 绑定删除事件
            const removeBtn = tagEl.querySelector('.tag-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTag(parseInt(e.target.dataset.index));
            });
            
            this.tagsContainer.appendChild(tagEl);
        });
    }
    
    showSuggestions(query) {
        const filtered = this.getSuggestions(query);
        
        if (filtered.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestions = filtered;
        this.selectedSuggestion = -1;
        this.renderSuggestions();
        this.suggestionsContainer.style.display = 'block';
    }
    
    hideSuggestions() {
        this.suggestionsContainer.style.display = 'none';
        this.selectedSuggestion = -1;
    }
    
    getSuggestions(query) {
        const history = this.getTagHistory();
        const queryLower = query.toLowerCase();
        
        return history
            .filter(tag => 
                tag.name.toLowerCase().includes(queryLower) && 
                !this.tags.includes(tag.name)
            )
            .sort((a, b) => {
                // 精确匹配优先
                const aExact = a.name.toLowerCase().startsWith(queryLower);
                const bExact = b.name.toLowerCase().startsWith(queryLower);
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // 按使用频率排序
                return b.count - a.count;
            })
            .slice(0, 8);
    }
    
    renderSuggestions() {
        this.suggestionsContainer.innerHTML = '';
        
        this.suggestions.forEach((suggestion, index) => {
            const suggestionEl = document.createElement('div');
            suggestionEl.className = `tag-suggestion ${index === this.selectedSuggestion ? 'selected' : ''}`;
            suggestionEl.innerHTML = `
                <span class="suggestion-name">#${suggestion.name}</span>
                <span class="suggestion-count">${suggestion.count}</span>
            `;
            
            suggestionEl.addEventListener('click', () => {
                this.addTag(suggestion.name);
            });
            
            this.suggestionsContainer.appendChild(suggestionEl);
        });
    }
    
    navigateSuggestions(direction) {
        if (this.suggestions.length === 0) return;
        
        this.selectedSuggestion += direction;
        
        if (this.selectedSuggestion < -1) {
            this.selectedSuggestion = this.suggestions.length - 1;
        } else if (this.selectedSuggestion >= this.suggestions.length) {
            this.selectedSuggestion = -1;
        }
        
        this.renderSuggestions();
    }
    
    updateOriginalInput() {
        this.input.value = this.tags.join(', ');
        
        // 触发change事件
        const event = new Event('change', { bubbles: true });
        this.input.dispatchEvent(event);
    }
    
    // 标签历史记录管理
    getTagHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('favmanager_tag_history') || '{}');
            return Object.entries(history)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);
        } catch (error) {
            return [];
        }
    }
    
    saveTagHistory(tagName) {
        try {
            const history = JSON.parse(localStorage.getItem('favmanager_tag_history') || '{}');
            history[tagName] = (history[tagName] || 0) + 1;
            localStorage.setItem('favmanager_tag_history', JSON.stringify(history));
        } catch (error) {
            console.error('保存标签历史失败:', error);
        }
    }
    
    loadTagHistory() {
        // 预加载一些常用标签历史
        const defaultTags = [
            '技术', '学习', '工具', '文档', '教程', '开发', '前端', '后端',
            '设计', '灵感', '资源', '新闻', '娱乐', '视频', '音乐', '游戏',
            '工作', '生活', '健康', '美食', '旅行', '购物', '财经', '科技'
        ];
        
        const history = this.getTagHistory();
        const existingTags = new Set(history.map(t => t.name));
        
        const newTags = {};
        defaultTags.forEach(tag => {
            if (!existingTags.has(tag)) {
                newTags[tag] = 1;
            }
        });
        
        if (Object.keys(newTags).length > 0) {
            try {
                const currentHistory = JSON.parse(localStorage.getItem('favmanager_tag_history') || '{}');
                const updatedHistory = { ...currentHistory, ...newTags };
                localStorage.setItem('favmanager_tag_history', JSON.stringify(updatedHistory));
            } catch (error) {
                console.error('初始化标签历史失败:', error);
            }
        }
    }
    
    // 公共API
    setTags(tags) {
        this.tags = Array.isArray(tags) ? [...tags] : [];
        this.renderTags();
        this.updateOriginalInput();
    }
    
    getTags() {
        return [...this.tags];
    }
    
    clear() {
        this.tags = [];
        this.renderTags();
        this.updateOriginalInput();
        this.textInput.value = '';
        this.hideSuggestions();
    }
    
    focus() {
        this.textInput.focus();
    }
}

// 将 TagInput 类暴露到全局作用域
window.TagInput = TagInput;

console.log('Tag Input 组件加载完成');