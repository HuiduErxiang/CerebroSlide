import { Page, Route } from '@playwright/test';

export const MOCK_API_KEY = 'AIzaMockTestKey1234567890abcdef';

export const MOCK_OUTLINE_ITEM = {
  id: 'mock-outline-1',
  title: '第一页标题',
  subtitle: '副标题',
  body: '正文内容',
  suggestedLayout: 'center-hero',
  layoutDescription: '居中主题布局',
  isGenerated: true,
  slideId: 'mock-slide-1',
};

export const MOCK_PROJECT = {
  id: 'mock-project-1',
  name: '测试项目',
  createdAt: Date.now(),
  slides: [
    {
      id: 'mock-slide-1',
      title: '测试幻灯片',
      description: '这是一个测试幻灯片',
      timestamp: Date.now(),
      elements: [
        {
          type: 'text' as const,
          x: 10,
          y: 20,
          w: 80,
          h: 20,
          content: '测试标题',
          style: { fontSize: 48, bold: true, color: '#000000' },
        },
      ],
    },
  ],
  outline: [MOCK_OUTLINE_ITEM],
  script: '',
};

export const MOCK_SLIDE_RESPONSE = {
  id: 'generated-slide-1',
  title: 'AI生成幻灯片',
  description: 'AI自动生成的幻灯片',
  timestamp: Date.now(),
  elements: [
    {
      type: 'text' as const,
      x: 10,
      y: 20,
      w: 80,
      h: 20,
      content: 'AI生成的标题',
      style: { fontSize: 48, bold: true, color: '#FFFFFF' },
    },
    {
      type: 'shape' as const,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      shapeType: 'RECTANGLE' as const,
      style: { fill: '#1a1a2e' },
    },
  ],
};

export const MOCK_OUTLINE_TEXT = `
[SLIDE]
title: 第一页标题
subtitle: 副标题内容
body: 正文内容描述
suggestedLayout: center-hero
layoutDescription: 居中主题布局
[END_SLIDE]

[SLIDE]
title: 第二页标题
subtitle: 第二页副标题
body: 第二页正文
suggestedLayout: split-left
layoutDescription: 左右分栏布局
[END_SLIDE]
`;

const SESSION_RESPONSE = JSON.stringify({
  sessionToken: 'e2e-mock-session-token',
  expiresAt: Date.now() + 86400_000,
});

export async function mockSession(page: Page) {
  await page.route('**/api/session', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: SESSION_RESPONSE,
    });
  });
}

export async function mockApiUserData(page: Page, projects = [MOCK_PROJECT], customStyles: unknown[] = []) {
  await mockSession(page);
  await page.route('**/api/user-data', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects, customStyles }),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });
}

export async function mockGeminiGenerateContent(page: Page, responseBody: unknown) {
  await page.route('**/api/ai/generate-content', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody) }],
            },
          },
        ],
      }),
    });
  });
}

export async function mockGeminiSlideGeneration(page: Page) {
  await page.route('**/api/ai/generate-content', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(MOCK_SLIDE_RESPONSE) }],
            },
          },
        ],
      }),
    });
  });
}

export async function mockGeminiOutlineGeneration(page: Page) {
  await page.route('**/api/ai/generate-content', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: MOCK_OUTLINE_TEXT }],
            },
          },
        ],
      }),
    });
  });
}

export async function loginWithMockKey(page: Page) {
  await mockApiUserData(page);
  await mockGeminiGenerateContent(page, { text: 'ok' });
  await page.goto('/');
  await page.fill('input[type="password"]', MOCK_API_KEY);
  await page.click('button:has-text("进入工作台")');
  await page.waitForSelector('text=我的项目', { timeout: 15000 });
}
