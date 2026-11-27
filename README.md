# 知屿 · 个人知识库

用来整理产品需求、项目文档、工作笔记和模板。首页自带三篇虚构示例，可在 `content/` 中删除或替换。

[打开知识库](https://mengxianying.github.io/personal-knowledge-base/)

## 登录知识库

管理、浏览、分享和导入入口只向通过 GitHub 验证的 `mengxianying` 开放。创建细粒度访问令牌时选择 `personal-knowledge-base` 和 `personal-knowledge-base-private` 两个仓库，并授予 Contents「读写」权限。将令牌输入知识库登录页完成验证。刷新或退出后需要重新验证。

文章分享使用独立的只读访客链接。公开仓库中的 Markdown 文件仍按 GitHub 的仓库可见性提供访问。

## 从飞书导入

1. 在飞书打开可访问的文档，复制正文。在网站点击「导入文档」，粘贴到正文框，也可以上传 Markdown 或 TXT 文件。
2. 填写标题、分类、标签和可选的原文链接，再点击「保存到云端」。
3. 在文档分类里打开文章，检查标题、列表和表格。受飞书权限保护的图片或附件可能需要单独处理，公开版请换成可访问的资源。
4. 要发布这篇文章，点击「发布到 GitHub」，下载 Markdown，再上传到仓库的 `content/` 目录并提交到 `main`。GitHub Actions 会重新部署网站。

文章正文保存在 GitHub 私有仓库 `personal-knowledge-base-private`。在新设备登录后即可打开云端文章。旧版本的本机文章可在后台编辑并保存到云端。收藏记录保存在当前浏览器。公开 GitHub 仓库里的文章及原文链接可由访客查看。

在侧栏打开「后台管理」可编辑和删除云端文档，删除需要确认。公开仓库里的文章可在 GitHub 上修改。

## 文章分享

用当前仓库的 Contents「读写」令牌登录。在文章详情点击「分享」，等链接生成后复制发给访客。持有完整链接的人可以免登录、免输密码打开该篇文章。

分享保留生成时的正文和配图，加密文件保存在仓库的 `article-shares` 分支。文章更新后，可在重新打开的详情页生成新链接。此前的密码分享链接仍通过原入口打开。

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
