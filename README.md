# 知屿 · 个人知识库

用来整理产品需求、项目文档、工作笔记和模板。首页自带三篇虚构示例，可在 `content/` 中删除或替换。

[打开知识库](https://mengxianying.github.io/personal-knowledge-base/)

## 从飞书导入

1. 在飞书打开可访问的文档，复制正文。在网站点击「导入文档」，粘贴到正文框，也可以上传 Markdown 或 TXT 文件。
2. 填写标题、分类、标签和可选的原文链接，再点击「保存到本机」。
3. 在「本机文档」里打开文章，检查标题、列表和表格。受飞书权限保护的图片或附件可能需要单独处理，公开版请换成可访问的资源。
4. 要发布这篇文章，点击「发布到 GitHub」，下载 Markdown，再上传到仓库的 `content/` 目录并提交到 `main`。GitHub Actions 会重新部署网站。

浏览器本机的文档和收藏按网站地址保存。换设备、浏览器或网站地址时可下载 Markdown 后重新导入。提交到公开 GitHub 仓库的文档及原文链接，均可由访客查看。

在文档列表或详情页可编辑和删除文档。本机文档的删除需要确认。已发布文档通过 GitHub 修改，提交到 `main` 后会自动更新网站。

## 本地运行

使用 Node.js 24。

```bash
npm ci
npm run dev
npm test
npm run build
```

## 部署

把项目推送到 GitHub 仓库的 `main` 分支，在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。打开 **Actions**，运行 **Deploy knowledge base to GitHub Pages**。后续向 `main` 提交会自动发布。

文档支持 Markdown 和可选的 YAML 元数据。

```markdown
---
title: 需求文档名称
category: 产品需求
tags: [评审, 工具]
date: 2026-11-25
---

## 背景

写下需要解决的问题。
```
