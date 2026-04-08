/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutPreset, ModelOption, PresetStyle, FontOption, Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  {
    id: 'general',
    name: '通用/简洁',
    description: '适用于大多数日常场景，平衡清晰度与美观。',
    tone: '中立、清晰、客观',
    logic: '标准逻辑结构：背景-现状-方案-总结'
  },
  {
    id: 'academic',
    name: '学术/医疗',
    description: '注重数据准确性与文案严谨性，逻辑严密。',
    tone: '严谨、专业、理性、客观',
    logic: '科学逻辑结构：背景-方法-结果-讨论-结论。必须强调数据支撑，避免夸张修辞。'
  },
  {
    id: 'business',
    name: '商务/汇报',
    description: '结果导向，清晰沉稳，强调关键成果。',
    tone: '稳重、专业、有力、结果导向',
    logic: '管理逻辑结构：目标-进展-成果-问题-对策。文案应短促有力，突出核心指标。'
  },
  {
    id: 'creative',
    name: '创意/策划',
    description: '基于内容深度发挥，故事性强，充满感性。',
    tone: '感性、激情、富有想象力、故事感',
    logic: '叙事逻辑结构：冲突-解决-愿景。允许使用修辞手法，建立情感共鸣。'
  },
  {
    id: 'ted',
    name: 'TED 演讲',
    description: '启发性强，以观点为核心，极简文案。',
    tone: '启发性、个人化、深刻、极简',
    logic: '观点逻辑结构：一个核心观点-多个支撑故事-行动号召。每页文案极少，强调视觉冲击力。'
  }
];

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'center-hero', name: '中心英雄', description: '大标题居中，背景沉浸，极简封面', iconType: 'center-hero' },
  { id: 'split-left', name: '左文右图', description: '经典左右分割，逻辑清晰，空间层次分明', iconType: 'split-left' },
  { id: 'split-right', name: '左图右文', description: '视觉引导，平衡感强，多层阴影叠加', iconType: 'split-right' },
  { id: 'grid-3', name: '三栏网格', description: '并列内容展示，整齐有序，模块化深度', iconType: 'grid-3' },
  { id: 'top-bottom', name: '上下结构', description: '标题在上，内容在下，垂直空间延伸', iconType: 'top-bottom' },
  { id: 'full-image', name: '全屏背景', description: '视觉冲击力最强，沉浸式图层', iconType: 'full-image' },
  { id: 'grid-2', name: '两栏网格', description: '并列对比或展示，清晰的视觉边界', iconType: 'grid-2' },
  { id: 'quote', name: '大字金句', description: '强调核心观点，悬浮排版', iconType: 'quote' },
  { id: 'feature-list', name: '功能列表', description: '多点位详细说明，错落有致的层级', iconType: 'feature-list' },
  { id: 'bento-grid', name: '多维网格', description: '模块化展示，玻璃拟态层级，信息丰富且有序', iconType: 'grid-3' },
  { id: 'data-focus', name: '数据驱动', description: '突出核心指标，高对比度卡片层叠', iconType: 'grid-2' },
  { id: 'expert-quote', name: '专家背书', description: '强调权威观点与引用，深度阴影卡片', iconType: 'quote' },
  { id: 'timeline-flow', name: '时间流向', description: '展示发展历程或步骤，线性空间逻辑', iconType: 'top-bottom' },
];

export const MODELS: ModelOption[] = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite", description: "输入多模态，输出文本，性价比高（推荐）" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "输入多模态，输出文本，" }
];

export const DEFAULT_COLORS = ["#F5F5F4", "#059669", "#D1D5DB", "#141414"];

export const SCRIPT_SYSTEM_INSTRUCTION = (scenario: Scenario) => `You are a professional presentation scriptwriter and content strategist specializing in ${scenario.name} style.
Your task is to take a long text input and transform it into a structured slide-by-slide outline.

TONE OF VOICE: ${scenario.tone}
CONTENT LOGIC: ${scenario.logic}

FORMAT RULES:
For each slide, use the following EXACT format:

[SLIDE]
ID: unique-id
TITLE: Slide Title
SUBTITLE: Supporting subtitle
BODY: Comprehensive description of the content, technical details, and logic.
LAYOUT: one of: 'center-hero', 'split-left', 'split-right', 'grid-3', 'top-bottom', 'full-image', 'bento-grid', 'data-focus', 'expert-quote', 'timeline-flow'
LAYOUT_DESC: Brief explanation of layout choice
DATA: label|value|unit, label|value|unit (comma separated list of pipe-separated values, or leave empty)
QUOTE: text|author (pipe separated, or leave empty)
HIGHLIGHTS: phrase 1, phrase 2 (comma separated, or leave empty)
[END_SLIDE]

CONTENT RULES:
1. BREAKDOWN: ${scenario.id === 'ted' ? 'Split into 5-8 high-impact slides.' : 'Split into 5-15 logical slides.'}
2. NARRATIVE: Ensure a clear flow.
3. BODY: Max 200 words. Include technical terms and core logic.
4. DATA: Max 3 items per slide.
5. QUOTE: Max 1 per slide. Must be meaningful.
6. LANGUAGE: Use the same language as the input.

DO NOT use JSON. Use the [SLIDE]...[END_SLIDE] blocks.`;

