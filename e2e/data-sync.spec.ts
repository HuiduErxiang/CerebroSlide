import { test, expect } from '@playwright/test';
import {
  mockApiUserData,
  mockGeminiGenerateContent,
  MOCK_API_KEY,
  MOCK_PROJECT,
} from './fixtures/mock-api';

test.describe('data-sync', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiUserData(page, [MOCK_PROJECT]);
    await mockGeminiGenerateContent(page, { text: 'ok' });
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem('slidegen_user_api_key', key), MOCK_API_KEY);
    await page.goto('/');
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
  });

  test('登录后应加载云端项目数据', async ({ page }) => {
    await expect(page.locator('text=测试项目').first()).toBeVisible();
  });

  test('创建新项目应触发 POST /api/user-data', async ({ page }) => {
    let postCalled = false;
    await page.route('**/api/user-data', async (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ projects: [MOCK_PROJECT], customStyles: [] }),
        });
      }
    });

    await page.click('aside button:last-of-type');
    const newProjectInput = page.locator('input[placeholder="项目名称..."]');
    if (await newProjectInput.isVisible({ timeout: 3000 })) {
      await newProjectInput.fill('新建同步项目');
      await newProjectInput.press('Enter');
      await page.waitForTimeout(1000);
      expect(postCalled).toBe(true);
    }
  });

  test('刷新页面后 GET /api/user-data 应恢复项目列表', async ({ page }) => {
    let getCalled = false;
    await page.route('**/api/user-data', async (route) => {
      if (route.request().method() === 'GET') {
        getCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ projects: [MOCK_PROJECT], customStyles: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.reload();
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
    expect(getCalled).toBe(true);
    await expect(page.locator('text=测试项目').first()).toBeVisible();
  });

  test('GET /api/user-data 应携带认证请求头', async ({ page }) => {
    let capturedToken = '';
    await page.route('**/api/user-data', async (route) => {
      if (route.request().method() === 'GET') {
        capturedToken =
          route.request().headers()['x-session-token'] ||
          route.request().headers()['x-api-key'] ||
          '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ projects: [], customStyles: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.reload();
    await page.waitForSelector('text=我的项目', { timeout: 15000 });
    expect(capturedToken).toBeTruthy();
  });
});
