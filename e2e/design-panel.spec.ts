import { test, expect } from '@playwright/test';
import {
  mockApiUserData,
  mockGeminiGenerateContent,
  MOCK_API_KEY,
  MOCK_PROJECT,
} from './fixtures/mock-api';

test.describe('design-panel', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiUserData(page, [MOCK_PROJECT]);
    await mockGeminiGenerateContent(page, { text: 'ok' });
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
    await page.click('text=测试项目');
  });

  test('设计风格面板默认应可见', async ({ page }) => {
    await expect(page.locator('text=设计风格').first()).toBeVisible();
    await expect(page.locator('text=配色方案')).toBeVisible();
  });

  test('点击设计风格按钮应切换面板显示', async ({ page }) => {
    await page.click('header button:has-text("设计风格")');
    await page.waitForTimeout(800);
    const aside = page.locator('aside').last();
    const opacity = await aside.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(0.5);
    await page.click('header button:has-text("设计风格")');
    await page.waitForTimeout(800);
    await expect(page.locator('text=配色方案')).toBeVisible({ timeout: 3000 });
  });

  test('点击保存当前风格应显示风格名称输入框', async ({ page }) => {
    await page.click('button:has-text("保存当前风格")');
    await expect(page.locator('input[placeholder="风格名称..."]')).toBeVisible();
  });

  test('输入风格名称并保存应将新风格添加到列表', async ({ page }) => {
    await mockApiUserData(page);

    await page.click('button:has-text("保存当前风格")');
    await page.fill('input[placeholder="风格名称..."]', '我的测试风格');
    await page.click('button:has-text("保存")');

    await expect(page.getByText('我的测试风格', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('删除自定义样式应从列表中移除', async ({ page }) => {
    const customStyle = {
      id: 'custom-1',
      name: '要删除的风格',
      style: 'minimal',
      requirements: '',
      colors: ['#ffffff', '#000000', '#333333', '#666666'],
      isCustom: true,
    };
    await mockApiUserData(page, [MOCK_PROJECT], [customStyle]);
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
    await page.click('text=测试项目');

    const styleSpan = page.getByText('要删除的风格', { exact: true });
    await expect(styleSpan).toBeVisible({ timeout: 5000 });
    const styleCard = styleSpan.locator('../..');
    await styleCard.hover();
    const deleteBtn = styleCard.locator('button');
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();
    await expect(page.getByText('要删除的风格', { exact: true })).not.toBeVisible({ timeout: 5000 });
  });
});