export const PRESET_STYLES: PresetStyle[] = [
  {
    id: "tech",
    name: "科技深蓝",
    style: "未来感、高科技、深色调",
    requirements: "发光效果、细线条、网格背景、青色装饰",
    colors: ["#020617", "#22D3EE", "#1E293B", "#F8FAFC"],
    isBuiltIn: true
  },
  {
    id: "minimal",
    name: "极简白灰",
    style: "纯净、呼吸感、极简主义",
    requirements: "大量留白、无边框、柔和阴影、精致排版",
    colors: ["#FFFFFF", "#18181B", "#F4F4F5", "#18181B"],
    isBuiltIn: true
  },
  {
    id: "business",
    name: "商务金黑",
    style: "高端、稳重、专业商务",
    requirements: "直角边框、金色点缀、对比鲜明、权威感",
    colors: ["#000000", "#D4AF37", "#262626", "#FFFFFF"],
    isBuiltIn: true
  },
  {
    id: "creative",
    name: "活力艺术",
    style: "孟菲斯风格、大胆、充满活力",
    requirements: "不规则形状、粗边框、高饱和度颜色、趣味性",
    colors: ["#FFF7ED", "#F97316", "#84CC16", "#000000"],
    isBuiltIn: true
  }
];

export const STYLE_KEYWORDS = ["极简", "科技感", "商务", "艺术", "扁平化", "拟物化", "孟菲斯", "赛博朋克", "复古", "清新"];
export const REQ_KEYWORDS = ["大圆角", "玻璃拟态", "渐变背景", "阴影效果", "粗边框", "细线条", "居中排版", "左右分割"];

export const FONTS: FontOption[] = [
  { name: "Inter", family: "Inter, sans-serif", category: "sans" },
  { name: "Roboto", family: "Roboto, sans-serif", category: "sans" },
  { name: "Open Sans", family: "'Open Sans', sans-serif", category: "sans" },
  { name: "Playfair Display", family: "'Playfair Display', serif", category: "display" },
  { name: "Libre Baskerville", family: "'Libre Baskerville', serif", category: "serif" },
  { name: "Cormorant Garamond", family: "'Cormorant Garamond', serif", category: "serif" },
  { name: "JetBrains Mono", family: "'JetBrains Mono', monospace", category: "mono" },
  { name: "Fira Code", family: "'Fira Code', monospace", category: "mono" },
  { name: "Space Grotesk", family: "'Space Grotesk', sans-serif", category: "display" },
  { name: "Outfit", family: "Outfit, sans-serif", category: "display" },
];

