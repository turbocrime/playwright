/**
 * Copyright 2019 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { playwrightTest as it, expect } from '../../config/browserTest';

it.describe('mv2', () => {
  let userDataDir: string;
  let extensionPath: string;
  let extensionOptions;

  it.beforeEach(async ({ browserType, createUserDataDir, asset }) => {
    userDataDir = await createUserDataDir();
    extensionPath = asset('web-extension-mv2');
    extensionOptions = {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
  });

  it('should return mv2 background pages', async ({ browserType }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundPage = context.backgroundPages()[0] ?? await context.waitForEvent('backgroundpage');
    expect(backgroundPage).toBeTruthy();
    expect(context.backgroundPages()).toContain(backgroundPage);
    expect(context.pages()).not.toContain(backgroundPage);
    await context.close();
    expect(context.pages().length).toBe(0);
    expect(context.backgroundPages().length).toBe(0);
  });

  it('should return mv2 background pages when recording video', async ({ browserType }, testInfo) => {
    extensionOptions['recordVideo'] = { dir: testInfo.outputPath('') };
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundPage = context.backgroundPages()[0] ?? await context.waitForEvent('backgroundpage');
    expect(backgroundPage).toBeTruthy();
    expect(context.backgroundPages()).toContain(backgroundPage);
    expect(context.pages()).not.toContain(backgroundPage);
    await context.close();
  });

  it('should support request/response events when using mv2 backgroundPage()', async ({ browserType, server }) => {
    server.setRoute('/empty.html', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'x-response-foobar': 'BarFoo' });
      res.end(`<span>hello world!</span>`);
    });
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundPage = context.backgroundPages()[0] ?? await context.waitForEvent('backgroundpage');
    await backgroundPage.waitForURL(/chrome-extension\:\/\/.*/);
    const [request, response, contextRequest, contextResponse] = await Promise.all([
      backgroundPage.waitForEvent('request'),
      backgroundPage.waitForEvent('response'),
      context.waitForEvent('request'),
      context.waitForEvent('response'),
      backgroundPage.evaluate(url => fetch(url, {
        method: 'POST',
        body: 'foobar',
        headers: { 'X-FOOBAR': 'KEKBAR' }
      }), server.EMPTY_PAGE),
    ]);
    expect(request).toBe(contextRequest);
    expect(response).toBe(contextResponse);
    expect(request.url()).toBe(server.EMPTY_PAGE);
    expect(request.method()).toBe('POST');
    expect(await request.allHeaders()).toEqual(expect.objectContaining({ 'x-foobar': 'KEKBAR' }));
    expect(request.postData()).toBe('foobar');

    expect(response.status()).toBe(200);
    expect(response.url()).toBe(server.EMPTY_PAGE);
    expect(response.request()).toBe(request);
    expect(await response.text()).toBe('<span>hello world!</span>');
    expect(await response.allHeaders()).toEqual(expect.objectContaining({ 'x-response-foobar': 'BarFoo' }));

    await context.close();
  });

  it('should report console messages from mv2 content script', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32762' }
  }, async ({ browserType, server }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const page = await context.newPage();
    const consolePromise = page.waitForEvent('console', e => e.text().includes('hey from the content-script'));
    await page.goto(server.EMPTY_PAGE);
    const message = await consolePromise;
    expect(message.text()).toContain('hey from the content-script');
    await context.close();
  });

  it('should report console messages from mv2 background page', async ({ browserType }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundPage = context.backgroundPages()[0] ?? await context.waitForEvent('backgroundpage');
    const consoleMessage = await backgroundPage.waitForEvent('console', e => e.text().includes('hey from the background page'));
    expect(consoleMessage.text()).toContain('hey from the background page');
    await context.close();
  });

  it('should support evaluate in mv2 background page', async ({ browserType }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundPage = context.backgroundPages()[0] ?? await context.waitForEvent('backgroundpage');
    expect(await backgroundPage.evaluate('MAGIC')).toBe(42);
    expect(await backgroundPage.evaluate('chrome.runtime.id')).toBe(backgroundPage.url().split('/')[2]);
  });
});

it.describe('mv3', () => {
  let userDataDir: string;
  let extensionPath: string;
  let extensionOptions;

  it.beforeEach(async ({ browserType, createUserDataDir, asset }) => {
    userDataDir = await createUserDataDir();
    extensionPath = asset('web-extension-mv3');
    extensionOptions = {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
  });

  it('should return mv3 background service workers', async ({ browserType, createUserDataDir, asset }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', sw => sw.url().startsWith('chrome-extension://'));
    expect(backgroundWorker).toBeTruthy();
    expect(context.serviceWorkers()).toContain(backgroundWorker);
    expect(context.pages()).not.toContain(backgroundWorker);
    expect(context.backgroundPages()).not.toContain(backgroundWorker);
    await context.close();
    expect(context.serviceWorkers().length).toBe(0);
    expect(context.pages().length).toBe(0);
    expect(context.backgroundPages().length).toBe(0);
  });

  it('should report console messages from mv3 content script', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32762' }
  }, async ({ browserType, createUserDataDir, asset, server }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const page = await context.newPage();
    const consolePromise = page.waitForEvent('console', e => e.text().includes('Test console log from a third-party execution context'));
    await page.goto(server.EMPTY_PAGE);
    const message = await consolePromise;
    expect(message.text()).toContain('Test console log from a third-party execution context');
    await context.close();
  });

  it('should support evaluate in mv3 service worker', async ({ browserType, createUserDataDir, asset, server }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', sw => sw.url().startsWith('chrome-extension://'));
    expect(await backgroundWorker.evaluate('MAGIC_TIMES_TEN')).toBe(42 * 10);
    expect(await backgroundWorker.evaluate('chrome.runtime.id')).toBe(backgroundWorker.url().split('/')[2]);
  });

  it.fixme('should attach to mv3 popup', async ({ browserType, createUserDataDir, asset, server }) => {
    const context = (await browserType.launchPersistent(userDataDir, extensionOptions)).defaultContext()!;
    const backgroundWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', sw => sw.url().startsWith('chrome-extension://'));

    const pagePromise = context.waitForEvent('page');
    await backgroundWorker.evaluate('chrome.action.openPopup({})');
    const page = await pagePromise;
    expect(await page.title()).toBe('Mv3 Popup');
  });
});