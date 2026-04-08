import { test, expect } from '@playwright/test';
import { mockApiUserData, mockGeminiGenerateContent, MOCK_API_KEY } from './fixtures/mock-api';

test.describe('auth', () => {
  test('登录页面应显示 API Key 输入框', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=SlideGen AI v2')).toBeVisible();
    await expect(page.locator('button:has-text("进入工作台")')).toBeVisible();
  });

  test('空 API Key 时登录按钮应禁用', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.locator('button:has-text("进入工作台")');
    await expect(loginBtn).toBeDisabled();
  });

  test('输入 API Key 后登录按钮应启用', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="password"]', MOCK_API_KEY);
    const loginBtn = page.locator('button:has-text("进入工作台")');
    await expect(loginBtn).toBeEnabled();
  });

  test('使用有效 API Key 应成功登录并显示主界面', async ({ page }) => {
    await mockApiUserData(page);
    await mockGeminiGenerateContent(page, { text: 'ok' });

    await page.goto('/');
    await page.fill('input[type="password"]', MOCK_API_KEY);
    await page.click('button:has-text("进入工作台")');

    await expect(page.locator('text=我的项目')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=全案生成')).toBeVisible();
    await expect(page.locator('text=单页制作')).toBeVisible();
  });

  test('登录后 localStorage 应保存 API Key', async ({ page }) => {
    await mockApiUserData(page);
    await mockGeminiGenerateContent(page, { text: 'ok' });

    await page.goto('/');
    await page.fill('input[type="password"]', MOCK_API_KEY);
    await page.click('button:has-text("进入工作台")');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });

    const savedKey = await page.evaluate(() => localStorage.getItem('slidegen_user_api_key'));
    expect(savedKey).toBe(MOCK_API_KEY);
  });

  test('保存的 API Key 应在刷新后自动登录', async ({ page }) => {
    await mockApiUserData(page);
    await mockGeminiGenerateContent(page, { text: 'ok' });

    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');

    await expect(page.locator('text=我的项目')).toBeVisible({ timeout: 15000 });
  });
});