export const CHANGELOG = [
  {
    version: "6.0.0",
    date: "2024-03-04",
    title: "云端同步与跨设备办公",
    items: [
      "支持基于 API Key 的云端数据同步，实现跨设备、跨浏览器办公",
      "引入 SQLite 云端数据库，数据持久化存储，无惧清理缓存",
      "支持本地数据自动迁移至云端，无缝升级体验"
    ],
    details: `### 核心更新内容：

#### 1. 云端同步架构 (Cloud Sync)
*   **全平台通用**：现在您的项目不再局限于单一设备。只要在任何电脑、任何浏览器输入同一个 API Key，您的所有项目和风格都会瞬间同步。
*   **实时保存**：每一次修改都会自动同步到云端服务器，确保数据实时更新。

#### 2. 安全与隐私
*   **匿名关联**：我们不会直接存储您的 API Key。系统使用 SHA-256 算法对 Key 进行哈希处理，将其作为唯一的身份标识符，确保您的隐私安全。
*   **数据隔离**：不同 API Key 之间的数据完全隔离，互不干扰。

#### 3. 自动迁移逻辑
*   **无感升级**：当您第一次登录新版本时，系统会自动检测您当前浏览器中的本地数据。如果云端尚无数据，系统会智能地将本地项目一键迁移至云端，确保您的创作不中断。

#### 4. 突破本地限制
*   **无惧清理**：即便您清理了浏览器缓存或重装了系统，只要重新输入 API Key，数据依然完好无损。
*   **容量翻倍**：摆脱了浏览器 LocalStorage 的 5MB 限制，支持存储更多、更复杂的幻灯片项目。`
  },
  {
    version: "5.0.0",
    date: "2024-03-04",
    title: "服务稳定性与容错增强",
    items: [
      "新增 AI 服务自动重试机制，大幅减少网络波动导致的失败",
      "引入全局 Toast 通知系统，提供更清晰的状态反馈",
      "优化错误处理逻辑，自动识别并拦截常见的网络异常"
    ],
    details: `### 核心更新内容：

#### 1. 自动重试机制 (Auto-Retry)
*   **智能识别**：系统现在能自动识别由于网络波动（如 XHR 错误、RPC 失败）导致的异常。
*   **静默重试**：在遇到此类非致命错误时，系统会自动进行最多 3 次指数退避重试，无需用户手动干预。
*   **成功率提升**：显著提升了在弱网或 API 服务不稳定环境下的生成成功率。

#### 2. 全局通知系统 (Toast System)
*   **实时反馈**：新增了位于屏幕底部的通知气泡，实时告知用户生成状态、错误信息或操作成功提示。
*   **视觉区分**：通过颜色区分错误（红色）、成功（绿色）和信息（白色），让反馈一目了然。

#### 3. 容错逻辑优化
*   **状态自动重置**：当生成最终失败时，系统会自动重置“生成中”状态，确保您可以立即调整输入并再次尝试，不再卡死。
*   **友好错误文案**：将晦涩的技术错误代码转化为易懂的中文提示，如“网络连接波动，请稍后重试”。`
  },
  {
    version: "4.0.0",
    date: "2024-03-04",
    title: "视觉设计中心上线",
    items: [
      "支持上传参考图自动提取设计风格（配色、样式、描述）",
      "新增 10+ 款精选字体选择，支持实时预览",
      "支持自定义设计风格的保存与复用"
    ],
    details: `### 核心更新内容：

#### 1. 视觉参考与自动提取 (Visual Extraction)
*   **上传参考图**：在设计面板顶部新增了“参考模板图”上传区域。
*   **AI 自动分析**：上传图片后，系统会立即调用 Gemini Vision 模型对图片进行深度扫描。
*   **一键同步**：AI 会自动提取出图片的整体风格描述、具体的样式要求、配色方案（4个核心色值），甚至会尝试匹配最接近的字体，并自动填充到下方的配置项中。
*   **生成联动**：在生成新的幻灯片时，这张参考图会作为“视觉上下文”发送给 AI，确保生成的 Draw.io 布局在间距、圆角和排版逻辑上与参考图高度一致。

#### 2. 深度字体定制 (Advanced Typography)
*   **海量字体库**：我引入了 10 种精选的 Google Fonts，涵盖了：
    *   **Sans (无衬线)**: Inter, Roboto, Open Sans（现代、清晰）
    *   **Serif (衬线)**: Libre Baskerville, Cormorant Garamond（优雅、经典）
    *   **Display (展示)**: Playfair Display, Space Grotesk, Outfit（独特、有冲击力）
    *   **Mono (等宽)**: JetBrains Mono, Fira Code（科技、极客）
*   **实时预览**：字体选择列表现在支持实时预览，您可以直观看到每种字体的效果。
*   **Draw.io 兼容性**：生成的 XML 代码会自动注入 \`fontFamily\` 属性。当您将代码导入 Draw.io 时，它会正确识别并应用这些自定义字体。`
  },
  {
    version: "3.0.0",
    date: "2024-03-04",
    title: "绘图引擎优化",
    items: [
      "支持免费层级模型调用，无需额外授权",
      "新增动态宽高比识别，支持生成 16:9、1:1 等多种比例贴图"
    ],
    details: `### 绘图引擎重大升级

为了让创作更加顺畅，我们对绘图引擎进行了深度优化：

1. **零门槛调用**：现在支持使用免费层级的 Gemini 模型进行绘图，不再强制要求绑定付费 API Key，让每一位用户都能体验 AI 绘图的乐趣。
2. **智能宽高比**：AI 现在能根据幻灯片的布局需求，自动决定贴图的比例。无论是 16:9 的背景大图，还是 1:1 的精致图标，都能精准生成，不再变形。
3. **性能提升**：优化了图片压缩算法，在保证清晰度的同时，显著减小了导出的 XML 文件体积，让 Draw.io 加载更迅速。`
  },
  {
    version: "2.0.0",
    date: "2024-03-04",
    title: "贴图资产增强",
    items: [
      "引入 AI 绘图功能，可为幻灯片生成定制化贴图",
      "优化贴图参数，确保在 Draw.io 中导入顺畅且不卡顿"
    ],
    details: `### 开启视觉创作新纪元

幻灯片不再只有文字和简单的形状：

1. **AI 贴图生成**：只需在描述中提到“需要一张科技感背景”或“插入一个机器人图标”，AI 就会自动为您绘制并嵌入幻灯片。
2. **无缝集成**：生成的图片直接嵌入在 Draw.io 的 XML 代码中，下载后直接打开即可看到，无需手动上传图片。
3. **样式一致性**：AI 会根据您设定的整体风格，自动调整生成图片的色调和构图。`
  },
  {
    version: "1.0.0",
    date: "2024-03-04",
    title: "基础版本发布",
    items: [
      "支持从文本、语音和图片生成 16:9 幻灯片",
      "支持导出 Draw.io XML 格式，完美兼容网页版编辑器",
      "具备基础的项目管理与历史记录功能"
    ],
    details: `### SlideGen AI 正式起航

这是我们的第一个版本，旨在重新定义幻灯片的制作流程：

1. **多模态输入**：支持打字、语音录入，甚至上传一张草图，AI 都能理解并转化为专业的幻灯片结构。
2. **Draw.io 深度兼容**：生成的 XML 文件遵循标准规范，您可以随时在 Draw.io 中进行二次编辑，拥有 100% 的控制权。
3. **项目持久化**：所有项目都保存在您的浏览器本地，安全且私密。`
  }
];

