# 知屿 · 个人知识库

用来整理产品需求、项目文档、工作笔记和模板。首页自带三篇虚构示例，可在 `content/` 中删除或替换。

[打开知识库](https://mengxianying.github.io/personal-knowledge-base/)

## 登录知识库

管理、浏览、分享和导入入口只向通过 GitHub 验证的 `mengxianying` 开放。首次使用时，在 GitHub 创建细粒度访问令牌，选择 `personal-knowledge-base` 仓库，并给 Contents「只读」权限。将令牌输入知识库登录页完成验证。刷新或退出后需要重新验证。

密码分享使用独立的只读访客链接。公开仓库中的 Markdown 文件仍按 GitHub 的仓库可见性提供访问。

## 从飞书导入

1. 在飞书打开可访问的文档，复制正文。在网站点击「导入文档」，粘贴到正文框，也可以上传 Markdown 或 TXT 文件。
2. 填写标题、分类、标签和可选的原文链接，再点击「保存到本机」。
3. 在「本机文档」里打开文章，检查标题、列表和表格。受飞书权限保护的图片或附件可能需要单独处理，公开版请换成可访问的资源。
4. 要发布这篇文章，点击「发布到 GitHub」，下载 Markdown，再上传到仓库的 `content/` 目录并提交到 `main`。GitHub Actions 会重新部署网站。

浏览器本机的文档和收藏按网站地址保存。换设备、浏览器或网站地址时可下载 Markdown 后重新导入。提交到公开 GitHub 仓库的文档及原文链接，均可由访客查看。

在侧栏打开「后台管理」可编辑和删除文档。本机文档的删除需要确认。已发布文档通过 GitHub 修改，提交到 `main` 后会自动更新网站。

## 密码分享

1. 打开要分享的分类、搜索结果或单篇文章，点击右上角「分享」。弹窗会显示要分享的文章数量，并生成本次的随机访问密码。
2. 复制访问密码，下载加密文件。通过「上传加密文件」在 GitHub 把该文件提交到 `main` 分支的 `public/shares/`，保留下载时的文件名。
3. 部署完成后，在弹窗中检查发布状态并复制访客链接，将链接和密码分别发给访客。访客可在浏览器中解锁、搜索和阅读共享文章，无需 GitHub 账号。

分享保留生成时的内容。需要分享更新后的版本时，重新生成链接和密码。飞书等外部来源依然按各自的权限规则打开。

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
