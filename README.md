# 📚 FavManager - 收藏夹管理器

一个简洁高效的Chrome扩展收藏夹管理器。

## 🏗 项目结构

```
favmanager/
├── index.html                 # 项目入口页面
├── manifest.json             # Chrome扩展配置文件
├── icons/                    # 应用图标
├── src/                      # 源代码目录
│   ├── pages/               # 页面文件
│   │   ├── popup.html       # 弹窗页面
│   │   └── dashboard.html   # 仪表板页面
│   ├── assets/              # 静态资源
│   │   ├── popup.css        # 弹窗样式
│   │   └── dashboard.css    # 仪表板样式
│   ├── core/                # 核心功能模块
│   │   ├── background.js    # 后台服务
│   │   ├── content.js       # 内容脚本
│   │   ├── storage.js       # 数据存储
│   │   └── bookmarks.js     # 书签管理
│   ├── components/          # UI组件
│   │   ├── popup.js         # 弹窗组件
│   │   ├── dashboard.js     # 仪表板组件
│   │   └── tag-input.js     # 标签输入组件
│   ├── legacy/              # 旧版代码
│   │   └── storage_old.js   # 旧版存储实现
│   └── utils/               # 工具文件
│       └── generate_icons.py  # 图标生成工具
```

## 🚀 功能特性

- 📋 多种视图模式（列表、大图、普通）
- 🔍 强大的搜索和筛选功能
- 🏷️ 标签管理系统
- 📁 文件夹组织
- ⭐ 收藏星标功能
- 📝 书签备注和描述
- ⚡ 响应式设计，适配各种屏幕

## 🛠 技术栈

- **前端**: Vanilla JavaScript, HTML5, CSS3
- **扩展API**: Chrome Extensions API v3
- **存储**: Chrome Storage API + Chrome Bookmarks API
- **架构**: 模块化设计，组件化开发

## 📦 安装使用

1. 克隆项目到本地
2. 打开Chrome扩展管理页面 (chrome://extensions/)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录


## 📋 更新日志

### v1.0.0
- ✨ 重构项目目录结构
- 🏗️ 模块化架构设计
- 🎨 优化界面交互体验
- 🔧 修复图标缩放问题
- 📱 统一界面设计

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 发起 Pull Request

## 📄 许可证

MIT License