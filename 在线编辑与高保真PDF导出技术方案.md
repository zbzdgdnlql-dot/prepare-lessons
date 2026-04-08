# 备课系统二期：在线编辑与高保真 PDF 导出技术实现方案

本方案旨在解决备课包生成后的“最后一公里”问题：允许老师在网页端对 AI 生成的内容进行二次编辑，并能将最终确认的内容以**“所见即所得”的高保真 PDF 格式**导出，用于实际教学打印。

---

## 一、 核心需求分析

1. **网页端直接编辑 (富文本/Markdown 编辑)**
   - **痛点**：AI 生成的内容虽好，但老师往往需要微调（增删例句、修改重难点标记）。
   - **需求**：生成结果不应只是静态文本，而应无缝转化为可编辑状态，且不能丢失原有的结构（表格、标题、粗体）。
2. **高保真 PDF 导出 (所见即所得)**
   - **痛点**：传统的纯前端 PDF 导出（如 `html2canvas` + `jsPDF`）经常出现表格截断、文字模糊、分页错断等严重影响美观的问题。
   - **需求**：导出的 PDF 必须排版精美，版式与网页展示完全一致，支持标准的 A4 纸张分页逻辑。

---

## 二、 前端实现方案：Markdown 富文本双向编辑

鉴于 AI 底层返回的是高度结构化的 Markdown（包含表格、层级标题），单纯的纯文本框无法满足体验要求，必须引入支持 Markdown 的所见即所得（WYSIWYG）编辑器。

### 1. 编辑器选型推荐
推荐使用 **[Milkdown](https://github.com/Milkdown/milkdown)** 或 **[ByteMD](https://bytemd.js.org/)** 或 **[Vditor](https://github.com/Vanessa219/vditor)**。
- **原因**：它们原生支持 Markdown 语法，且提供“所见即所得”或“双栏分屏”模式，能完美解析并渲染表格，用户体验极佳。

### 2. 交互流程设计
1. **接收数据**：前端接收到后端（或流式）返回的 Markdown 字符串。
2. **初始化编辑器**：将该 Markdown 字符串作为 `initialValue` 注入编辑器组件。
3. **老师编辑**：老师在可视化界面直接修改内容（如在表格中加减行、修改文字）。
4. **状态同步**：老师点击“保存”或“导出”时，编辑器组件实时吐出最新的 Markdown 字符串（`getMarkdown()`），并提交给后端。

---

## 三、 后端实现方案：高保真 PDF 导出 (核心难点)

为了保证“版式与网页完全相同”且“分页完美不截断”，**强烈建议将 PDF 生成的重任交给后端（基于 Headless Browser 无头浏览器方案）**，而非纯前端生成。

### 1. 为什么推荐后端生成 PDF？
前端生成（如 `jsPDF`）本质上是把网页“截图”再贴到 PDF 里，不仅文字不可复制、文件体积大，而且遇到跨页的长表格时极其容易从中腰斩。后端使用无头浏览器（如 Puppeteer 或 Playwright）是利用真正的浏览器排版引擎去“打印” PDF，支持原生的 CSS 分页控制，画质清晰且文字可复制。

### 2. 后端技术栈选型
- **Node.js 环境**：推荐使用 **[Puppeteer](https://pptr.dev/)** 或 **[Playwright](https://playwright.dev/)**。
- **Python 环境**：推荐使用 **[Playwright for Python](https://playwright.dev/python/)** 或 **WeasyPrint**。

### 3. 实现步骤 (Step-by-Step)

#### 步骤一：构建 HTML 渲染模板
后端需要准备一个静态的 HTML 模板文件（如 `template.html`），该模板内部引入与前端网页**完全一致的 CSS 样式文件**（包括字体、表格样式、颜色）。

#### 步骤二：Markdown 转 HTML (后端解析)
后端接收到前端传来的最新 Markdown 文本后，使用 Markdown 解析库（如 Node 的 `marked` 或 Python 的 `markdown`，必须开启表格 `gfm` 支持），将其转换为 HTML 字符串。

#### 步骤三：注入模板并处理分页 CSS
将上一步的 HTML 注入到模板中，**关键在于添加打印专用的 CSS 规则**，防止表格或标题在页面底部被截断：

```css
/* 打印专用 CSS (Print Media Queries) */
@media print {
  @page {
    size: A4;
    margin: 20mm;
  }
  
  /* 防止标题出现在页面最底部 */
  h1, h2, h3 {
    page-break-after: avoid;
  }

  /* 防止表格被切断，尽量让整个表格在同一页，或者表头能在下一页重复 */
  table { 
    page-break-inside: auto; 
  }
  tr { 
    page-break-inside: avoid; 
    page-break-after: auto; 
  }
  thead { 
    display: table-header-group; /* 表格跨页时，下一页自动重复表头 */
  }

  /* 隐藏不需要打印的网页元素（如果有的话） */
  .no-print {
    display: none;
  }
}
```

#### 步骤四：调用无头浏览器生成 PDF
以 Python + Playwright 为例的伪代码逻辑：

```python
from playwright.sync_api import sync_playwright

def generate_pdf_from_html(html_content, output_path):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 将组装好的包含 CSS 的完整 HTML 设置到页面中
        page.set_content(html_content, wait_until="networkidle")
        
        # 调用原生打印 PDF 功能
        page.pdf(
            path=output_path,
            format="A4",
            print_background=True, # 打印背景色（重要，否则表格背景可能丢失）
            margin={"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"}
        )
        browser.close()
```

#### 步骤五：返回文件流
后端生成 PDF 文件后，以二进制流（`application/pdf`）的形式返回给前端，前端触发浏览器的下载行为。

---

## 四、 验收标准 (Acceptance Criteria)

1. **编辑体验**：用户在网页端可以直接点击修改生成的文本、增删表格行，操作习惯类似 Notion 或飞书文档，无需手写 Markdown 源码。
2. **高保真一致性**：导出的 PDF 文件在字体、字号、表格边框、背景色上与网页展示达到 95% 以上的一致。
3. **完美分页**：PDF 在换页时，绝对不能出现文字被劈成上下两半的情况；如果一个大表格跨页，下一页必须自动带上表格的表头（`thead`）。
4. **文字属性**：导出的 PDF 必须是矢量文本（可选中文本复制），而非图片拼接的假 PDF。