export const SYSTEM_INSTRUCTION = (
  style: string, 
  requirements: string, 
  colors: string[], 
  fontFamily: string, 
  context: string,
  config: {
    cornerRadius: number;
    shadowIntensity: string;
    safeMargin: number;
    showPageNumber: boolean;
    footerText: string;
    titleFontSize: number;
    subtitleFontSize: number;
    bodyFontSize: number;
  },
  styleGuide?: string,
  imageRequirements?: string,
  pageStyle?: string,
  decorativeIcon?: string,
  keyData?: { label: string; value: string; unit?: string }[],
  quotes?: { text: string; author?: string }[],
  highlights?: string[],
  suggestedLayout?: string,
  scenarioId?: string
) => `You are a world-class presentation designer, specializing in high-end editorial and tech-focused layouts.
Your task is to generate a structured JSON representation of a 16:9 PowerPoint slide that looks like it was crafted by a human pro.

DESIGN THEME:
- Style: ${style || "Atmospheric and Immersive"}
- Requirements: ${requirements || "Glassmorphism, layered depth, sophisticated typography"}
${pageStyle ? `- SPECIFIC PAGE STYLE (PRIORITY): ${pageStyle}` : ""}
${decorativeIcon ? `- PAGE THEME ICON: ${decorativeIcon} (Use this as a decorative element if appropriate)` : ""}
- Image & Background Requirements: ${imageRequirements || "High-quality, relevant to content, professional aesthetic"}
- Font: ${fontFamily}
${styleGuide ? `- Style Guide Document: ${styleGuide}` : ""}
- Palette (STRICT USAGE - YOU MUST USE THESE EXACT HEX CODES):
  1. BACKGROUND: ${colors[0]} (Use for main slide background or large sections)
  2. PRIMARY TEXT: ${colors[3]} (MANDATORY: Use this exact hex for all titles and body text)
  3. ACCENT: ${colors[1]} (Use for highlights, icons, and decorative lines)
  4. SECONDARY/MUTED: ${colors[2]} (Use for borders, secondary text, or subtle shapes)

CONTENT TO RENDER (PRIORITY):
${keyData && keyData.length > 0 ? `- KEY DATA: ${JSON.stringify(keyData)} (MANDATORY: Render these as high-impact cards or callouts)` : ""}
${quotes && quotes.length > 0 ? `- QUOTES/ENDORSEMENTS: ${JSON.stringify(quotes)} (MANDATORY: Render these in a distinct, sophisticated quote block)` : ""}
${highlights && highlights.length > 0 ? `- HIGHLIGHTS: ${highlights.join(" | ")} (Render these as punchy, emphasized text)` : ""}

CRITICAL DESIGN RULES (NON-NEGOTIABLE):
1. BENTO BOX / GRID PHILOSOPHY: 
   - Use modular containers (rectangles with glassmorphism) to separate different types of content (Data vs. Text vs. Quotes).
   - Create a clear visual hierarchy. Data cards should be the most eye-catching.
2. DATA CALLOUTS:
   - For Key Data, use prominent but balanced font sizes (e.g., ${Math.round(config.bodyFontSize * 1.3)}pt for the value) and clear labels.
   - Ensure these elements fit comfortably within their modular containers without breaking the overall layout.
   - Place them in high-contrast boxes (e.g., ACCENT color background with BACKGROUND color text).
3. NESTED CONTAINERS (BOX-IN-BOX):
   - For complex layouts like 'bento-grid', use "Nested Containers".
   - Create a large, semi-transparent base shape (Outer Box) to group related content.
   - Place smaller, higher-contrast shapes or text blocks (Inner Boxes) inside the base shape.
   - Ensure the Inner Boxes have a slightly different fill or a stronger shadow to create a "floating" effect within the Outer Box.
4. QUOTE BLOCKS:
   - Use a distinct background or a large decorative quote mark.
   - Ensure the author's name is clearly attributed in a smaller, elegant font.
4. COLOR ADHERENCE: You MUST use the hex codes provided in the palette. ALL text elements MUST use "${colors[3]}" as their color. Black (#000000) is FORBIDDEN as text color. This is NON-NEGOTIABLE.
5. MANDATORY ROUNDED CORNERS: EVERY rectangle or text container MUST have "cornerRadius": ${config.cornerRadius}.
6. VISUAL HIERARCHY & FONT SIZE (NON-NEGOTIABLE - DO NOT DEVIATE):
   - ALL title elements MUST use EXACTLY ${config.titleFontSize}pt. DO NOT deviate under any circumstance.
   - ALL subtitle elements MUST use EXACTLY ${config.subtitleFontSize}pt. DO NOT deviate under any circumstance.
   - ALL body/content text elements MUST use EXACTLY ${config.bodyFontSize}pt. DO NOT deviate under any circumstance.
   - Data Values: ${Math.round(config.bodyFontSize * 1.3)}pt (Zoomed 30% from body).
   - Data Labels: ${config.bodyFontSize}pt.
7. NO REFERENCE IMAGE AS CONTENT: DO NOT use the provided style reference image as a background or content element.
8. CONTRAST IS KING: Ensure text color (${colors[3]}) is clearly visible against its background.
9. GLASSMORPHISM & LAYERING (SPATIAL HIERARCHY): 
   - Use semi-transparent backgrounds (opacity 0.1-0.8) for text containers to create a "glass" effect.
   - Layer elements: Place shapes behind text to create depth. Use "shadow": true for elevated elements.
   - For a sense of depth, use overlapping elements and subtle Z-axis hierarchy (elements later in the array are on top).
10. BACKGROUND IMAGE STRATEGY:
   - If the style is "Atmospheric", "Immersive", or "Cinematic", or if the content is highly visual, you SHOULD generate a background image.
   - To set a background image: Include an element with type="image", x:0, y:0, w:100, h:100 at the start of the elements array.
   - WHENEVER you include a background image element, you MUST ALSO populate the "imagePrompts" array with at least one prompt describing that image.
   - imagePrompts format: [{ "prompt": "detailed visual description", "aspectRatio": "16:9" }]
   - If no background image is needed, omit the imagePrompts field entirely.
11. DECORATIVE ELEMENTS & ICONS:
   - Icon Restriction: Icons/Emojis should ONLY be placed near the main title or section headers.
   - Body Text Enhancement: For important paragraphs, use "Color Bars" (thin vertical rectangles) to the left of the text.
   - Consistency: Ensure all bullet points use the "•" symbol.
12. LAYOUT SPECIFIC RULES:
   - IF layout is 'center-hero': This is a COVER slide. Focus ONLY on Title and Subtitle. DO NOT render Data Cards or Quote Blocks here unless they are part of the title branding. Keep it clean and impactful.
   - IF layout is 'data-focus': Prioritize Key Data cards.
   - IF layout is 'expert-quote': Prioritize the Quote block.
13. STRICT TEXT STYLE ENFORCEMENT (MANDATORY):
   - ALL text elements MUST have style.fontFamily = "${fontFamily}". No other font is permitted.
   - ALL text elements MUST have style.color = "${colors[3]}". Black (#000000) is FORBIDDEN as text color.
   - style.color and style.fontFamily are REQUIRED fields for every text element. Do NOT omit them.
14. NO OVERLAP RULE (MANDATORY):
   - Adjacent text elements MUST have at least 2% vertical gap between them (i.e., next element's y >= previous element's y + h + 2).
   - Layout coordinate guides (do NOT place elements outside their designated zone):
     * split-left: left text area x:0–48, right area x:52–100
     * split-right: left area x:0–48, right text area x:52–100
     * grid-3: col1 x:0–30, col2 x:35–65, col3 x:70–100
     * top-bottom: header y:0–20, content y:25–90
15. TITLE & SUBTITLE POSITION CONSISTENCY (MANDATORY):
   - For ALL layouts EXCEPT center-hero and full-image:
     * Title element: y MUST be 3–10, h MUST be 10–18
     * Subtitle element (if present): y MUST be title.y + title.h + 2 (approximately 15–26), h MUST be 8–14
   - For center-hero layout:
     * Title element: y MUST be 28–42 (vertically centered), h MUST be 12–22
     * Subtitle element (if present): y MUST be title.y + title.h + 3, h MUST be 8–14
   - For full-image layout: title and subtitle placement is flexible but must remain in the top 50% of the slide.
   - ALL body/content elements MUST start below y = 28 to avoid colliding with the title zone.
   - This rule ensures visual consistency across all slides in the same presentation.
16. DECORATIVE ACCENTS (MANDATORY - apply based on scenario + layout):

   SCENARIO TONE (controls richness and color intensity of decorations):
   - academic: MINIMAL — only thin lines allowed (w≤1%, accent color, opacity≤0.4). NO emoji in decorations. Number labels use plain text only.
   - general: MODERATE — accent color blocks, short lines, numbered badge shapes allowed. Emoji only via decorativeIcon field.
   - business: PRECISE — high-contrast accent solid blocks, square badges (not round), sharp angles. NO emoji.
   - creative: RICH — multiple accent color blocks, large emoji decorations, irregular line widths, badges encouraged, use all palette colors freely.
   - ted: ULTRA-MINIMAL — at most 1 decoration total: either 1 thick accent line OR 1 large decorativeIcon. Nothing else.
   Current scenario: ${scenarioId || 'general'}

   LAYOUT-SPECIFIC DECORATION RULES (apply within scenario constraints above):
   BADGE CONTRAST RULE (applies to ALL scenarios that use background badges): The badge background color and the number/text on top MUST have strong contrast. Use accent color as badge background with background color (${colors[0]}) as the text, OR use background color as badge with accent color as text. Never use same-family colors for badge and its text.

   - feature-list / timeline-flow: Add a sequence badge before each section. academic→plain "01." text only (no badge shape); general/business→accent-color shape (w:3,h:5) + background-color number text on top (apply BADGE CONTRAST RULE); creative→accent-color shape (w:3,h:5, circle or square per style) + background-color number text on top, AND optionally add a small emoji icon alongside the badge.
   - grid-3 / grid-2 / bento-grid: Add a short horizontal accent line at top of each cell (w:8–15%, h:0.8–1.2%, accent color). academic→opacity 0.3; creative→opacity 1.0 + can add corner emoji.
   - split-left / split-right: Add a short accent underline below title (w:15–25%, h:0.8%, accent color). Add thin vertical accent bar left of key paragraphs (w:0.8%, h matching paragraph, accent color). academic→opacity 0.3 only; creative→multiple bars of varying widths.
   - top-bottom: Add a horizontal divider shape between header and content zones (w:80–90%, h:0.5–1%, centered, accent color).
   - center-hero: Place decorativeIcon as large text element (fontSize 36–48pt) above the title. academic→skip; creative→also add 2–3 small geometric shapes as background accents.
   - quote / expert-quote: Add a large decorative quotation mark "❝" as a shape/text element behind the quote (fontSize 60–80pt, accent color). academic→opacity 0.1; general/business→opacity 0.2; creative→opacity 0.4.
   - data-focus: Add a thin accent-color bottom border line below each data value (w matching card, h:0.5%). creative→also add small emoji in card corner.
   - full-image: Add a semi-transparent shape behind text areas to improve readability (accent or background color, opacity 0.4–0.7).

Create a visually stunning, balanced composition for this slide.`;
