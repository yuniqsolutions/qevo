<div align="center">

# 🚀 Qevo

**The Ultimate Cross-Browser Extension Toolkit**

_Pronounced "keh-vo" • Unified API for Chrome & Firefox Extension Development_

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-4285f4.svg?style=flat-square&logo=google-chrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![Firefox](https://img.shields.io/badge/Firefox-WebExt-ff7139.svg?style=flat-square&logo=firefox)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)

**Stop fighting browser APIs. Start building extensions.**

[Features](#-core-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [API](#-api-modules)

</div>

---

## 🎯 Why Qevo?

Building browser extensions is hard. Managing Chrome vs Firefox differences is harder. **Qevo makes it effortless.**

```typescript
// ❌ Without Qevo
const api = typeof browser !== 'undefined' ? browser : chrome;
api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  api.tabs.sendMessage(tabs[0].id, { type: 'getData' }, (response) => {
    if (api.runtime.lastError) { /* handle error */ }
  });
});

// ✅ With Qevo
import qevo from 'qevo';
const [tab] = await qevo.tabs.query({ active: true, currentWindow: true });
const response = await qevo.tabs.sendMessage(tab.id, { type: 'getData' });
```

---

## ✨ Core Features

| Feature | Description |
|---------|-------------|
| **🔄 Unified API** | Single API works on Chrome and Firefox - no browser detection needed |
| **⏳ Promise-Based** | All async operations return Promises - use async/await everywhere |
| **📝 Type-Safe** | Full TypeScript support with comprehensive type definitions |
| **🗂️ Storage with TTL** | Key-value storage with automatic expiration and change listeners |
| **📨 Smart Messaging** | Background ↔ content script communication with timeout/retry |
| **🌐 WebRequest Control** | Intercept, block, redirect, and modify HTTP requests |
| **📑 Complete APIs** | Tabs, Windows, Cookies, Downloads, History, Bookmarks, and more |
| **🔧 Auto Debug Mode** | Debug logging auto-detected from environment |

---

## 📦 Installation

```bash
npm install qevo
```

---

## 🚀 Quick Start

```typescript
import { storage, messages } from 'qevo';

// Messages - register handler in background
qevo.messages.on('getData', async (data, sender, sendResponse) => {
  const result = await fetchData(data.id);
  sendResponse({ success: true, data: result });
  return true; // Keep channel open for async
});

// Messages - send from content script
const response = await messages.sendToBackground('getData', { id: 123 });

// Storage with auto-expiration
await storage.put('token', 'abc123', { ttl: 3600 }); // expires in 1 hour
const token = await storage.get<string>('token');

// Tabs
const [activeTab] = await qevo.tabs.query({ active: true, currentWindow: true });
```

---

## 📚 API Modules

### 📨 Messages (`qevo.messages`)

| Method | Description |
|--------|-------------|
| `on(type, listener)` | Register message handler |
| `off(type, listener)` | Remove message handler |
| `clear(type)` | Remove all handlers for type |
| `sendToBackground(type, data, options?)` | Send to background script |
| `sendToTab(tabId, type, data, options?)` | Send to specific tab |
| `broadcast(type, data, options?)` | Send to all tabs |

```typescript
qevo.messages.on('fetchUser', async (data, sender, sendResponse) => {
  const user = await getUser(data.userId);
  sendResponse({ success: true, data: user });
  return true;
});

const response = await qevo.messages.sendToBackground('fetchUser', { userId: 123 }, {
  timeout: 10000,
  retries: 2
});
```

---

### 🗂️ Storage (`qevo.storage`)

| Method | Description |
|--------|-------------|
| `put(key, value, options?)` | Store with optional TTL/expiration |
| `get<T>(key)` | Retrieve value |
| `has(key)` | Check if key exists |
| `remove(key)` | Remove key |
| `listKeys(prefix?)` | List keys with optional prefix |
| `batch(operations)` | Atomic batch operations |
| `addListener(type, callback)` | Listen for changes (`add`, `update`, `remove`) |

```typescript
await qevo.storage.put('session', { token: 'abc', user: 'john' }, { ttl: 3600 });
const session = await qevo.storage.get<{ token: string; user: string }>('session');

qevo.storage.addListener('remove', (key) => {
  if (key === 'session') redirectToLogin();
});
```

---

### 📑 Tabs (`qevo.tabs`)

| Method | Description |
|--------|-------------|
| `query(queryInfo)` | Query tabs with filters |
| `get(tabId)` | Get tab by ID |
| `create(options)` | Create new tab |
| `update(tabId, options)` | Update tab properties |
| `remove(tabIds)` | Close tab(s) |
| `reload(tabId?, bypassCache?)` | Reload tab |
| `sendMessage(tabId, message, options?)` | Send message to tab |
| `discard(tabId?)` | Discard tab from memory |

```typescript
const tabs = await qevo.tabs.query({ url: '*://github.com/*' });
const newTab = await qevo.tabs.create({ url: 'https://example.com', active: false });
await qevo.tabs.update(newTab.id, { pinned: true });
```

---

### 🪟 Windows (`qevo.windows`)

| Method | Description |
|--------|-------------|
| `create(options?)` | Create window |
| `get(windowId, getInfo?)` | Get window |
| `getCurrent(getInfo?)` | Get current window |
| `getAll(getInfo?)` | Get all windows |
| `update(windowId, updateInfo)` | Update window |
| `remove(windowId)` | Close window |

```typescript
const popup = await qevo.windows.create({
  url: 'popup.html',
  type: 'popup',
  width: 400,
  height: 600
});
```

---

### 🌐 WebRequest (`qevo.webRequest`)

> ⚠️ Background script only

| Event | Blocking | Description |
|-------|----------|-------------|
| `BeforeRequest` | ✅ | Cancel/redirect requests |
| `BeforeSendHeaders` | ✅ | Modify request headers |
| `SendHeaders` | ❌ | Observe outgoing headers |
| `HeadersReceived` | ✅ | Modify response headers |
| `AuthRequired` | ✅ | Provide credentials |
| `Completed` | ❌ | Request completed |
| `ErrorOccurred` | ❌ | Request failed |

```typescript
qevo.webRequest.on('BeforeRequest', (details) => {
  if (details.url.includes('tracking')) {
    return { cancel: true };
  }
}, { urls: ['<all_urls>'] }, ['blocking']);
```

---

### 🍪 Cookies (`qevo.cookies`)

| Method | Description |
|--------|-------------|
| `get(details)` | Get cookie by URL/name |
| `getAll(details)` | Get all matching cookies |
| `set(details)` | Set cookie |
| `remove(details)` | Remove cookie |

```typescript
const cookies = await qevo.cookies.getAll({ domain: 'example.com' });
await qevo.cookies.set({
  url: 'https://example.com',
  name: 'session',
  value: 'abc123',
  expirationDate: Date.now() / 1000 + 3600
});
```

---

### 📥 Downloads (`qevo.downloads`)

| Method | Description |
|--------|-------------|
| `download(options)` | Start download |
| `search(query)` | Search downloads |
| `pause(downloadId)` | Pause download |
| `resume(downloadId)` | Resume download |
| `cancel(downloadId)` | Cancel download |
| `getFileIcon(downloadId, options?)` | Get file icon |

```typescript
const downloadId = await qevo.downloads.download({
  url: 'https://example.com/file.pdf',
  filename: 'document.pdf'
});
```

---

### 📚 Bookmarks (`qevo.bookmarks`)

| Method | Description |
|--------|-------------|
| `getTree()` | Get entire bookmark tree |
| `get(idOrIds)` | Get bookmark(s) |
| `search(query)` | Search bookmarks |
| `create(bookmark)` | Create bookmark |
| `update(id, changes)` | Update bookmark |
| `remove(id)` | Remove bookmark |

```typescript
const bookmark = await qevo.bookmarks.create({
  title: 'My Favorite Site',
  url: 'https://example.com'
});
```

---

### 📜 History (`qevo.history`)

| Method | Description |
|--------|-------------|
| `search(query)` | Search history |
| `getVisits(details)` | Get visits for URL |
| `addUrl(details)` | Add URL to history |
| `deleteUrl(details)` | Delete URL |
| `deleteAll()` | Clear all history |

```typescript
const items = await qevo.history.search({ text: 'github', maxResults: 10 });
```

---

### ⏰ Alarms (`qevo.alarms`)

| Method | Description |
|--------|-------------|
| `create(name?, alarmInfo)` | Create alarm |
| `get(name?)` | Get alarm |
| `getAll()` | Get all alarms |
| `clear(name?)` | Clear alarm |
| `clearAll()` | Clear all alarms |
| `onAlarm(listener)` | Listen for alarms |

```typescript
await qevo.alarms.create('sync', { periodInMinutes: 30 });
qevo.alarms.onAlarm((alarm) => {
  if (alarm.name === 'sync') performSync();
});
```

---

### 🔔 Notifications (`qevo.notifications`)

| Method | Description |
|--------|-------------|
| `create(id?, options)` | Create notification |
| `update(id, options)` | Update notification |
| `clear(id)` | Clear notification |

```typescript
await qevo.notifications.create({
  type: 'basic',
  title: 'Download Complete',
  message: 'Your file has been downloaded',
  iconUrl: 'icon.png'
});
```

---

### 📋 Context Menus (`qevo.contextMenus`)

| Method | Description |
|--------|-------------|
| `create(properties)` | Create menu item |
| `update(id, properties)` | Update menu item |
| `remove(menuItemId)` | Remove menu item |
| `removeAll()` | Remove all items |

```typescript
await qevo.contextMenus.create({
  id: 'search',
  title: 'Search for "%s"',
  contexts: ['selection']
});
```

---

### 🎬 Action (`qevo.action`)

| Method | Description |
|--------|-------------|
| `setIcon(details)` | Set toolbar icon |
| `setTitle(details)` | Set tooltip |
| `setBadgeText(details)` | Set badge text |
| `setBadgeBackgroundColor(details)` | Set badge color |
| `setPopup(details)` | Set popup page |
| `enable(tabId?)` / `disable(tabId?)` | Enable/disable action |

```typescript
await qevo.action.setBadgeText({ text: '5' });
await qevo.action.setBadgeBackgroundColor({ color: '#FF0000' });
```

---

### 🔧 Runtime (`qevo.runtime`)

| Property/Method | Description |
|-----------------|-------------|
| `getManifest()` | Get manifest |
| `getURL(path)` | Get extension URL |
| `getPlatformInfo()` | Get platform info |
| `openOptionsPage()` | Open options page |
| `reload()` | Reload extension |
| `onInstalled(listener)` | Listen for install/update |

```typescript
const manifest = qevo.runtime.getManifest();
qevo.runtime.onInstalled((details) => {
  if (details.reason === 'install') showWelcomePage();
});
```

---

### 🔑 Permissions (`qevo.permissions`)

| Method | Description |
|--------|-------------|
| `contains(permissions)` | Check permissions |
| `request(permissions)` | Request permissions |
| `remove(permissions)` | Remove permissions |

```typescript
const granted = await qevo.permissions.request({ permissions: ['history'] });
```

---

### 🌍 I18n (`qevo.i18n`)

| Method | Description |
|--------|-------------|
| `getMessage(name, substitutions?)` | Get translated message |
| `getUILanguage()` | Get UI language |
| `getAcceptLanguages()` | Get preferred languages |

```typescript
const greeting = qevo.i18n.getMessage('welcomeMessage', ['John']);
```

---

### 💤 Idle (`qevo.idle`)

| Method | Description |
|--------|-------------|
| `queryState(detectionInterval)` | Query idle state |
| `onStateChanged(listener)` | Listen for state changes |

```typescript
const state = await qevo.idle.queryState(60); // 'active', 'idle', or 'locked'
```

---

### ⌨️ Commands (`qevo.commands`)

| Method | Description |
|--------|-------------|
| `getAll()` | Get all commands |
| `onCommand(listener)` | Listen for commands |

```typescript
qevo.commands.onCommand((command) => {
  if (command === 'toggle-feature') toggleFeature();
});
```

---

### 💉 Scripting (`qevo.scripting`)

| Method | Description |
|--------|-------------|
| `executeScript(injection)` | Execute script in tab |
| `insertCSS(injection)` | Insert CSS |
| `removeCSS(injection)` | Remove CSS |

```typescript
await qevo.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => document.title
});
```

---

### 🔐 Identity (`qevo.identity`)

| Method | Description |
|--------|-------------|
| `getAuthToken(details?)` | Get OAuth token (Chrome) |
| `launchWebAuthFlow(details)` | Launch auth flow |
| `getRedirectURL(path?)` | Get redirect URL |

```typescript
const token = await qevo.identity.getAuthToken({ interactive: true });
```

---

## 🛠️ Utilities

```typescript
qevo.isBackgroundScript()  // Check if in background
qevo.isContentScript()     // Check if in content script
qevo.getBrowserType()      // 'chrome' | 'firefox' | 'unknown'
qevo.debug = true          // Enable debug logging
```

---

## 🏗️ TypeScript Support

Full type safety with generics:

```typescript
interface UserData { id: number; name: string; }

// Type-safe storage
await qevo.storage.put<UserData>('user', { id: 1, name: 'John' });
const user = await qevo.storage.get<UserData>('user');

// Type-safe messaging
const response = await qevo.messages.sendToBackground<{ userId: number }, UserData>(
  'getUser', { userId: 123 }
);
```

---

## 📄 License

MIT License - Free for personal and commercial use.

---

<div align="center">

**Qevo** • Cross-Browser • Type-Safe • Production-Ready

</div>
