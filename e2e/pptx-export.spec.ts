import { test, expect } from '@playwright/test';
import {
  mockApiUserData,
  mockGeminiGenerateContent,
  MOCK_API_KEY,
  MOCK_PROJECT,
} from './fixtures/mock-api';

test.describe('pptx-export', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiUserData(page, [MOCK_PROJECT]);
    await mockGeminiGenerateContent(page, { text: 'ok' });
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
    await page.click('text=测试项目');
  });

  test('全案模式中有大纲时应显示导出 PPTX 按钮', async ({ page }) => {
    await expect(page.locator('button:has-text("导出完整 PPTX")')).toBeVisible({ timeout: 5000 });
  });

  test('点击导出完整 PPTX 应触发文件下载', async ({ page }) => {
    await expect(page.locator('button:has-text("导出完整 PPTX")')).toBeVisible({ timeout: 5000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('button:has-text("导出完整 PPTX")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/);
  });
});
