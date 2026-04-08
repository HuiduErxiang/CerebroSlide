import { test, expect } from '@playwright/test';
import {
  mockApiUserData,
  mockGeminiGenerateContent,
  mockGeminiSlideGeneration,
  MOCK_API_KEY,
  MOCK_PROJECT,
} from './fixtures/mock-api';

test.describe('single-slide', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiUserData(page, [MOCK_PROJECT]);
    await mockGeminiGenerateContent(page, { text: 'ok' });
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
  });

  test('切换到单页制作 tab 后内容区域应正确渲染', async ({ page }) => {
    await page.click('button:has-text("单页制作")');
    await expect(page.locator('button:has-text("单页制作")')).toBeVisible();
  });

  test('选择项目后单页模式应显示输入和生成按钮', async ({ page }) => {
    await page.click('button:has-text("单页制作")');
    await page.click('text=测试项目');
    await expect(page.locator('text=创意指令')).toBeVisible();
    await expect(page.locator('button:has-text("立即生成页面")')).toBeVisible();
  });

  test('空输入时生成按钮应禁用', async ({ page }) => {
    await page.click('button:has-text("单页制作")');
    await page.click('text=测试项目');
    const genBtn = page.locator('button:has-text("立即生成页面")');
    await expect(genBtn).toBeDisabled();
  });

  test('输入文本后点击生成应产生新幻灯片卡片', async ({ page }) => {
    await mockGeminiSlideGeneration(page);
    await page.click('button:has-text("单页制作")');
    await page.click('text=测试项目');

    await page.fill('textarea[placeholder*="描述您想要的页面内容"]', '人工智能的发展历史');
    await page.click('button:has-text("立即生成页面")');

    await expect(page.locator('text=最近生成')).toBeVisible({ timeout: 20000 });
  });
});
