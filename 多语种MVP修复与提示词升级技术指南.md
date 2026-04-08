# 多语种备课系统：首期 Bug 修复与提示词（Prompt）升级技术指南

在多语种MVP版本初步落地后，我们发现核心逻辑上存在“界面多语言（i18n）”与“目标教学语言（Target Language）”混淆的严重Bug，导致生成的备课包质量不达标。本指南旨在指导技术团队快速修复现有Bug，并完成专业级提示词的替换升级。

---

## 🐞 核心 Bug 修复清单 (Bug Fixes)

### Bug 1：显示语言与教学语言混淆（UI变语种）
- **现象**：用户在下拉框切换语种时，整个系统的界面（UI）变成了对应的外语，但系统并未真正感知到“需要生成该外语的备课包”。
- **技术成因**：前端误将语种选择器绑定到了全局的 `i18n.locale` 或类似修改系统显示语言的变量上。
- **修复方案**：
  1. **解耦状态**：将界面显示语言（`display_language`）固定/默认设为 `zh-CN`（中文）。
  2. **新增状态**：在全局状态（如 Redux/Zustand）中新增 `target_learning_language`（目标教学语言）变量，用于记录用户当前选择备课的语种（`fr`, `de`, `es`）。
  3. **UI修改**：下拉框组件只修改 `target_learning_language` 的值，绝不能触发 UI 语言库的切换。

### Bug 2：AI 系统提示词“角色硬编码”错误
- **现象**：无论用户选择德语还是西语，AI 生成的备课包都自称“法语老师”，甚至套用法语法则。
- **技术成因**：在调用 LLM (大语言模型) 接口时，系统提示词（System Prompt）里写死了“你是一位法语老师”的字符串。
- **修复方案**：彻底废弃代码里写死的内联（Inline）提示词，改为**动态读取外部 Markdown 配置文件**（见下文“提示词升级”部分）。

### Bug 3：潜在的相关隐性 Bug（请研发自查）
1. **等级参数校验不匹配**：法语/德语/西语均使用 CEFR（A1-C2），如果此前代码里写死了验证“必须是法语的 A1-C2”，需要将校验逻辑放宽为“当前选定目标语种的等级体系”。
2. **LLM 回复语言失控**：如果未在提示词中强调，LLM 可能会用纯德文/西文回复整个备课包。**修复要求**：调用参数或外层封装中必须锁定“使用简体中文（配合目标语言的例句）输出”。
3. **前端缓存/路由问题**：切换 `target_learning_language` 时，旧的生成结果未清空，导致语种串词。**修复要求**：切换目标语种时，必须触发编辑器或结果展示区的 `reset` 动作。

---

## 🚀 核心改进：专业提示词数据库化与动态加载 (Prompt Upgrade)

为了提升各语种备课包的专业度并**实现产品端对提示词的热更新（无需技术发版）**，现有的硬编码提示词机制必须全面重构为**基于数据库管理的动态配置方案**。

### 1. 数据库表结构设计 (`Prompt_Templates` 表)
新增一张表用于存储各语种的 System Prompt 模板：

| 字段名 | 类型 | 说明 | 示例值 |
|---|---|---|---|
| `id` | INT | 主键 | 1 |
| `language_code` | VARCHAR | 目标教学语言代号 (唯一键) | `fr`, `de`, `es` |
| `prompt_content` | TEXT/LONGTEXT | 提示词 Markdown 原文 | (内容包含 `{{目标级别}}` 等变量) |
| `version` | VARCHAR | 版本号 | `v1.0` |
| `updated_at` | DATETIME | 更新时间 | |

**数据初始化**：
技术侧需在数据库初始化时，将产品提供的三个文件内容写入表内：
- `fr` 对应 `Prompt_French_FLE.md` (涵盖：FLE、行动导向法、法语国家共同体)
- `de` 对应 `Prompt_German_DaF.md` (涵盖：DaF、发现式语法、D-A-CH-L国情学)
- `es` 对应 `Prompt_Spanish_ELE.md` (涵盖：ELE、认知语法、泛西语文化)

### 2. 后端动态加载与变量替换逻辑
后端在接收到生成备课包的请求时，不再读取本地文件，而是从数据库中查询对应的模板：

```javascript
// 伪代码示例
// 1. 根据前端传来的 target_learning_language 从数据库查询系统默认提示词模板
const promptRecord = await db.PromptTemplates.findOne({ where: { language_code: targetLanguage } });
if (!promptRecord) throw new Error("不支持的语种提示词");

let systemPrompt = promptRecord.prompt_content;

// 2. 动态变量替换 (基础变量)
systemPrompt = systemPrompt.replace('{{目标级别}}', userSelectedLevel);
systemPrompt = systemPrompt.replace('{{课文内容}}', userPastedText);
```

### 3. 用户自定义指令的优先级合并 (关键逻辑)
产品在“高级设置”中允许用户输入自定义要求（如“侧重发音纠正”、“少讲语法多讲文化”等）。**技术侧必须保证用户的自定义指令具有最高优先级**，能够覆盖或补充系统默认提示词。

**拼装方案推荐（系统角色 + 用户指令）**：
不建议直接用用户输入的文本完全替换系统提示词（这会导致输出格式完全崩坏），而应该采用“上下文追加”的方式。

```javascript
// 伪代码示例：将用户自定义要求追加到系统提示词的最后，或作为独立系统指令
let finalSystemPrompt = systemPrompt;

if (userCustomPrompt && userCustomPrompt.trim() !== '') {
    finalSystemPrompt += `\n\n# User Specific Instructions (Highest Priority)\n用户提出了以下特殊要求，你在生成内容时必须优先满足这些要求，哪怕它与上述某些标准冲突：\n${userCustomPrompt}`;
}

// 3. 发送给 LLM
// 将组装好的 finalSystemPrompt 作为 messages[0].content (role: 'system') 发送
```

### 4. CMS 后台管理需求 (Admin Panel)
为配合产品运营，技术需在内部管理后台（CMS）中提供一个简单的“提示词管理”页面：
- **功能**：支持按照 `language_code` 检索、查看、编辑和保存 `prompt_content`。
- **价值**：产品经理发现大模型生成的某个模块不够好时，可以直接在后台修改 Markdown 提示词，即时生效，彻底解放研发生产力。

---

## 🎯 验收标准 (Acceptance Criteria)
1. **界面稳定性**：无论切换为法、德、西任何语种，网站界面的所有菜单、按钮**均保持中文**。
2. **角色准确性**：切换为“德语”并生成备课包时，返回内容必须严格按照 `Prompt_German_DaF.md` 的格式输出，包含“词汇精讲 (Wortschatz)”、“语法精讲 (Grammatik)”等专属德语模块。
3. **内容无串词**：生成西语内容时，绝不能出现“法语国家共同体”、“联诵”等属于其他语种的专有教学概念。

---

## 🖥️ 前端展示要求：Markdown 渲染支持

由于新的提示词强制要求大模型返回高度结构化的 Markdown 格式（包含多级标题、表格、粗体、代码块等），前端在渲染生成结果时必须具备完善的 Markdown 解析能力。

- **现状确认**：请前端检查目前的生成结果展示区，是否只是简单的文本拼接或仅支持换行。
- **升级建议**：若目前渲染较弱，请引入成熟的 Markdown 渲染库（例如 React 生态下的 `react-markdown` 配合 `remark-gfm` 插件以支持表格渲染）。
- **样式要求**：需要为生成的 Markdown 编写基础的 CSS 样式，确保**表格边框清晰**、**各级标题间距合理**、**重点词汇（粗体）醒目**。