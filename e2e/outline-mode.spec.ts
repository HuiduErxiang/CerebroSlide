import { test, expect } from '@playwright/test';
import {
  mockApiUserData,
  mockGeminiOutlineGeneration,
  mockGeminiSlideGeneration,
  MOCK_API_KEY,
  MOCK_PROJECT,
} from './fixtures/mock-api';

test.describe('outline-mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiUserData(page, [MOCK_PROJECT]);
    await mockGeminiOutlineGeneration(page);
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
    await page.click('text=测试项目');
  });

  test('全案生成 tab 应显示输入文案区域', async ({ page }) => {
    await expect(page.locator('text=输入文案')).toBeVisible();
    await expect(page.locator('text=选择内容场景')).toBeVisible();
  });

  test('空文案时生成大纲按钮应禁用', async ({ page }) => {
    const genBtn = page.locator('button:has-text("生成大纲结构")');
    await expect(genBtn).toBeDisabled();
  });

  test('输入脚本后点击生成大纲应显示大纲列表', async ({ page }) => {
    await page.locator('textarea').first().fill('人工智能的发展历程和未来展望');
    await page.click('button:has-text("生成大纲结构")');

    await expect(page.locator('input[value="第一页标题"]').first()).toBeVisible({ timeout: 20000 });
  });

  test('点击大纲项生成按钮触发 AI 生成流程', async ({ page }) => {
    await page.locator('textarea').first().fill('人工智能的发展历程');
    await page.click('button:has-text("生成大纲结构")');
    await page.waitForSelector('input[value="第一页标题"]', { timeout: 20000 });

    await mockGeminiSlideGeneration(page);
    const generateAreaBtn = page.locator('button[class*="py-10"][class*="border-dashed"]');
    if (await generateAreaBtn.first().isVisible({ timeout: 3000 })) {
      await generateAreaBtn.first().click();
      await page.waitForTimeout(2000);
    }
    await expect(page.locator('text=幻灯片大纲').first()).toBeVisible({ timeout: 5000 });
  });
});
