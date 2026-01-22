/**
 * Qevo Storage API
 *
 * A high-level key-value storage system for browser extensions with support for
 * TTL (time-to-live), automatic expiration cleanup, and change listeners.
 *
 * Features:
 * - Cross-browser support (Chrome, Firefox, and web via IndexedDB)
 * - TTL support with automatic expiration
 * - Change listeners for real-time updates
 * - Batch operations for efficiency
 * - Type-safe generic methods
 *
 * @module qevoStorage
 *
 * @example Basic usage
 * ```typescript
 * import { storage } from 'qevo';
 *
 * // Store a value
 * await storage.put('user', { name: 'John', age: 30 });
 *
 * // Retrieve a value
 * const user = await storage.get('user');
 *
 * // Store with TTL (expires in 1 hour)
 * await storage.put('token', 'abc123', { ttl: 3600 });
 *
 * // Check if key exists
 * if (await storage.has('token')) {
 *   console.log('Token is still valid');
 * }
 *
 * // Delete a value
 * await storage.remove('token');
 * ```
 */
/**
 * Internal storage wrapper containing value and optional expiration
 * @template T - Type of the stored value
 */
export type StorageValue<T> = {
	/** The actual stored value */
	value: T;
	/** Expiration timestamp in milliseconds (undefined = never expires) */
	expires?: number;
};
/**
 * Types of storage change events
 */
export type ListenerType = "add" | "remove" | "update";
/**
 * Callback signatures for storage change listeners
 */
export interface ListenerCallbacks {
	/** Called when a new key is added */
	add: (key: string, value: any) => void;
	/** Called when an existing key is updated */
	update: (key: string, oldValue: any, newValue: any) => void;
	/** Called when a key is removed */
	remove: (key: string) => void;
}
/**
 * Batch operation definition for efficient bulk operations
 */
export interface BatchOperation {
	/** Type of operation to perform */
	type: "set" | "remove" | "get";
	/** Key to operate on */
	key: string;
	/** Value for set operations */
	value?: any;
	/** TTL in seconds for set operations */
	ttl?: number;
	/** Explicit expiration date for set operations */
	expires?: Date;
}
declare abstract class QevoKVStore {
	/** Enable debug logging */
	debug: boolean;
	/** Registered change listeners */
	protected listeners: {
		[key in ListenerType]: Set<ListenerCallbacks[key]>;
	};
	/** Interval ID for automatic cleanup of expired entries */
	protected cleanupIntervalId?: number | NodeJS.Timeout;
	/** Cleanup interval in milliseconds (30 seconds) */
	protected readonly CLEANUP_INTERVAL_MS = 30000;
	constructor();
	/**
	 * Store a value with optional TTL or expiration date
	 *
	 * @template T - Type of the value to store
	 * @param key - Unique key to store the value under
	 * @param value - Value to store (will be serialized)
	 * @param options - Storage options
	 * @param options.ttl - Time-to-live in seconds
	 * @param options.expires - Explicit expiration date
	 *
	 * @example
	 * ```typescript
	 * // Store without expiration
	 * await storage.put('user', { name: 'John' });
	 *
	 * // Store with TTL (1 hour)
	 * await storage.put('token', 'abc123', { ttl: 3600 });
	 *
	 * // Store with explicit expiration
	 * await storage.put('cache', data, {
	 *   expires: new Date('2024-12-31')
	 * });
	 * ```
	 */
	abstract put<T>(key: string, value: T, options?: {
		ttl?: number;
		expires?: Date;
	}): Promise<void>;
	/**
	 * Retrieve a value by key
	 *
	 * Returns `null` if the key doesn't exist or has expired.
	 *
	 * @template T - Expected type of the stored value
	 * @param key - Key to retrieve
	 * @param usePrefix - If true, treats key as a prefix and returns first match
	 * @returns The stored value or null
	 *
	 * @example
	 * ```typescript
	 * const user = await storage.get<User>('user');
	 * if (user) {
	 *   console.log(user.name);
	 * }
	 *
	 * // Get by prefix
	 * const firstSession = await storage.get('session_', true);
	 * ```
	 */
	abstract get<T>(key: string, usePrefix?: boolean): Promise<T | null>;
	/**
	 * Retrieve a value with its metadata (including expiration)
	 *
	 * @template T - Expected type of the stored value
	 * @param key - Key to retrieve
	 * @returns StorageValue containing value and expiration, or null
	 *
	 * @example
	 * ```typescript
	 * const data = await storage.getWithMetadata<Token>('token');
	 * if (data) {
	 *   console.log('Value:', data.value);
	 *   console.log('Expires:', new Date(data.expires));
	 * }
	 * ```
	 */
	abstract getWithMetadata<T>(key: string): Promise<StorageValue<T> | null>;
	/**
	 * Check if a key exists and is not expired
	 *
	 * @param key - Key to check
	 * @returns True if key exists and is valid
	 *
	 * @example
	 * ```typescript
	 * if (await storage.has('authToken')) {
	 *   // User is authenticated
	 * }
	 * ```
	 */
	abstract has(key: string): Promise<boolean>;
	/**
	 * Remove a key from storage
	 *
	 * @param key - Key to remove
	 *
	 * @example
	 * ```typescript
	 * await storage.remove('authToken');
	 * ```
	 */
	abstract remove(key: string): Promise<void>;
	/**
	 * Get the total number of stored keys
	 *
	 * @returns Number of keys in storage
	 *
	 * @example
	 * ```typescript
	 * const count = await storage.length();
	 * console.log(`${count} items in storage`);
	 * ```
	 */
	abstract length(): Promise<number>;
	/**
	 * List all keys, optionally filtered by prefix
	 *
	 * @param prefix - Optional prefix to filter keys
	 * @returns Array of matching keys
	 *
	 * @example
	 * ```typescript
	 * // Get all keys
	 * const allKeys = await storage.listKeys();
	 *
	 * // Get keys starting with 'cache_'
	 * const cacheKeys = await storage.listKeys('cache_');
	 * ```
	 */
	abstract listKeys(prefix?: string): Promise<string[]>;
	/**
	 * Find the first key that starts with the given prefix
	 *
	 * @param prefix - Prefix to search for
	 * @returns First matching key or undefined
	 *
	 * @example
	 * ```typescript
	 * const sessionKey = await storage.getKeyByPrefix('session_');
	 * ```
	 */
	abstract getKeyByPrefix(prefix: string): Promise<string | undefined>;
	/**
	 * Find the first key that ends with the given suffix
	 *
	 * @param suffix - Suffix to search for
	 * @returns First matching key or undefined
	 *
	 * @example
	 * ```typescript
	 * const key = await storage.getKeyBySuffix('_temp');
	 * ```
	 */
	abstract getKeyBySuffix(suffix: string): Promise<string | undefined>;
	/**
	 * Execute multiple operations in a batch
	 *
	 * More efficient than individual operations for bulk updates.
	 *
	 * @param operations - Array of operations to perform
	 * @returns Array of results (values for get, undefined for set/remove)
	 *
	 * @example
	 * ```typescript
	 * const results = await storage.batch([
	 *   { type: 'set', key: 'a', value: 1, ttl: 3600 },
	 *   { type: 'set', key: 'b', value: 2 },
	 *   { type: 'get', key: 'a' },
	 *   { type: 'remove', key: 'old_key' }
	 * ]);
	 * // results = [undefined, undefined, 1, undefined]
	 * ```
	 */
	abstract batch(operations: BatchOperation[]): Promise<(any | undefined)[]>;
	/**
	 * Get the current storage usage in bytes
	 *
	 * @returns Storage usage in bytes
	 *
	 * @example
	 * ```typescript
	 * const bytes = await storage.getStorageUsage();
	 * console.log(`Using ${(bytes / 1024).toFixed(2)} KB`);
	 * ```
	 */
	abstract getStorageUsage(): Promise<number>;
	/** Internal method to clean up expired entries */
	protected abstract cleanupExpired(): Promise<void>;
	/** Check if the storage context is still valid (extension not unloaded) */
	protected abstract isContextValid(): boolean;
	/**
	 * Add a listener for storage changes
	 *
	 * @template T - Type of listener event
	 * @param event - Event type: 'add', 'update', or 'remove'
	 * @param listener - Callback function
	 *
	 * @example
	 * ```typescript
	 * storage.addListener('add', (key, value) => {
	 *   console.log(`Added: ${key} =`, value);
	 * });
	 *
	 * storage.addListener('update', (key, oldVal, newVal) => {
	 *   console.log(`Updated: ${key}`, oldVal, '->', newVal);
	 * });
	 *
	 * storage.addListener('remove', (key) => {
	 *   console.log(`Removed: ${key}`);
	 * });
	 * ```
	 */
	addListener<T extends ListenerType>(event: T, listener: ListenerCallbacks[T]): void;
	/**
	 * Remove a storage change listener
	 *
	 * @template T - Type of listener event
	 * @param event - Event type: 'add', 'update', or 'remove'
	 * @param listener - The listener function to remove
	 *
	 * @example
	 * ```typescript
	 * const myListener = (key, value) => console.log(key, value);
	 * storage.addListener('add', myListener);
	 * // Later...
	 * storage.removeListener('add', myListener);
	 * ```
	 */
	removeListener<T extends ListenerType>(event: T, listener: ListenerCallbacks[T]): void;
	protected triggerListeners(type: ListenerType, key: string, oldValue?: any, newValue?: any): void;
	protected initializeCleanup(): void;
	protected shouldRunCleanup(): boolean;
	protected isServiceWorker(): boolean;
	protected startCleanup(): void;
	protected stopCleanup(): void;
	/**
	 * Clean up resources and stop background processes
	 *
	 * Call this when you're done using the storage instance to free resources.
	 *
	 * @example
	 * ```typescript
	 * // When extension is unloading
	 * storage.destroy();
	 * ```
	 */
	destroy(): void;
}
/**
 * Tab Types
 * All types and interfaces for the Tabs API
 * Matches chrome.tabs API exactly
 */
/**
 * The tab's muted state and the reason for the last state change
 * @since Chrome 46
 */
export interface MutedInfo {
	/** Whether the tab is muted (prevented from playing sound) */
	muted: boolean;
	/** The reason the tab was muted or unmuted */
	reason?: `${MutedInfoReason}`;
	/** The ID of the extension that changed the muted state */
	extensionId?: string;
}
/**
 * An event that caused a muted state change
 * @since Chrome 46
 */
export declare enum MutedInfoReason {
	USER = "user",
	CAPTURE = "capture",
	EXTENSION = "extension"
}
/**
 * The tab's loading status
 */
export declare enum TabStatus {
	UNLOADED = "unloaded",
	LOADING = "loading",
	COMPLETE = "complete"
}
/**
 * The type of window
 */
export declare enum WindowType {
	NORMAL = "normal",
	POPUP = "popup",
	PANEL = "panel",
	APP = "app",
	DEVTOOLS = "devtools"
}
/**
 * Defines how zoom changes are handled
 * @since Chrome 44
 */
export declare enum ZoomSettingsMode {
	AUTOMATIC = "automatic",
	MANUAL = "manual",
	DISABLED = "disabled"
}
/**
 * Defines whether zoom changes persist for the page's origin
 * @since Chrome 44
 */
export declare enum ZoomSettingsScope {
	PER_ORIGIN = "per-origin",
	PER_TAB = "per-tab"
}
/**
 * Defines how zoom changes in a tab are handled and at what scope
 */
export interface ZoomSettings {
	/** Defines how zoom changes are handled */
	mode?: `${ZoomSettingsMode}`;
	/** Defines whether zoom changes persist for the page's origin */
	scope?: `${ZoomSettingsScope}`;
	/** Default zoom level for the current tab */
	defaultZoomFactor?: number;
}
/**
 * Represents information about a tab
 */
export interface Tab {
	/** The tab's loading status */
	status?: `${TabStatus}`;
	/** The zero-based index of the tab within its window */
	index: number;
	/** The ID of the tab that opened this tab, if any */
	openerTabId?: number;
	/** The title of the tab */
	title?: string;
	/** The last committed URL of the main frame of the tab */
	url?: string;
	/** The URL the tab is navigating to, before it has committed */
	pendingUrl?: string;
	/** Whether the tab is pinned */
	pinned: boolean;
	/** Whether the tab is highlighted */
	highlighted: boolean;
	/** The ID of the window that contains the tab */
	windowId: number;
	/** Whether the tab is active in its window */
	active: boolean;
	/** The URL of the tab's favicon */
	favIconUrl?: string;
	/** Whether the tab is frozen */
	frozen?: boolean;
	/** The ID of the tab */
	id?: number;
	/** Whether the tab is in an incognito window */
	incognito: boolean;
	/** Whether the tab is selected (deprecated) */
	selected?: boolean;
	/** Whether the tab has produced sound over the past couple of seconds */
	audible?: boolean;
	/** Whether the tab is discarded */
	discarded: boolean;
	/** Whether the tab can be discarded automatically by the browser */
	autoDiscardable: boolean;
	/** The tab's muted state and the reason for the last state change */
	mutedInfo?: MutedInfo;
	/** The width of the tab in pixels */
	width?: number;
	/** The height of the tab in pixels */
	height?: number;
	/** The session ID used to uniquely identify a tab */
	sessionId?: string;
	/** The ID of the group that the tab belongs to */
	groupId?: number;
	/** The last time the tab became active in its window as the number of milliseconds since epoch */
	lastAccessed?: number;
}
/**
 * Properties for creating a new tab
 */
export interface CreateProperties {
	/** The position the tab should take in the window */
	index?: number;
	/** The ID of the tab that opened this tab */
	openerTabId?: number;
	/** The URL to initially navigate the tab to */
	url?: string;
	/** Whether the tab should be pinned */
	pinned?: boolean;
	/** The window in which to create the new tab */
	windowId?: number;
	/** Whether the tab should become the active tab in the window */
	active?: boolean;
	/** Whether the tab should become the selected tab (deprecated) */
	selected?: boolean;
}
/**
 * Properties for updating a tab
 */
export interface UpdateProperties {
	/** Whether the tab should be pinned */
	pinned?: boolean;
	/** The ID of the tab that opened this tab */
	openerTabId?: number;
	/** A URL to navigate the tab to */
	url?: string;
	/** Adds or removes the tab from the current selection */
	highlighted?: boolean;
	/** Whether the tab should be active */
	active?: boolean;
	/** Whether the tab should be selected (deprecated) */
	selected?: boolean;
	/** Whether the tab should be muted */
	muted?: boolean;
	/** Whether the tab should be discarded automatically */
	autoDiscardable?: boolean;
}
/**
 * Properties for moving a tab
 */
export interface MoveProperties {
	/** The position to move the window to */
	index: number;
	/** Defaults to the window the tab is currently in */
	windowId?: number;
}
/**
 * Properties for reloading a tab
 */
export interface ReloadProperties {
	/** Whether to bypass local caching */
	bypassCache?: boolean;
}
/**
 * Query information for finding tabs
 */
export interface QueryInfo {
	/** The tab loading status */
	status?: `${TabStatus}`;
	/** Whether the tabs are in the last focused window */
	lastFocusedWindow?: boolean;
	/** The ID of the parent window */
	windowId?: number;
	/** The type of window the tabs are in */
	windowType?: `${WindowType}`;
	/** Whether the tabs are active in their windows */
	active?: boolean;
	/** The position of the tabs within their windows */
	index?: number;
	/** Match page titles against a pattern */
	title?: string;
	/** Match tabs against one or more URL patterns */
	url?: string | string[];
	/** Whether the tabs are in the current window */
	currentWindow?: boolean;
	/** Whether the tabs are highlighted */
	highlighted?: boolean;
	/** Whether the tabs are discarded */
	discarded?: boolean;
	/** Whether the tabs are frozen */
	frozen?: boolean;
	/** Whether the tabs can be discarded automatically */
	autoDiscardable?: boolean;
	/** Whether the tabs are pinned */
	pinned?: boolean;
	/** Whether the tabs are audible */
	audible?: boolean;
	/** Whether the tabs are muted */
	muted?: boolean;
	/** The ID of the group that the tabs are in */
	groupId?: number;
}
/**
 * Options for highlighting tabs
 */
export interface HighlightInfo {
	/** One or more tab indices to highlight */
	tabs: number | number[];
	/** The window that contains the tabs */
	windowId?: number;
}
/**
 * Options for grouping tabs
 */
export interface GroupOptions {
	/** Configurations for creating a group */
	createProperties?: {
		/** The window of the new group */
		windowId?: number;
	};
	/** The ID of the group to add the tabs to */
	groupId?: number;
	/** The tab ID or list of tab IDs to add to the specified group */
	tabIds?: number | number[];
}
/**
 * Tab information interface
 */
export interface TabInfo {
	url: string;
	title: string;
	tabId: number;
	windowId: number;
	isInCurrentWindow: boolean;
	isCurrentTab: boolean;
	active: boolean;
	pinned: boolean;
	audible: boolean;
	muted: boolean;
	incognito: boolean;
	status: "loading" | "complete";
	favIconUrl?: string;
	index: number;
}
/**
 * Constants
 */
export declare const TAB_ID_NONE = -1;
export declare const TAB_INDEX_NONE = -1;
declare class QevoTabs {
	private _debug;
	constructor(debug?: boolean);
	set debug(value: boolean);
	get debug(): boolean;
	private log;
	private error;
	/**
	 * Creates a new tab
	 *
	 * @param createProperties - Properties for the new tab
	 * @returns Promise that resolves with the created tab
	 *
	 * @example
	 * ```typescript
	 * const tab = await qevo.tabs.create({ url: 'https://example.com', active: true });
	 * console.log('Created tab:', tab.id);
	 * ```
	 */
	create(createProperties: CreateProperties): Promise<Tab>;
	/**
	 * Gets details about a specific tab
	 *
	 * @param tabId - The ID of the tab
	 * @returns Promise that resolves with the tab
	 *
	 * @example
	 * ```typescript
	 * const tab = await qevo.tabs.get(123);
	 * console.log('Tab URL:', tab.url);
	 * ```
	 */
	get(tabId: number): Promise<Tab>;
	/**
	 * Gets the current tab
	 *
	 * @returns Promise that resolves with the current tab
	 *
	 * @example
	 * ```typescript
	 * const currentTab = await qevo.tabs.getCurrent();
	 * console.log('Current tab:', currentTab.url);
	 * ```
	 */
	getCurrent(): Promise<Tab>;
	/**
	 * Gets all tabs that have the specified properties
	 *
	 * @param queryInfo - Query filters
	 * @returns Promise that resolves with array of matching tabs
	 *
	 * @example
	 * ```typescript
	 * // Get all tabs in current window
	 * const tabs = await qevo.tabs.query({ currentWindow: true });
	 *
	 * // Get active tab
	 * const [activeTab] = await qevo.tabs.query({ active: true, currentWindow: true });
	 *
	 * // Get all pinned tabs
	 * const pinnedTabs = await qevo.tabs.query({ pinned: true });
	 * ```
	 */
	query(queryInfo: QueryInfo): Promise<Tab[]>;
	/**
	 * Modifies the properties of a tab
	 *
	 * @param tabId - The ID of the tab to update
	 * @param updateProperties - Properties to update
	 * @returns Promise that resolves with the updated tab
	 *
	 * @example
	 * ```typescript
	 * // Navigate to a new URL
	 * await qevo.tabs.update(tabId, { url: 'https://example.com' });
	 *
	 * // Pin a tab
	 * await qevo.tabs.update(tabId, { pinned: true });
	 *
	 * // Mute a tab
	 * await qevo.tabs.update(tabId, { muted: true });
	 * ```
	 */
	update(tabId: number, updateProperties: UpdateProperties): Promise<Tab>;
	update(updateProperties: UpdateProperties): Promise<Tab>;
	/**
	 * Closes a single tab
	 *
	 * @param tabId - The tab ID to close
	 * @returns Promise that resolves when the tab is closed
	 *
	 * @example
	 * ```typescript
	 * await qevo.tabs.remove(123);
	 * ```
	 */
	remove(tabId: number): Promise<void>;
	/**
	 * Closes multiple tabs
	 *
	 * @param tabIds - Array of tab IDs to close
	 * @returns Promise that resolves when all tabs are closed
	 *
	 * @example
	 * ```typescript
	 * await qevo.tabs.remove([123, 456, 789]);
	 * ```
	 */
	remove(tabIds: number[]): Promise<void>;
	/**
	 * Duplicates a tab
	 *
	 * @param tabId - The ID of the tab to duplicate
	 * @returns Promise that resolves with the duplicated tab
	 *
	 * @example
	 * ```typescript
	 * const duplicatedTab = await qevo.tabs.duplicate(123);
	 * console.log('Duplicated tab:', duplicatedTab.id);
	 * ```
	 */
	duplicate(tabId: number): Promise<Tab>;
	/**
	 * Moves one or more tabs to a new position
	 *
	 * @param tabIds - The tab ID or array of tab IDs to move
	 * @param moveProperties - Properties specifying where to move the tabs
	 * @returns Promise that resolves with the moved tab(s)
	 *
	 * @example
	 * ```typescript
	 * // Move tab to end of window
	 * await qevo.tabs.move(123, { index: -1 });
	 *
	 * // Move tab to different window
	 * await qevo.tabs.move(123, { windowId: 456, index: 0 });
	 *
	 * // Move multiple tabs
	 * await qevo.tabs.move([123, 456], { index: 0 });
	 * ```
	 */
	move(tabId: number, moveProperties: MoveProperties): Promise<Tab>;
	move(tabIds: number[], moveProperties: MoveProperties): Promise<Tab[]>;
	/**
	 * Reload a tab
	 *
	 * @param tabId - The ID of the tab to reload (optional, defaults to current tab)
	 * @param reloadProperties - Properties specifying reload behavior
	 * @returns Promise that resolves when the tab is reloaded
	 *
	 * @example
	 * ```typescript
	 * // Reload current tab
	 * await qevo.tabs.reload();
	 *
	 * // Reload specific tab
	 * await qevo.tabs.reload(123);
	 *
	 * // Reload bypassing cache
	 * await qevo.tabs.reload(123, { bypassCache: true });
	 * ```
	 */
	reload(): Promise<void>;
	reload(tabId: number): Promise<void>;
	reload(tabId: number, reloadProperties: ReloadProperties): Promise<void>;
	/**
	 * Highlights the given tabs and focuses on the first of group
	 *
	 * @param highlightInfo - Properties specifying which tabs to highlight
	 * @returns Promise that resolves when the tabs are highlighted
	 *
	 * @example
	 * ```typescript
	 * // Highlight single tab
	 * await qevo.tabs.highlight({ tabs: 0 });
	 *
	 * // Highlight multiple tabs
	 * await qevo.tabs.highlight({ tabs: [0, 2, 4] });
	 * ```
	 */
	highlight(highlightInfo: HighlightInfo): Promise<any>;
	/**
	 * Discards an automatically selected tab from memory (Chrome only).
	 * The browser chooses which tab to discard.
	 *
	 * @returns Promise that resolves with the discarded tab, or undefined if no tab was discarded
	 *
	 * @example
	 * ```typescript
	 * const discardedTab = await qevo.tabs.discard();
	 * if (discardedTab) {
	 *   console.log('Tab discarded:', discardedTab.id);
	 * }
	 * ```
	 */
	discard(): Promise<Tab | undefined>;
	/**
	 * Discards a specific tab from memory (tab stays visible in tab strip)
	 *
	 * @param tabId - The ID of the tab to discard
	 * @returns Promise that resolves with the discarded tab
	 *
	 * @example
	 * ```typescript
	 * const discardedTab = await qevo.tabs.discard(123);
	 * console.log('Tab discarded:', discardedTab.discarded);
	 * ```
	 */
	discard(tabId: number): Promise<Tab | undefined>;
	/**
	 * Gets the current zoom factor of a specified tab
	 *
	 * @param tabId - The ID of the tab (optional, defaults to current tab)
	 * @returns Promise that resolves with the zoom factor
	 *
	 * @example
	 * ```typescript
	 * const zoom = await qevo.tabs.getZoom(123);
	 * console.log('Zoom level:', zoom); // e.g., 1.5 for 150%
	 * ```
	 */
	getZoom(): Promise<number>;
	getZoom(tabId: number): Promise<number>;
	/**
	 * Zooms a specified tab
	 *
	 * @param tabId - The ID of the tab (optional, defaults to current tab)
	 * @param zoomFactor - The new zoom factor (1.0 = 100%)
	 * @returns Promise that resolves when the zoom is set
	 *
	 * @example
	 * ```typescript
	 * // Zoom to 150%
	 * await qevo.tabs.setZoom(123, 1.5);
	 *
	 * // Zoom current tab to 75%
	 * await qevo.tabs.setZoom(0.75);
	 * ```
	 */
	setZoom(tabId: number | undefined, zoomFactor: number): Promise<void>;
	setZoom(zoomFactor: number): Promise<void>;
	/**
	 * Gets the zoom settings of a specified tab
	 *
	 * @param tabId - The ID of the tab (optional, defaults to current tab)
	 * @returns Promise that resolves with the zoom settings
	 *
	 * @example
	 * ```typescript
	 * const settings = await qevo.tabs.getZoomSettings(123);
	 * console.log('Zoom mode:', settings.mode);
	 * console.log('Zoom scope:', settings.scope);
	 * ```
	 */
	getZoomSettings(): Promise<ZoomSettings>;
	getZoomSettings(tabId: number): Promise<ZoomSettings>;
	/**
	 * Sets the zoom settings for a specified tab
	 *
	 * @param tabId - The ID of the tab (optional, defaults to current tab)
	 * @param zoomSettings - The zoom settings to apply
	 * @returns Promise that resolves when the settings are applied
	 *
	 * @example
	 * ```typescript
	 * await qevo.tabs.setZoomSettings(123, {
	 *   mode: 'automatic',
	 *   scope: 'per-origin'
	 * });
	 * ```
	 */
	setZoomSettings(tabId: number | undefined, zoomSettings: ZoomSettings): Promise<void>;
	setZoomSettings(zoomSettings: ZoomSettings): Promise<void>;
	/**
	 * Gets all tabs
	 *
	 * @returns Promise that resolves with array of all tabs
	 *
	 * @example
	 * ```typescript
	 * const allTabs = await qevo.tabs.getAll();
	 * console.log('Total tabs:', allTabs.length);
	 * ```
	 */
	getAll(): Promise<Tab[]>;
	/**
	 * Gets all tabs in the current window
	 *
	 * @returns Promise that resolves with array of tabs in current window
	 *
	 * @example
	 * ```typescript
	 * const windowTabs = await qevo.tabs.getAllInCurrentWindow();
	 * ```
	 */
	getAllInCurrentWindow(): Promise<Tab[]>;
	/**
	 * Gets the active tab in the current window
	 *
	 * @returns Promise that resolves with the active tab
	 *
	 * @example
	 * ```typescript
	 * const activeTab = await qevo.tabs.getActive();
	 * console.log('Active tab URL:', activeTab.url);
	 * ```
	 */
	getActive(): Promise<Tab | undefined>;
	/**
	 * Find a tab by URL
	 *
	 * @param url - The URL to search for
	 * @returns Promise that resolves with the matching tab or undefined
	 *
	 * @example
	 * ```typescript
	 * const tab = await qevo.tabs.findByUrl('https://example.com');
	 * if (tab) {
	 *   console.log('Found tab:', tab.id);
	 * }
	 * ```
	 */
	findByUrl(url: string): Promise<Tab | undefined>;
	/**
	 * Find a tab by title
	 *
	 * @param title - The title to search for
	 * @returns Promise that resolves with the matching tab or undefined
	 *
	 * @example
	 * ```typescript
	 * const tab = await qevo.tabs.findByTitle('Example');
	 * if (tab) {
	 *   console.log('Found tab:', tab.url);
	 * }
	 * ```
	 */
	findByTitle(title: string): Promise<Tab | undefined>;
	/**
	 * Navigate to the previous page in current tab's history
	 */
	goBack(): Promise<void>;
	/**
	 * Navigate to the previous page in specified tab's history
	 * @param tabId - Tab ID to navigate back
	 */
	goBack(tabId: number): Promise<void>;
	/**
	 * Navigate to the next page in current tab's history
	 */
	goForward(): Promise<void>;
	/**
	 * Navigate to the next page in specified tab's history
	 * @param tabId - Tab ID to navigate forward
	 */
	goForward(tabId: number): Promise<void>;
	/**
	 * Add tabs to a group or create a new group
	 * @param options - Group options
	 * @returns Group ID
	 */
	group(options: {
		tabIds: number | number[];
		groupId?: number;
		createProperties?: {
			windowId?: number;
		};
	}): Promise<number>;
	/**
	 * Remove a single tab from its group
	 * @param tabId - Tab ID to ungroup
	 */
	ungroup(tabId: number): Promise<void>;
	/**
	 * Remove multiple tabs from their groups
	 * @param tabIds - Array of tab IDs to ungroup
	 */
	ungroup(tabIds: number[]): Promise<void>;
	/**
	 * Capture visible content of active window as a data URL
	 * @returns Data URL of captured image
	 */
	captureVisibleTab(): Promise<string>;
	/**
	 * Capture visible content of active window with options
	 * @param options - Capture options
	 * @returns Data URL of captured image
	 */
	captureVisibleTab(options: {
		format?: "jpeg" | "png";
		quality?: number;
	}): Promise<string>;
	/**
	 * Capture visible content of a specific window
	 * @param windowId - Window ID
	 * @param options - Capture options
	 * @returns Data URL of captured image
	 */
	captureVisibleTab(windowId: number, options?: {
		format?: "jpeg" | "png";
		quality?: number;
	}): Promise<string>;
	/**
	 * Detect the primary language of content in current tab
	 * @returns ISO language code (e.g., 'en', 'fr', 'es')
	 */
	detectLanguage(): Promise<string>;
	/**
	 * Detect the primary language of content in a specific tab
	 * @param tabId - Tab ID
	 * @returns ISO language code (e.g., 'en', 'fr', 'es')
	 */
	detectLanguage(tabId: number): Promise<string>;
	/**
	 * Connect to content script in a tab
	 * @param tabId - Tab ID
	 * @param connectInfo - Connection info (optional)
	 * @returns Port for communication
	 */
	connect(tabId: number, connectInfo?: {
		name?: string;
		frameId?: number;
	}): chrome.runtime.Port;
	/**
	 * Send a message to a content script in a tab
	 *
	 * @param tabId - Tab ID to send message to
	 * @param message - Message to send
	 * @returns Promise that resolves with the response from the content script
	 *
	 * @example
	 * ```typescript
	 * const response = await qevo.tabs.sendMessage(123, { action: 'getData' });
	 * console.log('Response:', response);
	 * ```
	 */
	sendMessage<M = any, R = any>(tabId: number, message: M): Promise<R>;
	/**
	 * Send a message to a content script in a specific frame
	 *
	 * @param tabId - Tab ID to send message to
	 * @param message - Message to send
	 * @param options - Options including frameId and documentId
	 * @returns Promise that resolves with the response from the content script
	 *
	 * @example
	 * ```typescript
	 * const response = await qevo.tabs.sendMessage(123, { action: 'getData' }, { frameId: 0 });
	 * console.log('Response:', response);
	 * ```
	 */
	sendMessage<M = any, R = any>(tabId: number, message: M, options: {
		frameId?: number;
		documentId?: string;
	}): Promise<R>;
	/**
	 * Get URL of a specific tab
	 * @param tabId - Tab ID
	 * @returns Tab URL or undefined
	 */
	getUrl(tabId: number): Promise<string | undefined>;
	/**
	 * Get title of a specific tab
	 * @param tabId - Tab ID
	 * @returns Tab title or undefined
	 */
	getTitle(tabId: number): Promise<string | undefined>;
	/**
	 * Get favicon URL of a specific tab
	 * @param tabId - Tab ID
	 * @returns Favicon URL or undefined
	 */
	getFavIcon(tabId: number): Promise<string | undefined>;
	/**
	 * Get window ID of a specific tab
	 * @param tabId - Tab ID
	 * @returns Window ID
	 */
	getWindow(tabId: number): Promise<number>;
	/**
	 * Fired when the active tab in a window changes
	 */
	onActivated: {
		addListener: (callback: (activeInfo: {
			tabId: number;
			windowId: number;
		}) => void) => void;
		removeListener: (callback: (activeInfo: {
			tabId: number;
			windowId: number;
		}) => void) => void;
		hasListener: (callback: (activeInfo: {
			tabId: number;
			windowId: number;
		}) => void) => boolean;
	};
	/**
	 * Fired when a tab is attached to a window
	 */
	onAttached: {
		addListener: (callback: (tabId: number, attachInfo: {
			newWindowId: number;
			newPosition: number;
		}) => void) => void;
		removeListener: (callback: (tabId: number, attachInfo: {
			newWindowId: number;
			newPosition: number;
		}) => void) => void;
		hasListener: (callback: (tabId: number, attachInfo: {
			newWindowId: number;
			newPosition: number;
		}) => void) => boolean;
	};
	/**
	 * Fired when a tab is created
	 */
	onCreated: {
		addListener: (callback: (tab: Tab) => void) => void;
		removeListener: (callback: (tab: Tab) => void) => void;
		hasListener: (callback: (tab: Tab) => void) => boolean;
	};
	/**
	 * Fired when a tab is detached from a window
	 */
	onDetached: {
		addListener: (callback: (tabId: number, detachInfo: {
			oldWindowId: number;
			oldPosition: number;
		}) => void) => void;
		removeListener: (callback: (tabId: number, detachInfo: {
			oldWindowId: number;
			oldPosition: number;
		}) => void) => void;
		hasListener: (callback: (tabId: number, detachInfo: {
			oldWindowId: number;
			oldPosition: number;
		}) => void) => boolean;
	};
	/**
	 * Fired when the highlighted or selected tabs in a window changes
	 */
	onHighlighted: {
		addListener: (callback: (highlightInfo: {
			windowId: number;
			tabIds: number[];
		}) => void) => void;
		removeListener: (callback: (highlightInfo: {
			windowId: number;
			tabIds: number[];
		}) => void) => void;
		hasListener: (callback: (highlightInfo: {
			windowId: number;
			tabIds: number[];
		}) => void) => boolean;
	};
	/**
	 * Fired when a tab is moved within a window
	 */
	onMoved: {
		addListener: (callback: (tabId: number, moveInfo: {
			windowId: number;
			fromIndex: number;
			toIndex: number;
		}) => void) => void;
		removeListener: (callback: (tabId: number, moveInfo: {
			windowId: number;
			fromIndex: number;
			toIndex: number;
		}) => void) => void;
		hasListener: (callback: (tabId: number, moveInfo: {
			windowId: number;
			fromIndex: number;
			toIndex: number;
		}) => void) => boolean;
	};
	/**
	 * Fired when a tab is closed
	 */
	onRemoved: {
		addListener: (callback: (tabId: number, removeInfo: {
			windowId: number;
			isWindowClosing: boolean;
		}) => void) => void;
		removeListener: (callback: (tabId: number, removeInfo: {
			windowId: number;
			isWindowClosing: boolean;
		}) => void) => void;
		hasListener: (callback: (tabId: number, removeInfo: {
			windowId: number;
			isWindowClosing: boolean;
		}) => void) => boolean;
	};
	/**
	 * Fired when a tab is replaced with another tab due to prerendering or instant
	 */
	onReplaced: {
		addListener: (callback: (addedTabId: number, removedTabId: number) => void) => void;
		removeListener: (callback: (addedTabId: number, removedTabId: number) => void) => void;
		hasListener: (callback: (addedTabId: number, removedTabId: number) => void) => boolean;
	};
	/**
	 * Fired when a tab is updated
	 */
	onUpdated: {
		addListener: (callback: (tabId: number, changeInfo: any, tab: Tab) => void) => void;
		removeListener: (callback: (tabId: number, changeInfo: any, tab: Tab) => void) => void;
		hasListener: (callback: (tabId: number, changeInfo: any, tab: Tab) => void) => boolean;
	};
	/**
	 * Fired when a tab is zoomed
	 */
	onZoomChange: {
		addListener: (callback: (zoomChangeInfo: {
			tabId: number;
			oldZoomFactor: number;
			newZoomFactor: number;
			zoomSettings: ZoomSettings;
		}) => void) => void;
		removeListener: (callback: (zoomChangeInfo: {
			tabId: number;
			oldZoomFactor: number;
			newZoomFactor: number;
			zoomSettings: ZoomSettings;
		}) => void) => void;
		hasListener: (callback: (zoomChangeInfo: {
			tabId: number;
			oldZoomFactor: number;
			newZoomFactor: number;
			zoomSettings: ZoomSettings;
		}) => void) => boolean;
	};
}
/**
 * Cookie Types
 * All types and interfaces for the Cookies API
 * Matches chrome.cookies API exactly
 */
/**
 * A cookie's 'SameSite' state
 * @see https://tools.ietf.org/html/draft-west-first-party-cookies
 */
export declare enum SameSiteStatus {
	NO_RESTRICTION = "no_restriction",
	LAX = "lax",
	STRICT = "strict",
	UNSPECIFIED = "unspecified"
}
/**
 * The underlying reason behind the cookie's change
 * @since Chrome 44
 */
export declare enum OnChangedCause {
	EVICTED = "evicted",
	EXPIRED = "expired",
	EXPLICIT = "explicit",
	EXPIRED_OVERWRITE = "expired_overwrite",
	OVERWRITE = "overwrite"
}
/**
 * Represents a partitioned cookie's partition key
 * @since Chrome 119
 */
export interface CookiePartitionKey {
	/**
	 * Indicates if the cookie was set in a cross-site context
	 * @since Chrome 130
	 */
	hasCrossSiteAncestor?: boolean;
	/** The top-level site the partitioned cookie is available in */
	topLevelSite?: string;
}
/**
 * Represents a cookie store in the browser
 */
interface CookieStore$1 {
	/** The unique identifier for the cookie store */
	id: string;
	/** Identifiers of all the browser tabs that share this cookie store */
	tabIds: number[];
}
/**
 * Represents information about an HTTP cookie
 */
export interface Cookie {
	/** The domain of the cookie (e.g. "www.google.com", "example.com") */
	domain: string;
	/** The name of the cookie */
	name: string;
	/**
	 * The partition key for reading or modifying cookies with the Partitioned attribute
	 * @since Chrome 119
	 */
	partitionKey?: CookiePartitionKey;
	/** The ID of the cookie store containing this cookie */
	storeId: string;
	/** The value of the cookie */
	value: string;
	/** True if the cookie is a session cookie, as opposed to a persistent cookie with an expiration date */
	session: boolean;
	/** True if the cookie is a host-only cookie (i.e. a request's host must exactly match the domain of the cookie) */
	hostOnly: boolean;
	/** The expiration date of the cookie as the number of seconds since the UNIX epoch. Not provided for session cookies */
	expirationDate?: number;
	/** The path of the cookie */
	path: string;
	/** True if the cookie is marked as HttpOnly (i.e. the cookie is inaccessible to client-side scripts) */
	httpOnly: boolean;
	/** True if the cookie is marked as Secure (i.e. its scope is limited to secure channels, typically HTTPS) */
	secure: boolean;
	/**
	 * The cookie's same-site status
	 * @since Chrome 51
	 */
	sameSite: `${SameSiteStatus}`;
}
/**
 * Details to identify the cookie
 * @since Chrome 88
 */
export interface CookieDetails {
	/** The name of the cookie to access */
	name: string;
	/**
	 * The partition key for reading or modifying cookies with the Partitioned attribute
	 * @since Chrome 119
	 */
	partitionKey?: CookiePartitionKey;
	/** The ID of the cookie store in which to look for the cookie. By default, the current execution context's cookie store will be used */
	storeId?: string;
	/** The URL with which the cookie to access is associated. This argument may be a full URL, in which case any data following the URL path (e.g. the query string) is simply ignored */
	url: string;
}
/**
 * Details for getting all cookies (GetAllDetails)
 */
export interface GetAllDetails {
	/** Restricts the retrieved cookies to those whose domains match or are subdomains of this one */
	domain?: string;
	/** Filters the cookies by name */
	name?: string;
	/**
	 * The partition key for reading or modifying cookies with the Partitioned attribute
	 * @since Chrome 119
	 */
	partitionKey?: CookiePartitionKey;
	/** Restricts the retrieved cookies to those that would match the given URL */
	url?: string;
	/** The cookie store to retrieve cookies from. If omitted, the current execution context's cookie store will be used */
	storeId?: string;
	/** Filters out session vs. persistent cookies */
	session?: boolean;
	/** Restricts the retrieved cookies to those whose path exactly matches this string */
	path?: string;
	/** Filters the cookies by their Secure property */
	secure?: boolean;
}
/**
 * Details for setting a cookie (SetDetails)
 */
export interface SetDetails {
	/** The domain of the cookie. If omitted, the cookie becomes a host-only cookie */
	domain?: string;
	/** The name of the cookie. Empty by default if omitted */
	name?: string;
	/**
	 * The partition key for reading or modifying cookies with the Partitioned attribute
	 * @since Chrome 119
	 */
	partitionKey?: CookiePartitionKey;
	/** The request-URI to associate with the setting of the cookie. This value can affect the default domain and path values of the created cookie */
	url: string;
	/** The ID of the cookie store in which to set the cookie. By default, the cookie is set in the current execution context's cookie store */
	storeId?: string;
	/** The value of the cookie. Empty by default if omitted */
	value?: string;
	/** The expiration date of the cookie as the number of seconds since the UNIX epoch. If omitted, the cookie becomes a session cookie */
	expirationDate?: number;
	/** The path of the cookie. Defaults to the path portion of the url parameter */
	path?: string;
	/** Whether the cookie should be marked as HttpOnly. Defaults to false */
	httpOnly?: boolean;
	/** Whether the cookie should be marked as Secure. Defaults to false */
	secure?: boolean;
	/**
	 * The cookie's same-site status. Defaults to "unspecified", i.e., if omitted, the cookie is set without specifying a SameSite attribute
	 * @since Chrome 51
	 */
	sameSite?: `${SameSiteStatus}`;
}
/**
 * Information about a cookie that was changed
 */
export interface CookieChangeInfo {
	/** Information about the cookie that was set or removed */
	cookie: Cookie;
	/** True if a cookie was removed */
	removed: boolean;
	/** The underlying reason behind the cookie's change */
	cause: `${OnChangedCause}`;
}
/**
 * Cookie change listener callback
 */
export type CookieChangeListener = (changeInfo: CookieChangeInfo) => void;
/**
 * Cookies API interface (matches chrome.cookies exactly)
 */
export interface CookiesAPI {
	/**
	 * Retrieves information about a single cookie
	 * Can return its result via Promise in Manifest V3 or later
	 */
	get(details: CookieDetails): Promise<Cookie | null>;
	/**
	 * Retrieves all cookies from a single cookie store that match the given information
	 * Can return its result via Promise in Manifest V3 or later
	 */
	getAll(details: GetAllDetails): Promise<Cookie[]>;
	/**
	 * Sets a cookie with the given cookie data
	 * Can return its result via Promise in Manifest V3 or later
	 */
	set(details: SetDetails): Promise<Cookie | null>;
	/**
	 * Deletes a cookie by name
	 * Can return its result via Promise in Manifest V3 or later
	 */
	remove(details: CookieDetails): Promise<CookieDetails>;
	/**
	 * Lists all existing cookie stores
	 * Can return its result via Promise in Manifest V3 or later
	 */
	getAllCookieStores(): Promise<CookieStore$1[]>;
	/**
	 * Fired when a cookie is set or removed
	 */
	onChanged: {
		addListener(callback: CookieChangeListener): void;
		removeListener(callback: CookieChangeListener): void;
		hasListener(callback: CookieChangeListener): boolean;
	};
}
declare class QevoLogger {
	protected _debug: boolean;
	constructor(debug?: boolean);
	set debug(value: boolean);
	get debug(): boolean;
	protected log(prefix: string, ...args: any[]): void;
	protected error(prefix: string, ...args: any[]): void;
	protected warn(prefix: string, ...args: any[]): void;
}
declare class QevoCookies extends QevoLogger {
	private cookieChangeListeners;
	private browserListenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Retrieve a single cookie by URL and name
	 *
	 * @param details - Cookie identification details
	 * @param details.url - URL associated with the cookie
	 * @param details.name - Name of the cookie
	 * @param details.storeId - Optional cookie store ID (for incognito, etc.)
	 *
	 * @returns The cookie if found, null otherwise
	 *
	 * @example
	 * ```typescript
	 * const cookie = await cookies.get({
	 *   url: 'https://example.com',
	 *   name: 'session'
	 * });
	 *
	 * if (cookie) {
	 *   console.log('Cookie value:', cookie.value);
	 *   console.log('HttpOnly:', cookie.httpOnly);
	 *   console.log('Secure:', cookie.secure);
	 * }
	 * ```
	 */
	get(details: CookieDetails): Promise<Cookie | null>;
	/**
	 * Retrieve all cookies matching the specified criteria
	 *
	 * @param details - Filter criteria for cookies
	 * @param details.url - URL to match (filters by domain and path)
	 * @param details.domain - Domain to match
	 * @param details.name - Cookie name to match
	 * @param details.path - Path to match
	 * @param details.secure - Filter by secure flag
	 * @param details.session - Filter by session cookies
	 * @param details.storeId - Cookie store ID
	 *
	 * @returns Array of matching cookies (empty array if none found)
	 *
	 * @example Get all cookies for a domain
	 * ```typescript
	 * const cookies = await cookies.getAll({ domain: 'example.com' });
	 * cookies.forEach(c => console.log(`${c.name}=${c.value}`));
	 * ```
	 *
	 * @example Get all secure cookies
	 * ```typescript
	 * const secureCookies = await cookies.getAll({ secure: true });
	 * ```
	 *
	 * @example Get all session cookies
	 * ```typescript
	 * const sessionCookies = await cookies.getAll({ session: true });
	 * ```
	 */
	getAll(details: GetAllDetails): Promise<Cookie[]>;
	/**
	 * Set a cookie with the specified properties
	 *
	 * @param details - Cookie properties to set
	 * @param details.url - URL to associate with the cookie (required)
	 * @param details.name - Cookie name
	 * @param details.value - Cookie value
	 * @param details.domain - Cookie domain
	 * @param details.path - Cookie path (default: '/')
	 * @param details.secure - Whether cookie requires HTTPS
	 * @param details.httpOnly - Whether cookie is HTTP-only
	 * @param details.sameSite - SameSite policy ('lax', 'strict', 'no_restriction')
	 * @param details.expirationDate - Expiration as Unix timestamp (seconds)
	 * @param details.storeId - Cookie store ID
	 *
	 * @returns The created cookie, or null on failure
	 *
	 * @example Set a simple cookie
	 * ```typescript
	 * await cookies.set({
	 *   url: 'https://example.com',
	 *   name: 'preference',
	 *   value: 'dark'
	 * });
	 * ```
	 *
	 * @example Set a cookie with expiration
	 * ```typescript
	 * await cookies.set({
	 *   url: 'https://example.com',
	 *   name: 'auth_token',
	 *   value: 'abc123',
	 *   secure: true,
	 *   httpOnly: true,
	 *   sameSite: 'strict',
	 *   expirationDate: Math.floor(Date.now() / 1000) + 3600 // 1 hour
	 * });
	 * ```
	 */
	set(details: SetDetails): Promise<Cookie | null>;
	/**
	 * Remove a cookie by URL and name
	 *
	 * @param details - Cookie identification details
	 * @param details.url - URL associated with the cookie
	 * @param details.name - Name of the cookie to remove
	 * @param details.storeId - Optional cookie store ID
	 *
	 * @returns The details of the removed cookie
	 * @throws Error if removal fails
	 *
	 * @example
	 * ```typescript
	 * await cookies.remove({
	 *   url: 'https://example.com',
	 *   name: 'session'
	 * });
	 * console.log('Cookie removed');
	 * ```
	 */
	remove(details: CookieDetails): Promise<CookieDetails>;
	/**
	 * Get all available cookie stores
	 *
	 * Cookie stores correspond to different browsing contexts:
	 * - Default store for normal browsing
	 * - Separate stores for incognito/private windows
	 * - Container tabs in Firefox
	 *
	 * @returns Array of cookie stores with their IDs and associated tab IDs
	 *
	 * @example
	 * ```typescript
	 * const stores = await cookies.getAllCookieStores();
	 * stores.forEach(store => {
	 *   console.log(`Store: ${store.id}`);
	 *   console.log(`Tabs: ${store.tabIds.join(', ')}`);
	 * });
	 * ```
	 */
	getAllCookieStores(): Promise<CookieStore$1[]>;
	/**
	 * Add a listener for cookie changes (internal)
	 * @internal
	 */
	private addListener;
	/**
	 * Remove a listener for cookie changes (internal)
	 * @internal
	 */
	private removeListener;
	/**
	 * Check if a listener exists (internal)
	 * @internal
	 */
	private hasListener;
	/**
	 * Initialize the browser cookie change listener (called once)
	 * @internal
	 */
	private initializeBrowserListener;
	/**
	 * Get the full Cookies API interface
	 *
	 * Returns an object containing all cookie methods and the onChanged
	 * event listener interface for compatibility with native API patterns.
	 *
	 * @returns Complete CookiesAPI interface
	 *
	 * @example
	 * ```typescript
	 * const cookiesAPI = cookies.api;
	 *
	 * // Use the API
	 * const cookie = await cookiesAPI.get({ url: 'https://example.com', name: 'test' });
	 *
	 * // Listen for changes
	 * cookiesAPI.onChanged.addListener((changeInfo) => {
	 *   console.log(`Cookie ${changeInfo.cookie.name} was ${changeInfo.removed ? 'removed' : 'set'}`);
	 * });
	 * ```
	 */
	get api(): CookiesAPI;
}
/**
 * Message Types
 * All types and interfaces for the Messaging API
 */
/**
 * Message response - Success case
 */
export interface MessageResponseSuccess<T = any> {
	success: true;
	data: T;
	timestamp: number;
	messageId: string;
	duration: number;
}
/**
 * Message response - Error case
 */
export interface MessageResponseError {
	success: false;
	error: string;
	timestamp: number;
	messageId: string;
	duration: number;
}
/**
 * Message response - Discriminated union
 */
export type MessageResponse<T = any> = MessageResponseSuccess<T> | MessageResponseError;
/**
 * Enhanced message options for sending messages with better control
 */
export interface MessageOptions {
	/** Timeout in milliseconds (default: 5000) */
	timeout?: number;
	/** Number of retry attempts (default: 0) */
	retries?: number;
	/** Delay between retries in milliseconds (default: 1000) */
	retryDelay?: number;
	/** Whether to expect a response (default: true) */
	expectResponse?: boolean;
	/** Priority level for message handling (default: 'normal') */
	priority?: "low" | "normal" | "high";
}
/**
 * Message sender information
 */
export interface MessageSender {
	/** The ID of the extension that sent the message */
	id?: string;
	/** The URL of the page or frame that opened the connection */
	url?: string;
	/** The tabs.Tab which opened the connection */
	tab?: any;
	/** The frame that opened the connection */
	frameId?: number;
	/** The TLS channel ID of the page or frame that opened the connection */
	tlsChannelId?: string;
}
/**
 * Message listener callback type
 */
export type MessageListener<T = any, R = any> = (message: T, sender: MessageSender, sendResponse: <TResponse extends R>(response: TResponse) => void) => void | Promise<void> | boolean | Promise<boolean>;
/**
 * Pending message for tracking async responses
 */
export interface PendingMessage<T = any> {
	id: string;
	resolve: (response: MessageResponse<T>) => void;
	reject: (error: Error) => void;
	timestamp: number;
	timeout: NodeJS.Timeout;
	options: MessageOptions;
}
/**
 * Message API interface for unified message handling
 */
export interface MessageAPI {
	/**
	 * Add a message listener for a specific message type
	 */
	on<T = any, R = any>(messageType: string, listener: MessageListener<T, R>): void;
	/**
	 * Remove a message listener for a specific message type
	 */
	off<T = any, R = any>(messageType: string, listener: MessageListener<T, R>): void;
	/**
	 * Remove all listeners for a specific message type
	 */
	clear(messageType: string): void;
	/**
	 * Get all registered message types
	 */
	getTypes(): string[];
	/**
	 * Check if there are listeners for a specific message type
	 */
	hasListeners(messageType: string): boolean;
}
declare class QevoMessages extends QevoLogger {
	private messageListeners;
	private listenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Initialize the global message listener
	 */
	private initializeGlobalListener;
	/**
	 * Register a message listener for a specific message type
	 *
	 * The listener will be called when a message with the matching type is received.
	 * Listeners can be synchronous or asynchronous - async listeners are automatically
	 * handled and the message channel is kept open until the response is sent.
	 *
	 * @template T - Type of the incoming message data
	 * @template R - Type of the response data
	 *
	 * @param messageType - Unique identifier for the message type to listen for
	 * @param listener - Callback function to handle the message
	 *
	 * @example Synchronous listener
	 * ```typescript
	 * messages.on('getVersion', (data, sender, sendResponse) => {
	 *   sendResponse({ version: '1.0.0' });
	 * });
	 * ```
	 *
	 * @example Async listener
	 * ```typescript
	 * messages.on<{ userId: number }, User>('getUser', async (data, sender, sendResponse) => {
	 *   const user = await fetchUser(data.userId);
	 *   sendResponse(user);
	 * });
	 * ```
	 *
	 * @example With sender information
	 * ```typescript
	 * messages.on('logAction', (data, sender, sendResponse) => {
	 *   console.log(`Action from tab ${sender.tab?.id}:`, data);
	 *   sendResponse({ logged: true });
	 * });
	 * ```
	 */
	on<T = any, R = any>(messageType: string, listener: MessageListener<T, R>): void;
	/**
	 * Remove a specific message listener
	 *
	 * Removes the exact listener function that was previously registered with `on()`.
	 * If the listener is not found, this method does nothing.
	 *
	 * @template T - Type of the incoming message data
	 * @template R - Type of the response data
	 *
	 * @param messageType - The message type the listener was registered for
	 * @param listener - The exact listener function to remove
	 *
	 * @example
	 * ```typescript
	 * const handler = (data, sender, sendResponse) => {
	 *   sendResponse({ handled: true });
	 * };
	 *
	 * // Add listener
	 * messages.on('myEvent', handler);
	 *
	 * // Later, remove it
	 * messages.off('myEvent', handler);
	 * ```
	 */
	off<T = any, R = any>(messageType: string, listener: MessageListener<T, R>): void;
	/**
	 * Remove all listeners for a specific message type
	 *
	 * Clears all registered listeners for the given message type.
	 * Useful for cleanup or when you want to reset all handlers.
	 *
	 * @param messageType - The message type to clear all listeners for
	 *
	 * @example
	 * ```typescript
	 * // Remove all handlers for 'userData' messages
	 * messages.clear('userData');
	 *
	 * // Verify no listeners remain
	 * console.log(messages.hasListeners('userData')); // false
	 * ```
	 */
	clear(messageType: string): void;
	/**
	 * Get all registered message types
	 *
	 * Returns an array of all message type identifiers that have at least
	 * one listener registered.
	 *
	 * @returns Array of registered message type strings
	 *
	 * @example
	 * ```typescript
	 * messages.on('ping', handler1);
	 * messages.on('fetchData', handler2);
	 * messages.on('saveData', handler3);
	 *
	 * const types = messages.getTypes();
	 * console.log(types); // ['ping', 'fetchData', 'saveData']
	 * ```
	 */
	getTypes(): string[];
	/**
	 * Check if there are listeners registered for a message type
	 *
	 * @param messageType - The message type to check
	 * @returns `true` if at least one listener is registered, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * if (messages.hasListeners('criticalEvent')) {
	 *   // Safe to send message
	 *   await messages.sendToBackground('criticalEvent', data);
	 * } else {
	 *   console.warn('No handlers registered for criticalEvent');
	 * }
	 * ```
	 */
	hasListeners(messageType: string): boolean;
	/**
	 * Send a message to the background script
	 *
	 * Sends a typed message to the background script and awaits a response.
	 * Supports timeout and retry mechanisms for reliability.
	 *
	 * @template Response - Expected type of the response data
	 * @template Data - Type of the data payload to send
	 *
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options for the message
	 * @param options.timeout - Maximum time to wait for response in ms (default: 5000)
	 * @param options.retries - Number of retry attempts on failure (default: 0)
	 * @param options.retryDelay - Delay between retries in ms (default: 1000)
	 *
	 * @returns Promise resolving to a MessageResponse containing success status and data/error
	 *
	 * @example Basic usage
	 * ```typescript
	 * const response = await messages.sendToBackground('getSettings');
	 * if (response.success) {
	 *   console.log('Settings:', response.data);
	 * } else {
	 *   console.error('Error:', response.error);
	 * }
	 * ```
	 *
	 * @example With typed data
	 * ```typescript
	 * interface UserRequest { userId: number; }
	 * interface UserResponse { name: string; email: string; }
	 *
	 * const response = await messages.sendToBackground<UserResponse, UserRequest>(
	 *   'getUser',
	 *   { userId: 123 }
	 * );
	 * ```
	 *
	 * @example With options
	 * ```typescript
	 * const response = await messages.sendToBackground('slowOperation', data, {
	 *   timeout: 30000,  // 30 second timeout
	 *   retries: 3,      // Retry up to 3 times
	 *   retryDelay: 2000 // Wait 2 seconds between retries
	 * });
	 * ```
	 */
	sendToBackground<Response = any, Data = any>(messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>>;
	/**
	 * Send a message to a specific tab
	 *
	 * Sends a typed message to a content script running in the specified tab.
	 * The tab must have a content script loaded that is listening for messages.
	 *
	 * @template Response - Expected type of the response data
	 * @template Data - Type of the data payload to send
	 *
	 * @param tabId - The ID of the tab to send the message to
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options for the message
	 *
	 * @returns Promise resolving to a MessageResponse containing success status and data/error
	 *
	 * @example
	 * ```typescript
	 * // Get the active tab first
	 * const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	 *
	 * // Send message to the tab
	 * const response = await messages.sendToTab(tab.id, 'highlightText', {
	 *   text: 'search term',
	 *   color: 'yellow'
	 * });
	 *
	 * if (response.success) {
	 *   console.log('Highlighted', response.data.count, 'occurrences');
	 * }
	 * ```
	 */
	sendToTab<Response = any, Data = any>(tabId: number, messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>>;
	/**
	 * Send a message to all open tabs
	 *
	 * Broadcasts a message to content scripts in all tabs. Returns an array
	 * of responses, one for each tab. Tabs without content scripts or that
	 * fail to respond will have error responses.
	 *
	 * @template Response - Expected type of the response data from each tab
	 * @template Data - Type of the data payload to send
	 *
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options for the message
	 *
	 * @returns Promise resolving to an array of MessageResponses, one per tab
	 *
	 * @example
	 * ```typescript
	 * // Notify all tabs to refresh their data
	 * const responses = await messages.sendToAllTabs('refreshData', { force: true });
	 *
	 * const successCount = responses.filter(r => r.success).length;
	 * console.log(`${successCount}/${responses.length} tabs refreshed successfully`);
	 * ```
	 */
	sendToAllTabs<Response = any, Data = any>(messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>[]>;
	/**
	 * Broadcast a message to all tabs
	 *
	 * Alias for `sendToAllTabs()`. Broadcasts a message to content scripts
	 * in all open tabs.
	 *
	 * @template Response - Expected type of the response data from each tab
	 * @template Data - Type of the data payload to send
	 *
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options for the message
	 *
	 * @returns Promise resolving to an array of MessageResponses, one per tab
	 *
	 * @example
	 * ```typescript
	 * // Broadcast theme change to all tabs
	 * const responses = await messages.broadcast('themeChanged', {
	 *   theme: 'dark',
	 *   timestamp: Date.now()
	 * });
	 * ```
	 */
	broadcast<Response = any, Data = any>(messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>[]>;
	/**
	 * Send a message to the background script
	 *
	 * Sends a typed message to the background script and awaits a response.
	 * Use this when communicating from content scripts, popups, or other
	 * extension pages to the background service worker.
	 *
	 * @template Response - Expected type of the response data
	 * @template Data - Type of the data payload to send
	 *
	 * @param target - Must be `'background'` to send to the background script
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options (timeout, retries, retryDelay)
	 *
	 * @returns Promise resolving to a MessageResponse containing success status and data/error
	 *
	 * @example
	 * ```typescript
	 * // Send message to background script
	 * const response = await messages.sendMessage('background', 'getSettings');
	 * if (response.success) {
	 *   console.log('Settings:', response.data);
	 * }
	 * ```
	 *
	 * @example With typed data and options
	 * ```typescript
	 * const response = await messages.sendMessage<UserData, UserRequest>(
	 *   'background',
	 *   'fetchUser',
	 *   { userId: 123 },
	 *   { timeout: 10000, retries: 2 }
	 * );
	 * ```
	 */
	sendMessage<Response = any, Data = any>(target: "background", messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>>;
	/**
	 * Send a message to a specific tab by ID
	 *
	 * Sends a typed message to a content script running in the specified tab.
	 * The target tab must have a content script loaded that is listening for messages.
	 *
	 * @template Response - Expected type of the response data
	 * @template Data - Type of the data payload to send
	 *
	 * @param target - Must be `'tab'` to send to a specific tab
	 * @param tabId - The numeric ID of the tab to send the message to
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options (timeout, retries, retryDelay)
	 *
	 * @returns Promise resolving to a MessageResponse containing success status and data/error
	 *
	 * @example
	 * ```typescript
	 * // Send message to a specific tab
	 * const response = await messages.sendMessage('tab', 123, 'highlightText', {
	 *   text: 'search term',
	 *   color: 'yellow'
	 * });
	 * ```
	 *
	 * @example With active tab
	 * ```typescript
	 * const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	 * const response = await messages.sendMessage('tab', tab.id, 'getData');
	 * ```
	 */
	sendMessage<Response = any, Data = any>(target: "tab", tabId: number, messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>>;
	/**
	 * Send a message to all open tabs
	 *
	 * Broadcasts a message to content scripts in all tabs. Returns an array
	 * of responses, one for each tab. Tabs without content scripts or that
	 * fail to respond will have error responses in the array.
	 *
	 * @template Response - Expected type of the response data from each tab
	 * @template Data - Type of the data payload to send
	 *
	 * @param target - Must be `'tabs'` to broadcast to all tabs
	 * @param messageType - Unique identifier for the message type
	 * @param data - Optional data payload to send with the message
	 * @param options - Configuration options (timeout, retries, retryDelay)
	 *
	 * @returns Promise resolving to an array of MessageResponses, one per tab
	 *
	 * @example
	 * ```typescript
	 * // Notify all tabs to refresh
	 * const responses = await messages.sendMessage('tabs', 'refresh', { force: true });
	 * const successCount = responses.filter(r => r.success).length;
	 * console.log(`${successCount} tabs refreshed`);
	 * ```
	 *
	 * @example Theme broadcast
	 * ```typescript
	 * const responses = await messages.sendMessage('tabs', 'themeChanged', {
	 *   theme: 'dark'
	 * });
	 * ```
	 */
	sendMessage<Response = any, Data = any>(target: "tabs", messageType: string, data?: Data, options?: MessageOptions): Promise<MessageResponse<Response>[]>;
	/**
	 * Send message with retry logic
	 */
	private sendWithRetry;
	/**
	 * Create success response
	 */
	private createSuccessResponse;
	/**
	 * Create error response
	 */
	private createErrorResponse;
}
/**
 * WebRequest API Types
 * Type definitions for browser webRequest API
 *
 * @module webrequest.types
 */
/**
 * Chrome request body interface
 */
export interface ChromeRequestBody {
	error?: string;
	formData?: {
		[key: string]: string[];
	};
	raw?: Array<{
		bytes: ArrayBuffer;
		file?: string;
	}>;
}
/**
 * Chrome auth challenger interface
 */
export interface ChromeAuthChallenger {
	host: string;
	port: number;
}
/**
 * WebRequest event types for the simplified API
 */
export type WebRequestEventType = "BeforeRequest" | "BeforeSendHeaders" | "SendHeaders" | "HeadersReceived" | "AuthRequired" | "ResponseStarted" | "BeforeRedirect" | "Completed" | "ErrorOccurred";
/**
 * WebRequest filter configuration for cross-browser compatibility
 */
export interface WebRequestFilter {
	/** Array of URL patterns to match */
	urls: string[];
	/** Array of resource types to filter (optional) */
	types?: chrome.webRequest.ResourceType[];
	/** Tab ID to filter requests from (optional) */
	tabId?: number;
	/** Window ID to filter requests from (optional) */
	windowId?: number;
}
/**
 * WebRequest event details unified interface
 */
export interface WebRequestDetails {
	/** The ID of the request */
	requestId: string;
	/** The URL of the request */
	url: string;
	/** The HTTP method used */
	method: string;
	/** The ID of the frame that initiated the request */
	frameId: number;
	/** The ID of the parent frame */
	parentFrameId: number;
	/** The ID of the tab where the request takes place */
	tabId: number;
	/** The resource type of the request */
	type: chrome.webRequest.ResourceType;
	/** The time when the request was made */
	timeStamp: number;
	/** The origin of the request initiator */
	initiator?: string;
	/** Request headers (for onSendHeaders, onHeadersReceived) */
	requestHeaders?: chrome.webRequest.HttpHeader[];
	/** Response headers (for onHeadersReceived, onResponseStarted) */
	responseHeaders?: chrome.webRequest.HttpHeader[];
	/** HTTP status code (for onHeadersReceived, onResponseStarted) */
	statusCode?: number;
	/** Status line (for onHeadersReceived, onResponseStarted) */
	statusLine?: string;
	/** Error description (for onErrorOccurred) */
	error?: string;
	/** Redirect URL (for onBeforeRedirect) */
	redirectUrl?: string;
	/** Request body data (for onBeforeRequest) */
	requestBody?: ChromeRequestBody;
}
/**
 * WebRequest blocking response for modifying requests
 */
export interface WebRequestBlockingResponse {
	/** Cancel the request */
	cancel?: boolean;
	/** Redirect the request to a different URL */
	redirectUrl?: string;
	/** Modify request headers */
	requestHeaders?: chrome.webRequest.HttpHeader[];
	/** Modify response headers */
	responseHeaders?: chrome.webRequest.HttpHeader[];
	/** Authentication credentials */
	authCredentials?: chrome.webRequest.AuthCredentials;
}
/**
 * WebRequest listener callback type with strong typing
 */
export type WebRequestListener<T extends WebRequestDetails = WebRequestDetails> = (details: T) => WebRequestBlockingResponse | void | Promise<WebRequestBlockingResponse | void>;
/**
 * WebRequest blocking listener callback type
 */
export type WebRequestBlockingListener<T extends WebRequestDetails = WebRequestDetails> = (details: T) => WebRequestBlockingResponse | Promise<WebRequestBlockingResponse>;
/**
 * WebRequest listener for the simplified API
 */
export type SimpleWebRequestListener<T = WebRequestDetails> = (details: T, filter?: WebRequestFilter) => void | WebRequestBlockingResponse | Promise<WebRequestBlockingResponse | void>;
/**
 * WebRequest event types with their corresponding detail interfaces
 */
export interface WebRequestEventMap {
	onBeforeRequest: WebRequestDetails & {
		requestBody?: ChromeRequestBody;
	};
	onBeforeSendHeaders: WebRequestDetails & {
		requestHeaders?: chrome.webRequest.HttpHeader[];
	};
	onSendHeaders: WebRequestDetails & {
		requestHeaders?: chrome.webRequest.HttpHeader[];
	};
	onHeadersReceived: WebRequestDetails & {
		responseHeaders?: chrome.webRequest.HttpHeader[];
		statusCode: number;
		statusLine: string;
	};
	onAuthRequired: WebRequestDetails & {
		isProxy: boolean;
		challenger: ChromeAuthChallenger;
		realm?: string;
		scheme: string;
	};
	onResponseStarted: WebRequestDetails & {
		responseHeaders?: chrome.webRequest.HttpHeader[];
		statusCode: number;
		statusLine: string;
	};
	onBeforeRedirect: WebRequestDetails & {
		redirectUrl: string;
		statusCode: number;
		statusLine: string;
		responseHeaders?: chrome.webRequest.HttpHeader[];
	};
	onCompleted: WebRequestDetails & {
		responseHeaders?: chrome.webRequest.HttpHeader[];
		statusCode: number;
		statusLine: string;
	};
	onErrorOccurred: WebRequestDetails & {
		error: string;
	};
}
/**
 * WebRequest extra info specs for different events
 */
export type WebRequestExtraInfoSpec = "requestHeaders" | "responseHeaders" | "blocking" | "asyncBlocking" | "requestBody" | "extraHeaders";
/**
 * WebRequest API interface
 */
export interface WebRequestAPI {
	/**
	 * Add a listener for a specific webRequest event
	 */
	on<T extends WebRequestDetails = WebRequestDetails>(eventType: WebRequestEventType, listener: SimpleWebRequestListener<T>, filter: WebRequestFilter, extraInfoSpec?: WebRequestExtraInfoSpec[]): void;
	/**
	 * Remove a listener for a specific webRequest event
	 */
	off(eventType: WebRequestEventType, listener: SimpleWebRequestListener): void;
	/**
	 * Remove all listeners for a specific webRequest event
	 */
	clear(eventType: WebRequestEventType): void;
	/**
	 * Check if webRequest API is available
	 */
	isAvailable(): boolean;
	/**
	 * Get maximum number of listeners for webRequest events
	 */
	getMaxListeners(): number;
}
declare class QevoWebRequest extends QevoLogger {
	private webRequestListeners;
	private simpleWebRequestListeners;
	private maxListeners;
	constructor(debug?: boolean);
	/**
	 * Add a listener for a webRequest event
	 *
	 * Registers a callback to be invoked when the specified network event occurs.
	 * Use simplified event names without the 'on' prefix.
	 *
	 * @template T - Type of request details (defaults to WebRequestDetails)
	 *
	 * @param eventType - Event type to listen for:
	 *   - `'BeforeRequest'` - Before request is sent (can cancel/redirect)
	 *   - `'BeforeSendHeaders'` - Before headers are sent (can modify headers)
	 *   - `'SendHeaders'` - When headers are sent (read-only)
	 *   - `'HeadersReceived'` - When response headers arrive (can modify)
	 *   - `'AuthRequired'` - When authentication is required
	 *   - `'ResponseStarted'` - When first byte of response is received
	 *   - `'BeforeRedirect'` - Before redirect is followed
	 *   - `'Completed'` - When request completes successfully
	 *   - `'ErrorOccurred'` - When request fails
	 *
	 * @param listener - Callback function receiving request details
	 * @param filter - URL patterns and other filters
	 * @param filter.urls - URL patterns to match (required)
	 * @param filter.types - Resource types to match (e.g., 'main_frame', 'script')
	 * @param filter.tabId - Specific tab ID to monitor
	 * @param filter.windowId - Specific window ID to monitor
	 * @param extraInfoSpec - Additional options:
	 *   - `'blocking'` - Enable synchronous blocking (can cancel/modify)
	 *   - `'requestHeaders'` - Include request headers in details
	 *   - `'responseHeaders'` - Include response headers in details
	 *   - `'extraHeaders'` - Access additional headers (Chrome only)
	 *
	 * @example Monitor all requests
	 * ```typescript
	 * webRequest.on('BeforeRequest', (details) => {
	 *   console.log(`${details.method} ${details.url}`);
	 * }, { urls: ['<all_urls>'] });
	 * ```
	 *
	 * @example Capture headers
	 * ```typescript
	 * webRequest.on('SendHeaders', (details) => {
	 *   const authHeader = details.requestHeaders?.find(h => h.name === 'Authorization');
	 *   if (authHeader) {
	 *     console.log('Auth header found');
	 *   }
	 * }, { urls: ['*://api.example.com/*'] }, ['requestHeaders']);
	 * ```
	 *
	 * @example Block requests (requires webRequestBlocking permission)
	 * ```typescript
	 * webRequest.on('BeforeRequest', (details) => {
	 *   if (details.url.includes('ads')) {
	 *     return { cancel: true };
	 *   }
	 * }, { urls: ['<all_urls>'] }, ['blocking']);
	 * ```
	 *
	 * @example Redirect requests
	 * ```typescript
	 * webRequest.on('BeforeRequest', (details) => {
	 *   if (details.url.includes('old-api')) {
	 *     return { redirectUrl: details.url.replace('old-api', 'new-api') };
	 *   }
	 * }, { urls: ['*://example.com/*'] }, ['blocking']);
	 * ```
	 */
	on<T extends WebRequestDetails = WebRequestDetails>(eventType: WebRequestEventType, listener: SimpleWebRequestListener<T>, filter: WebRequestFilter, extraInfoSpec?: WebRequestExtraInfoSpec[]): void;
	/**
	 * Remove a webRequest event listener
	 *
	 * Removes a previously registered listener for the specified event type.
	 * The listener must be the exact same function reference that was passed to `on()`.
	 *
	 * @param eventType - Event type the listener was registered for
	 * @param listener - The exact listener function to remove
	 *
	 * @example
	 * ```typescript
	 * const handler = (details) => {
	 *   console.log('Request:', details.url);
	 * };
	 *
	 * // Add listener
	 * webRequest.on('BeforeRequest', handler, { urls: ['<all_urls>'] });
	 *
	 * // Later, remove it
	 * webRequest.off('BeforeRequest', handler);
	 * ```
	 */
	off(eventType: WebRequestEventType, listener: SimpleWebRequestListener): void;
	/**
	 * Remove all listeners for a specific webRequest event
	 *
	 * Clears all registered listeners for the given event type.
	 *
	 * @param eventType - Event type to clear all listeners for
	 *
	 * @example
	 * ```typescript
	 * // Remove all BeforeRequest listeners
	 * webRequest.clear('BeforeRequest');
	 * ```
	 */
	clear(eventType: WebRequestEventType): void;
	/**
	 * Check if the webRequest API is available
	 *
	 * The webRequest API is only available in background scripts
	 * and requires the `webRequest` permission.
	 *
	 * @returns `true` if webRequest API is available, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * if (webRequest.isAvailable()) {
	 *   webRequest.on('BeforeRequest', handler, { urls: ['<all_urls>'] });
	 * } else {
	 *   console.warn('webRequest API not available in this context');
	 * }
	 * ```
	 */
	isAvailable(): boolean;
	/**
	 * Get the maximum number of listeners allowed per event
	 *
	 * @returns Current maximum listener count
	 *
	 * @example
	 * ```typescript
	 * console.log('Max listeners:', webRequest.getMaxListeners());
	 * ```
	 */
	getMaxListeners(): number;
	/**
	 * Set the maximum number of listeners allowed per event
	 *
	 * @param max - New maximum listener count
	 *
	 * @example
	 * ```typescript
	 * webRequest.setMaxListeners(20);
	 * ```
	 */
	setMaxListeners(max: number): void;
	/**
	 * Internal method to add webRequest listeners with cross-browser compatibility
	 */
	private addListener;
	/**
	 * Internal method to remove webRequest listeners
	 */
	private removeListener;
	/**
	 * Convert Chrome webRequest filter to Firefox format
	 */
	private convertFilter;
	/**
	 * Convert Chrome extraInfoSpec to Firefox format
	 */
	private convertExtraInfoSpec;
	/**
	 * Get the full WebRequest API interface
	 *
	 * Returns an object containing all webRequest methods for compatibility
	 * with patterns that expect a standalone API object.
	 *
	 * @returns Complete WebRequestAPI interface
	 *
	 * @example
	 * ```typescript
	 * const api = webRequest.api;
	 *
	 * api.on('BeforeRequest', handler, { urls: ['<all_urls>'] });
	 *
	 * if (api.isAvailable()) {
	 *   console.log('WebRequest is available');
	 * }
	 * ```
	 */
	get api(): WebRequestAPI;
}
/**
 * Alarm information returned by the browser
 */
export interface Alarm {
	/** Name of the alarm */
	name: string;
	/** Time when the alarm is scheduled to fire, in milliseconds since epoch */
	scheduledTime: number;
	/** Period in minutes for repeating alarms (undefined for one-time alarms) */
	periodInMinutes?: number;
}
/**
 * Options for creating an alarm
 */
export interface AlarmCreateInfo {
	/**
	 * Time when the alarm should fire, in milliseconds since epoch.
	 * Mutually exclusive with `delayInMinutes`.
	 */
	when?: number;
	/**
	 * Delay in minutes before the alarm fires.
	 * Mutually exclusive with `when`.
	 */
	delayInMinutes?: number;
	/**
	 * Period in minutes for repeating alarms.
	 * If set, the alarm will fire repeatedly at this interval.
	 */
	periodInMinutes?: number;
}
/**
 * Callback for alarm events
 */
export type AlarmListener = (alarm: Alarm) => void;
declare class QevoAlarms extends QevoLogger {
	private alarmListeners;
	private browserListenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Create an unnamed alarm with the given configuration.
	 * The alarm will use an empty string as its name.
	 *
	 * @param alarmInfo - Alarm configuration with timing options
	 *
	 * @example
	 * ```typescript
	 * // Create anonymous alarm firing in 5 minutes
	 * await alarms.create({ delayInMinutes: 5 });
	 * ```
	 */
	create(alarmInfo: AlarmCreateInfo): Promise<void>;
	/**
	 * Create a named alarm with the given configuration.
	 *
	 * @param name - Unique identifier for the alarm
	 * @param alarmInfo - Alarm configuration with timing options
	 *
	 * @example One-time alarm
	 * ```typescript
	 * await alarms.create('reminder', { delayInMinutes: 10 });
	 * ```
	 *
	 * @example Repeating alarm
	 * ```typescript
	 * await alarms.create('hourlyTask', {
	 *   delayInMinutes: 60,
	 *   periodInMinutes: 60
	 * });
	 * ```
	 *
	 * @example Exact time alarm
	 * ```typescript
	 * const targetTime = new Date('2024-12-25T09:00:00').getTime();
	 * await alarms.create('christmas', { when: targetTime });
	 * ```
	 */
	create(name: string, alarmInfo: AlarmCreateInfo): Promise<void>;
	/**
	 * Get the unnamed alarm (empty string name)
	 *
	 * @returns The alarm if found, undefined otherwise
	 *
	 * @example
	 * ```typescript
	 * const alarm = await alarms.get();
	 * if (alarm) {
	 *   console.log('Next fire:', new Date(alarm.scheduledTime));
	 * }
	 * ```
	 */
	get(): Promise<Alarm | undefined>;
	/**
	 * Get information about a specific named alarm
	 *
	 * @param name - Name of the alarm to retrieve
	 * @returns The alarm if found, undefined otherwise
	 *
	 * @example
	 * ```typescript
	 * const alarm = await alarms.get('reminder');
	 * if (alarm) {
	 *   console.log('Next fire:', new Date(alarm.scheduledTime));
	 *   console.log('Repeats:', alarm.periodInMinutes ? 'Yes' : 'No');
	 * }
	 * ```
	 */
	get(name: string): Promise<Alarm | undefined>;
	/**
	 * Get all active alarms
	 *
	 * @returns Array of all active alarms
	 *
	 * @example
	 * ```typescript
	 * const allAlarms = await alarms.getAll();
	 * console.log(`${allAlarms.length} active alarms`);
	 * allAlarms.forEach(alarm => {
	 *   console.log(`- ${alarm.name}: fires at ${new Date(alarm.scheduledTime)}`);
	 * });
	 * ```
	 */
	getAll(): Promise<Alarm[]>;
	/**
	 * Clear the unnamed alarm (empty string name)
	 *
	 * @returns True if the alarm was cleared, false if it didn't exist
	 *
	 * @example
	 * ```typescript
	 * const wasCleared = await alarms.clear();
	 * console.log(wasCleared ? 'Alarm cleared' : 'Alarm not found');
	 * ```
	 */
	clear(): Promise<boolean>;
	/**
	 * Clear a specific named alarm
	 *
	 * @param name - Name of the alarm to clear
	 * @returns True if the alarm was cleared, false if it didn't exist
	 *
	 * @example
	 * ```typescript
	 * const wasCleared = await alarms.clear('reminder');
	 * console.log(wasCleared ? 'Alarm cleared' : 'Alarm not found');
	 * ```
	 */
	clear(name: string): Promise<boolean>;
	/**
	 * Clear all active alarms
	 *
	 * @returns True if all alarms were cleared
	 *
	 * @example
	 * ```typescript
	 * await alarms.clearAll();
	 * console.log('All alarms cleared');
	 * ```
	 */
	clearAll(): Promise<boolean>;
	/**
	 * Register a listener for alarm events
	 *
	 * The listener will be called whenever any alarm fires.
	 * Use the alarm name to determine which alarm triggered.
	 *
	 * @param listener - Callback function receiving the fired alarm
	 *
	 * @example
	 * ```typescript
	 * alarms.onAlarm((alarm) => {
	 *   switch (alarm.name) {
	 *     case 'sync':
	 *       performBackgroundSync();
	 *       break;
	 *     case 'cleanup':
	 *       cleanupOldData();
	 *       break;
	 *     default:
	 *       console.log('Unknown alarm:', alarm.name);
	 *   }
	 * });
	 * ```
	 */
	onAlarm(listener: AlarmListener): void;
	/**
	 * Remove an alarm event listener
	 *
	 * @param listener - The listener function to remove
	 *
	 * @example
	 * ```typescript
	 * const handler = (alarm) => console.log(alarm.name);
	 * alarms.onAlarm(handler);
	 * // Later...
	 * alarms.offAlarm(handler);
	 * ```
	 */
	offAlarm(listener: AlarmListener): void;
	/**
	 * Check if the alarms API is available
	 *
	 * @returns True if the alarms API is available
	 *
	 * @example
	 * ```typescript
	 * if (alarms.isAvailable()) {
	 *   await alarms.create('task', { delayInMinutes: 5 });
	 * } else {
	 *   console.warn('Alarms API not available');
	 * }
	 * ```
	 */
	isAvailable(): boolean;
	/**
	 * Initialize the browser alarm listener (called once)
	 * @internal
	 */
	private initializeBrowserListener;
}
/**
 * Notification template types
 */
export type NotificationTemplateType = "basic" | "image" | "list" | "progress";
/**
 * Button definition for notifications
 */
export interface NotificationButton {
	/** Button text */
	title: string;
	/** Optional icon URL for the button */
	iconUrl?: string;
}
/**
 * Item for list-type notifications
 */
export interface NotificationItem {
	/** Item title */
	title: string;
	/** Item message */
	message: string;
}
interface NotificationOptions$1 {
	/** Notification type */
	type: NotificationTemplateType;
	/** Notification title */
	title: string;
	/** Main notification message */
	message: string;
	/** URL of the notification icon (required) */
	iconUrl: string;
	/** Secondary icon URL (Chrome only) */
	appIconMaskUrl?: string;
	/** Context message displayed below the main message */
	contextMessage?: string;
	/** Notification priority (-2 to 2, default 0) */
	priority?: number;
	/** Timestamp to display (milliseconds since epoch) */
	eventTime?: number;
	/** Buttons to display (max 2, Chrome only) */
	buttons?: NotificationButton[];
	/** Image URL for image-type notifications */
	imageUrl?: string;
	/** Items for list-type notifications */
	items?: NotificationItem[];
	/** Progress value (0-100) for progress-type notifications */
	progress?: number;
	/** Whether notification requires interaction to dismiss */
	requireInteraction?: boolean;
	/** Whether the notification should be silent */
	silent?: boolean;
}
/**
 * Callback for notification click events
 */
export type NotificationClickedListener = (notificationId: string) => void;
/**
 * Callback for notification button click events
 */
export type NotificationButtonClickedListener = (notificationId: string, buttonIndex: number) => void;
/**
 * Callback for notification close events
 */
export type NotificationClosedListener = (notificationId: string, byUser: boolean) => void;
declare class QevoNotifications extends QevoLogger {
	private clickedListeners;
	private buttonClickedListeners;
	private closedListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * Create and display a notification with auto-generated ID
	 *
	 * @param options - Notification options
	 * @returns The auto-generated notification ID
	 *
	 * @example Basic notification
	 * ```typescript
	 * const id = await notifications.create({
	 *   type: 'basic',
	 *   title: 'Download Complete',
	 *   message: 'Your file has been downloaded',
	 *   iconUrl: 'icons/download.png'
	 * });
	 * ```
	 *
	 * @example List notification
	 * ```typescript
	 * await notifications.create({
	 *   type: 'list',
	 *   title: 'New Emails',
	 *   message: '3 new messages',
	 *   iconUrl: 'icons/email.png',
	 *   items: [
	 *     { title: 'John', message: 'Meeting tomorrow' },
	 *     { title: 'Jane', message: 'Project update' },
	 *     { title: 'Bob', message: 'Quick question' }
	 *   ]
	 * });
	 * ```
	 */
	create(options: NotificationOptions$1): Promise<string>;
	/**
	 * Create and display a notification with a specific ID
	 *
	 * @param options - Notification options
	 * @param notificationId - ID for the notification (allows later updates)
	 * @returns The notification ID
	 *
	 * @example Progress notification with ID for updates
	 * ```typescript
	 * const id = await notifications.create({
	 *   type: 'progress',
	 *   title: 'Uploading...',
	 *   message: 'file.zip',
	 *   iconUrl: 'icons/upload.png',
	 *   progress: 45
	 * }, 'upload-progress');
	 *
	 * // Update progress later
	 * await notifications.update('upload-progress', { progress: 75 });
	 * ```
	 */
	create(options: NotificationOptions$1, notificationId: string): Promise<string>;
	/**
	 * Update an existing notification
	 *
	 * @param notificationId - ID of the notification to update
	 * @param options - Updated notification options
	 * @returns True if the notification was updated
	 *
	 * @example
	 * ```typescript
	 * // Update progress
	 * await notifications.update('upload-progress', {
	 *   progress: 100,
	 *   message: 'Upload complete!'
	 * });
	 * ```
	 */
	update(notificationId: string, options: Partial<NotificationOptions$1>): Promise<boolean>;
	/**
	 * Clear a specific notification
	 *
	 * @param notificationId - ID of the notification to clear
	 * @returns True if the notification was cleared
	 *
	 * @example
	 * ```typescript
	 * await notifications.clear('my-notification');
	 * ```
	 */
	clear(notificationId: string): Promise<boolean>;
	/**
	 * Get all active notifications
	 *
	 * @returns Object mapping notification IDs to their options
	 *
	 * @example
	 * ```typescript
	 * const active = await notifications.getAll();
	 * console.log(`${Object.keys(active).length} active notifications`);
	 * ```
	 */
	getAll(): Promise<{
		[id: string]: NotificationOptions$1;
	}>;
	/**
	 * Register a listener for notification clicks
	 *
	 * @param listener - Callback when notification is clicked
	 *
	 * @example
	 * ```typescript
	 * notifications.onClicked((id) => {
	 *   if (id === 'message-notification') {
	 *     openMessagesTab();
	 *   }
	 * });
	 * ```
	 */
	onClicked(listener: NotificationClickedListener): void;
	/**
	 * Remove a notification click listener
	 *
	 * @param listener - The listener to remove
	 */
	offClicked(listener: NotificationClickedListener): void;
	/**
	 * Register a listener for notification button clicks (Chrome only)
	 *
	 * @param listener - Callback when a button is clicked
	 *
	 * @example
	 * ```typescript
	 * notifications.onButtonClicked((id, buttonIndex) => {
	 *   if (buttonIndex === 0) {
	 *     // First button clicked
	 *     handleAction();
	 *   } else {
	 *     // Second button clicked
	 *     dismissNotification();
	 *   }
	 * });
	 * ```
	 */
	onButtonClicked(listener: NotificationButtonClickedListener): void;
	/**
	 * Remove a button click listener
	 *
	 * @param listener - The listener to remove
	 */
	offButtonClicked(listener: NotificationButtonClickedListener): void;
	/**
	 * Register a listener for notification close events
	 *
	 * @param listener - Callback when notification is closed
	 *
	 * @example
	 * ```typescript
	 * notifications.onClosed((id, byUser) => {
	 *   if (byUser) {
	 *     console.log('User dismissed notification:', id);
	 *   } else {
	 *     console.log('Notification auto-closed:', id);
	 *   }
	 * });
	 * ```
	 */
	onClosed(listener: NotificationClosedListener): void;
	/**
	 * Remove a notification close listener
	 *
	 * @param listener - The listener to remove
	 */
	offClosed(listener: NotificationClosedListener): void;
	/**
	 * Check if the notifications API is available
	 *
	 * @returns True if the API is available
	 *
	 * @example
	 * ```typescript
	 * if (notifications.isAvailable()) {
	 *   await notifications.create({ ... });
	 * }
	 * ```
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listeners
	 * @internal
	 */
	private ensureListenersInitialized;
}
/**
 * Contexts where menu items can appear
 */
export type ContextType = "all" | "page" | "frame" | "selection" | "link" | "editable" | "image" | "video" | "audio" | "launcher" | "browser_action" | "page_action" | "action";
/**
 * Type of menu item
 */
export type ItemType = "normal" | "checkbox" | "radio" | "separator";
interface CreateProperties$1 {
	/** Unique ID for the menu item */
	id?: string;
	/** Type of menu item */
	type?: ItemType;
	/** Text to display (use %s for selection placeholder) */
	title?: string;
	/** Whether checkbox/radio is checked */
	checked?: boolean;
	/** Contexts where item appears */
	contexts?: ContextType[];
	/** Whether item is visible */
	visible?: boolean;
	/** Callback when item is clicked */
	onclick?: (info: OnClickData, tab?: chrome.tabs.Tab) => void;
	/** Parent menu item ID for submenus */
	parentId?: string | number;
	/** URL patterns to show item for */
	documentUrlPatterns?: string[];
	/** URL patterns for target elements */
	targetUrlPatterns?: string[];
	/** Whether item is enabled */
	enabled?: boolean;
}
interface UpdateProperties$1 {
	type?: ItemType;
	title?: string;
	checked?: boolean;
	contexts?: ContextType[];
	visible?: boolean;
	onclick?: (info: OnClickData, tab?: chrome.tabs.Tab) => void;
	parentId?: string | number;
	documentUrlPatterns?: string[];
	targetUrlPatterns?: string[];
	enabled?: boolean;
}
/**
 * Data passed to click handlers
 */
export interface OnClickData {
	/** ID of the clicked menu item */
	menuItemId: string | number;
	/** ID of parent menu item (if submenu) */
	parentMenuItemId?: string | number;
	/** Type of media element (if applicable) */
	mediaType?: "image" | "video" | "audio";
	/** URL of the link (if link context) */
	linkUrl?: string;
	/** URL of media element (if applicable) */
	srcUrl?: string;
	/** URL of the page */
	pageUrl?: string;
	/** URL of the frame */
	frameUrl?: string;
	/** Frame ID */
	frameId?: number;
	/** Selected text (if selection context) */
	selectionText?: string;
	/** Whether element is editable */
	editable: boolean;
	/** Whether checkbox/radio was checked */
	wasChecked?: boolean;
	/** Whether checkbox/radio is now checked */
	checked?: boolean;
}
/**
 * Callback for menu item clicks
 */
export type ContextMenuClickedListener = (info: OnClickData, tab?: chrome.tabs.Tab) => void;
declare class QevoContextMenus extends QevoLogger {
	private clickedListeners;
	private listenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Create a new context menu item
	 *
	 * @param createProperties - Menu item properties
	 * @returns The ID of the created menu item
	 *
	 * @example Simple menu item
	 * ```typescript
	 * const id = await contextMenus.create({
	 *   id: 'copy-link',
	 *   title: 'Copy Link',
	 *   contexts: ['link']
	 * });
	 * ```
	 *
	 * @example Selection-based menu
	 * ```typescript
	 * await contextMenus.create({
	 *   id: 'translate',
	 *   title: 'Translate "%s"',
	 *   contexts: ['selection']
	 * });
	 * ```
	 *
	 * @example Checkbox menu item
	 * ```typescript
	 * await contextMenus.create({
	 *   id: 'enable-feature',
	 *   title: 'Enable Feature',
	 *   type: 'checkbox',
	 *   checked: true,
	 *   contexts: ['browser_action']
	 * });
	 * ```
	 */
	create(createProperties: CreateProperties$1): Promise<string | number>;
	/**
	 * Update an existing menu item by string ID
	 *
	 * @param id - String ID of the menu item to update
	 * @param updateProperties - Properties to update
	 *
	 * @example
	 * ```typescript
	 * await contextMenus.update('enable-feature', {
	 *   checked: false
	 * });
	 * ```
	 */
	update(id: string, updateProperties: UpdateProperties$1): Promise<void>;
	/**
	 * Update an existing menu item by numeric ID
	 *
	 * @param id - Numeric ID of the menu item to update
	 * @param updateProperties - Properties to update
	 *
	 * @example
	 * ```typescript
	 * await contextMenus.update(123, {
	 *   title: 'New Title'
	 * });
	 * ```
	 */
	update(id: number, updateProperties: UpdateProperties$1): Promise<void>;
	/**
	 * Remove a specific menu item by string ID
	 *
	 * @param menuItemId - String ID of the menu item to remove
	 *
	 * @example
	 * ```typescript
	 * await contextMenus.remove('temporary-item');
	 * ```
	 */
	remove(menuItemId: string): Promise<void>;
	/**
	 * Remove a specific menu item by numeric ID
	 *
	 * @param menuItemId - Numeric ID of the menu item to remove
	 *
	 * @example
	 * ```typescript
	 * await contextMenus.remove(123);
	 * ```
	 */
	remove(menuItemId: number): Promise<void>;
	/**
	 * Remove all context menu items created by this extension
	 *
	 * @example
	 * ```typescript
	 * await contextMenus.removeAll();
	 * console.log('All menu items removed');
	 * ```
	 */
	removeAll(): Promise<void>;
	/**
	 * Register a listener for context menu clicks
	 *
	 * @param listener - Callback when a menu item is clicked
	 *
	 * @example
	 * ```typescript
	 * contextMenus.onClicked((info, tab) => {
	 *   switch (info.menuItemId) {
	 *     case 'search':
	 *       searchForText(info.selectionText);
	 *       break;
	 *     case 'save-image':
	 *       downloadImage(info.srcUrl);
	 *       break;
	 *     case 'open-link':
	 *       openInNewTab(info.linkUrl);
	 *       break;
	 *   }
	 * });
	 * ```
	 */
	onClicked(listener: ContextMenuClickedListener): void;
	/**
	 * Remove a context menu click listener
	 *
	 * @param listener - The listener to remove
	 */
	offClicked(listener: ContextMenuClickedListener): void;
	/**
	 * Check if the context menus API is available
	 *
	 * @returns True if the API is available
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listener
	 * @internal
	 */
	private initializeBrowserListener;
}
/**
 * Target for script injection
 */
export interface InjectionTarget {
	/** Tab ID to inject into */
	tabId: number;
	/** Specific frame IDs to inject into (all frames if omitted) */
	frameIds?: number[];
	/** Whether to inject into all frames */
	allFrames?: boolean;
	/** Document IDs to inject into (Chrome 106+) */
	documentIds?: string[];
}
/**
 * Options for executing a script
 */
export interface ScriptInjection {
	/** Target tab/frames for injection */
	target: InjectionTarget;
	/** JavaScript files to inject */
	files?: string[];
	/** Function to inject and execute */
	func?: (...args: any[]) => any;
	/** Arguments to pass to the function */
	args?: any[];
	/** When to inject: 'document_start', 'document_end', or 'document_idle' */
	injectImmediately?: boolean;
	/** World to execute in: 'ISOLATED' or 'MAIN' */
	world?: "ISOLATED" | "MAIN";
}
/**
 * Result of script execution
 */
export interface InjectionResult {
	/** Document ID where script was executed (Chrome 106+) */
	documentId?: string;
	/** Frame ID where script was executed */
	frameId: number;
	/** Return value of the executed script */
	result?: any;
	/** Error that occurred during execution */
	error?: Error;
}
/**
 * Options for CSS injection
 */
export interface CSSInjection {
	/** Target tab/frames for injection */
	target: InjectionTarget;
	/** CSS string to inject */
	css?: string;
	/** CSS files to inject */
	files?: string[];
	/** CSS origin: 'USER' or 'AUTHOR' */
	origin?: "USER" | "AUTHOR";
}
/**
 * Registered content script definition
 */
export interface RegisteredContentScript {
	/** Unique ID for the content script */
	id: string;
	/** URL match patterns */
	matches?: string[];
	/** URL patterns to exclude */
	excludeMatches?: string[];
	/** JavaScript files to inject */
	js?: string[];
	/** CSS files to inject */
	css?: string[];
	/** Whether to inject in all frames */
	allFrames?: boolean;
	/** Whether to match about:blank frames */
	matchAboutBlank?: boolean;
	/** Whether to match origin-as-fallback frames */
	matchOriginAsFallback?: boolean;
	/** When to run: 'document_start', 'document_end', 'document_idle' */
	runAt?: "document_start" | "document_end" | "document_idle";
	/** World to execute in */
	world?: "ISOLATED" | "MAIN";
	/** Whether script persists across sessions */
	persistAcrossSessions?: boolean;
}
declare class QevoScripting extends QevoLogger {
	constructor(debug?: boolean);
	/**
	 * Execute a script in the specified tab
	 *
	 * @param injection - Script injection details
	 * @returns Array of injection results, one per frame
	 *
	 * @example Execute a function
	 * ```typescript
	 * const results = await scripting.executeScript({
	 *   target: { tabId: 123 },
	 *   func: () => {
	 *     return document.querySelectorAll('a').length;
	 *   }
	 * });
	 * console.log('Links found:', results[0].result);
	 * ```
	 *
	 * @example Execute with arguments
	 * ```typescript
	 * const results = await scripting.executeScript({
	 *   target: { tabId: 123 },
	 *   func: (selector, attribute) => {
	 *     const el = document.querySelector(selector);
	 *     return el ? el.getAttribute(attribute) : null;
	 *   },
	 *   args: ['#main', 'data-id']
	 * });
	 * ```
	 *
	 * @example Execute a file
	 * ```typescript
	 * await scripting.executeScript({
	 *   target: { tabId: 123, allFrames: true },
	 *   files: ['scripts/content.js']
	 * });
	 * ```
	 *
	 * @example Execute in main world
	 * ```typescript
	 * await scripting.executeScript({
	 *   target: { tabId: 123 },
	 *   func: () => window.myGlobalVar,
	 *   world: 'MAIN'
	 * });
	 * ```
	 */
	executeScript(injection: ScriptInjection): Promise<InjectionResult[]>;
	/**
	 * Inject CSS into the specified tab
	 *
	 * @param injection - CSS injection details
	 *
	 * @example Inject CSS string
	 * ```typescript
	 * await scripting.insertCSS({
	 *   target: { tabId: 123 },
	 *   css: `
	 *     .highlight { background: yellow; }
	 *     .hidden { display: none; }
	 *   `
	 * });
	 * ```
	 *
	 * @example Inject CSS file
	 * ```typescript
	 * await scripting.insertCSS({
	 *   target: { tabId: 123, allFrames: true },
	 *   files: ['styles/inject.css']
	 * });
	 * ```
	 */
	insertCSS(injection: CSSInjection): Promise<void>;
	/**
	 * Remove injected CSS from the specified tab
	 *
	 * @param injection - CSS to remove (must match what was injected)
	 *
	 * @example
	 * ```typescript
	 * // Remove previously injected CSS
	 * await scripting.removeCSS({
	 *   target: { tabId: 123 },
	 *   css: '.highlight { background: yellow; }'
	 * });
	 * ```
	 */
	removeCSS(injection: CSSInjection): Promise<void>;
	/**
	 * Register content scripts dynamically
	 *
	 * @param scripts - Array of content script definitions
	 *
	 * @example
	 * ```typescript
	 * await scripting.registerContentScripts([{
	 *   id: 'my-script',
	 *   matches: ['*://*.example.com/*'],
	 *   js: ['content.js'],
	 *   css: ['styles.css'],
	 *   runAt: 'document_idle'
	 * }]);
	 * ```
	 */
	registerContentScripts(scripts: RegisteredContentScript[]): Promise<void>;
	/**
	 * Unregister all dynamically registered content scripts
	 *
	 * @example
	 * ```typescript
	 * // Unregister all dynamically registered scripts
	 * await scripting.unregisterContentScripts();
	 * ```
	 */
	unregisterContentScripts(): Promise<void>;
	/**
	 * Unregister specific content scripts by ID
	 *
	 * @param filter - Filter specifying which scripts to unregister
	 *
	 * @example
	 * ```typescript
	 * // Unregister specific scripts
	 * await scripting.unregisterContentScripts({ ids: ['my-script'] });
	 * ```
	 */
	unregisterContentScripts(filter: {
		ids: string[];
	}): Promise<void>;
	/**
	 * Get all registered content scripts
	 *
	 * @returns Array of all registered content scripts
	 *
	 * @example
	 * ```typescript
	 * const scripts = await scripting.getRegisteredContentScripts();
	 * scripts.forEach(s => console.log(s.id, s.matches));
	 * ```
	 */
	getRegisteredContentScripts(): Promise<RegisteredContentScript[]>;
	/**
	 * Get specific registered content scripts by ID
	 *
	 * @param filter - Filter specifying which scripts to retrieve
	 * @returns Array of matching registered content scripts
	 *
	 * @example
	 * ```typescript
	 * const scripts = await scripting.getRegisteredContentScripts({ ids: ['my-script'] });
	 * ```
	 */
	getRegisteredContentScripts(filter: {
		ids: string[];
	}): Promise<RegisteredContentScript[]>;
	/**
	 * Update registered content scripts
	 *
	 * @param scripts - Scripts with updated properties
	 *
	 * @example
	 * ```typescript
	 * await scripting.updateContentScripts([{
	 *   id: 'my-script',
	 *   matches: ['*://*.newdomain.com/*']
	 * }]);
	 * ```
	 */
	updateContentScripts(scripts: RegisteredContentScript[]): Promise<void>;
	/**
	 * Check if the scripting API is available
	 *
	 * @returns True if the scripting API is available
	 */
	isAvailable(): boolean;
}
/**
 * Tab details for action operations
 */
export interface TabDetails {
	/** Tab ID to apply changes to (null for all tabs) */
	tabId?: number;
}
/**
 * Options for setting badge text
 */
export interface BadgeTextDetails extends TabDetails {
	/** Badge text (max 4 characters recommended) */
	text: string;
}
/**
 * Options for setting badge color
 */
export interface BadgeColorDetails extends TabDetails {
	/** Badge background color (hex, rgb, or color name) */
	color: string | [
		number,
		number,
		number,
		number
	];
}
/**
 * Options for setting icon
 */
export interface IconDetails extends TabDetails {
	/** Path to icon image or dictionary of sizes to paths */
	path?: string | {
		[size: number]: string;
	};
	/** ImageData or dictionary of sizes to ImageData */
	imageData?: ImageData | {
		[size: number]: ImageData;
	};
}
/**
 * Options for setting title (tooltip)
 */
export interface TitleDetails extends TabDetails {
	/** Tooltip text shown on hover */
	title: string;
}
/**
 * Options for setting popup
 */
export interface PopupDetails extends TabDetails {
	/** Path to popup HTML file (empty string to disable) */
	popup: string;
}
/**
 * Callback for action click events
 */
export type ActionClickedListener = (tab: chrome.tabs.Tab) => void;
declare class QevoAction extends QevoLogger {
	private clickedListeners;
	private listenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Get the appropriate action API based on browser and manifest version
	 * @internal
	 */
	private getActionAPI;
	/**
	 * Set the badge text
	 *
	 * @param details - Badge text configuration
	 *
	 * @example
	 * ```typescript
	 * // Show badge on all tabs
	 * await action.setBadgeText({ text: '99+' });
	 *
	 * // Show badge on specific tab
	 * await action.setBadgeText({ text: '3', tabId: 123 });
	 *
	 * // Clear badge
	 * await action.setBadgeText({ text: '' });
	 * ```
	 */
	setBadgeText(details: BadgeTextDetails): Promise<void>;
	/**
	 * Get the current badge text
	 *
	 * @param details - Tab to get badge text for
	 * @returns The current badge text
	 *
	 * @example
	 * ```typescript
	 * const text = await action.getBadgeText({ tabId: 123 });
	 * console.log('Badge text:', text);
	 * ```
	 */
	getBadgeText(details?: TabDetails): Promise<string>;
	/**
	 * Set the badge background color
	 *
	 * @param details - Badge color configuration
	 *
	 * @example
	 * ```typescript
	 * // Using hex color
	 * await action.setBadgeBackgroundColor({ color: '#FF0000' });
	 *
	 * // Using RGBA array
	 * await action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
	 *
	 * // Per-tab color
	 * await action.setBadgeBackgroundColor({ color: '#00FF00', tabId: 123 });
	 * ```
	 */
	setBadgeBackgroundColor(details: BadgeColorDetails): Promise<void>;
	/**
	 * Get the current badge background color
	 *
	 * @param details - Tab to get color for
	 * @returns The current badge color as RGBA array
	 */
	getBadgeBackgroundColor(details?: TabDetails): Promise<[
		number,
		number,
		number,
		number
	]>;
	/**
	 * Set the badge text color (Chrome 110+)
	 *
	 * @param details - Badge text color configuration
	 *
	 * @example
	 * ```typescript
	 * await action.setBadgeTextColor({ color: '#FFFFFF' });
	 * ```
	 */
	setBadgeTextColor(details: BadgeColorDetails): Promise<void>;
	/**
	 * Set the extension icon
	 *
	 * @param details - Icon configuration
	 *
	 * @example Using path
	 * ```typescript
	 * await action.setIcon({ path: 'icons/active.png' });
	 * ```
	 *
	 * @example Using multiple sizes
	 * ```typescript
	 * await action.setIcon({
	 *   path: {
	 *     16: 'icons/icon16.png',
	 *     32: 'icons/icon32.png',
	 *     48: 'icons/icon48.png'
	 *   }
	 * });
	 * ```
	 *
	 * @example Per-tab icon
	 * ```typescript
	 * await action.setIcon({
	 *   path: 'icons/special.png',
	 *   tabId: 123
	 * });
	 * ```
	 */
	setIcon(details: IconDetails): Promise<void>;
	/**
	 * Set the tooltip title
	 *
	 * @param details - Title configuration
	 *
	 * @example
	 * ```typescript
	 * await action.setTitle({ title: 'My Extension - Active' });
	 *
	 * // Per-tab title
	 * await action.setTitle({
	 *   title: 'Processing...',
	 *   tabId: 123
	 * });
	 * ```
	 */
	setTitle(details: TitleDetails): Promise<void>;
	/**
	 * Get the current tooltip title
	 *
	 * @param details - Tab to get title for
	 * @returns The current title
	 */
	getTitle(details?: TabDetails): Promise<string>;
	/**
	 * Set the popup HTML page
	 *
	 * @param details - Popup configuration
	 *
	 * @example
	 * ```typescript
	 * // Set popup
	 * await action.setPopup({ popup: 'popup.html' });
	 *
	 * // Disable popup (clicks will trigger onClicked)
	 * await action.setPopup({ popup: '' });
	 *
	 * // Per-tab popup
	 * await action.setPopup({
	 *   popup: 'special-popup.html',
	 *   tabId: 123
	 * });
	 * ```
	 */
	setPopup(details: PopupDetails): Promise<void>;
	/**
	 * Get the current popup path
	 *
	 * @param details - Tab to get popup for
	 * @returns The current popup path
	 */
	getPopup(details?: TabDetails): Promise<string>;
	/**
	 * Enable the action for a tab
	 *
	 * @param tabId - Tab ID to enable for (null for all tabs)
	 *
	 * @example
	 * ```typescript
	 * await action.enable(123); // Enable for specific tab
	 * await action.enable();    // Enable for all tabs
	 * ```
	 */
	enable(tabId?: number): Promise<void>;
	/**
	 * Disable the action for a tab
	 *
	 * @param tabId - Tab ID to disable for (null for all tabs)
	 *
	 * @example
	 * ```typescript
	 * await action.disable(123); // Disable for specific tab
	 * await action.disable();    // Disable for all tabs
	 * ```
	 */
	disable(tabId?: number): Promise<void>;
	/**
	 * Check if the action is enabled
	 *
	 * @param tabId - Tab ID to check
	 * @returns True if enabled
	 */
	isEnabled(tabId?: number): Promise<boolean>;
	/**
	 * Open the popup programmatically (MV3, Chrome 99+)
	 *
	 * @example
	 * ```typescript
	 * // Open popup from a user gesture handler
	 * await action.openPopup();
	 * ```
	 */
	openPopup(): Promise<void>;
	/**
	 * Register a listener for action clicks
	 *
	 * Only fires when no popup is set for the action.
	 *
	 * @param listener - Callback when action is clicked
	 *
	 * @example
	 * ```typescript
	 * action.onClicked((tab) => {
	 *   console.log('Clicked on tab:', tab.url);
	 *   // Toggle some functionality
	 *   toggleFeature(tab.id);
	 * });
	 * ```
	 */
	onClicked(listener: ActionClickedListener): void;
	/**
	 * Remove an action click listener
	 *
	 * @param listener - The listener to remove
	 */
	offClicked(listener: ActionClickedListener): void;
	/**
	 * Check if the action API is available
	 *
	 * @returns True if the API is available
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listener
	 * @internal
	 */
	private initializeListener;
}
/**
 * Window state types
 */
export type WindowState = "normal" | "minimized" | "maximized" | "fullscreen" | "docked";
type WindowType$1 = "normal" | "popup" | "panel" | "devtools";
/**
 * Options for creating a window
 */
export interface CreateWindowData {
	/** URL or array of URLs to open in the window */
	url?: string | string[];
	/** Tab ID to move into the new window */
	tabId?: number;
	/** Left position in pixels */
	left?: number;
	/** Top position in pixels */
	top?: number;
	/** Width in pixels */
	width?: number;
	/** Height in pixels */
	height?: number;
	/** Whether the window is focused */
	focused?: boolean;
	/** Whether the window is incognito */
	incognito?: boolean;
	/** Window type */
	type?: WindowType$1;
	/** Window state */
	state?: WindowState;
	/** Whether to set the new window as the active window (Chrome only) */
	setSelfAsOpener?: boolean;
}
/**
 * Options for updating a window
 */
export interface UpdateWindowInfo {
	/** Left position in pixels */
	left?: number;
	/** Top position in pixels */
	top?: number;
	/** Width in pixels */
	width?: number;
	/** Height in pixels */
	height?: number;
	/** Whether the window is focused */
	focused?: boolean;
	/** Window state */
	state?: WindowState;
	/** Whether to draw attention to the window */
	drawAttention?: boolean;
}
/**
 * Options for querying windows
 */
export interface QueryWindowInfo {
	/** Whether to populate tabs array */
	populate?: boolean;
	/** Filter by window types */
	windowTypes?: WindowType$1[];
}
interface Window$1 {
	/** Window ID */
	id?: number;
	/** Whether this is the currently focused window */
	focused: boolean;
	/** Window top position */
	top?: number;
	/** Window left position */
	left?: number;
	/** Window width */
	width?: number;
	/** Window height */
	height?: number;
	/** Whether window is incognito */
	incognito: boolean;
	/** Window type */
	type?: WindowType$1;
	/** Window state */
	state?: WindowState;
	/** Whether window always appears on top */
	alwaysOnTop: boolean;
	/** Tabs in this window (if populated) */
	tabs?: chrome.tabs.Tab[];
	/** Session ID for this window */
	sessionId?: string;
}
/**
 * Callback for focus change events
 */
export type FocusChangedListener = (windowId: number) => void;
/**
 * Callback for window created events
 */
export type WindowCreatedListener = (window: Window$1) => void;
/**
 * Callback for window removed events
 */
export type WindowRemovedListener = (windowId: number) => void;
declare class QevoWindows extends QevoLogger {
	private focusChangedListeners;
	private createdListeners;
	private removedListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * Create a new browser window
	 *
	 * @param createData - Window configuration
	 * @returns The created window
	 *
	 * @example Basic window
	 * ```typescript
	 * const win = await windows.create({
	 *   url: 'https://example.com'
	 * });
	 * ```
	 *
	 * @example Popup window
	 * ```typescript
	 * const popup = await windows.create({
	 *   url: 'settings.html',
	 *   type: 'popup',
	 *   width: 600,
	 *   height: 400,
	 *   focused: true
	 * });
	 * ```
	 *
	 * @example Incognito window
	 * ```typescript
	 * const incognito = await windows.create({
	 *   url: 'https://private.example.com',
	 *   incognito: true
	 * });
	 * ```
	 *
	 * @example Multiple URLs
	 * ```typescript
	 * const win = await windows.create({
	 *   url: ['https://example.com', 'https://example.org']
	 * });
	 * ```
	 */
	create(): Promise<Window$1>;
	create(createData: CreateWindowData): Promise<Window$1>;
	/**
	 * Get a specific window by ID
	 *
	 * @param windowId - Window ID
	 * @param getInfo - Additional options
	 * @returns The window information
	 *
	 * @example
	 * ```typescript
	 * const win = await windows.get(123, { populate: true });
	 * console.log('Tabs in window:', win.tabs?.length);
	 * ```
	 */
	get(windowId: number): Promise<Window$1>;
	get(windowId: number, getInfo: QueryWindowInfo): Promise<Window$1>;
	/**
	 * Get the current window
	 *
	 * @param getInfo - Additional options
	 * @returns The current window
	 *
	 * @example
	 * ```typescript
	 * const current = await windows.getCurrent({ populate: true });
	 * console.log('Current window has', current.tabs?.length, 'tabs');
	 * ```
	 */
	getCurrent(): Promise<Window$1>;
	getCurrent(getInfo: QueryWindowInfo): Promise<Window$1>;
	/**
	 * Get the last focused window
	 *
	 * @param getInfo - Additional options
	 * @returns The last focused window
	 *
	 * @example
	 * ```typescript
	 * const lastFocused = await windows.getLastFocused();
	 * console.log('Last focused window:', lastFocused.id);
	 * ```
	 */
	getLastFocused(): Promise<Window$1>;
	getLastFocused(getInfo: QueryWindowInfo): Promise<Window$1>;
	/**
	 * Get all windows
	 *
	 * @param getInfo - Additional options
	 * @returns Array of all windows
	 *
	 * @example
	 * ```typescript
	 * const allWindows = await windows.getAll({ populate: true });
	 * allWindows.forEach(win => {
	 *   console.log(`Window ${win.id}: ${win.tabs?.length} tabs`);
	 * });
	 * ```
	 */
	getAll(): Promise<Window$1[]>;
	getAll(getInfo: QueryWindowInfo): Promise<Window$1[]>;
	/**
	 * Update a window's properties
	 *
	 * @param windowId - Window ID to update
	 * @param updateInfo - Properties to update
	 * @returns The updated window
	 *
	 * @example Resize window
	 * ```typescript
	 * await windows.update(123, {
	 *   width: 1024,
	 *   height: 768
	 * });
	 * ```
	 *
	 * @example Maximize window
	 * ```typescript
	 * await windows.update(123, { state: 'maximized' });
	 * ```
	 *
	 * @example Focus window
	 * ```typescript
	 * await windows.update(123, { focused: true });
	 * ```
	 */
	update(windowId: number, updateInfo: UpdateWindowInfo): Promise<Window$1>;
	/**
	 * Close a window
	 *
	 * @param windowId - Window ID to close
	 *
	 * @example
	 * ```typescript
	 * await windows.remove(123);
	 * ```
	 */
	remove(windowId: number): Promise<void>;
	/**
	 * The ID of the window that has no focus (used by onFocusChanged)
	 */
	get WINDOW_ID_NONE(): number;
	/**
	 * The ID representing the current window
	 */
	get WINDOW_ID_CURRENT(): number;
	/**
	 * Register a listener for window focus changes
	 *
	 * @param listener - Callback when focus changes
	 *
	 * @example
	 * ```typescript
	 * windows.onFocusChanged((windowId) => {
	 *   if (windowId === windows.WINDOW_ID_NONE) {
	 *     console.log('No window focused');
	 *   } else {
	 *     console.log('Window focused:', windowId);
	 *   }
	 * });
	 * ```
	 */
	onFocusChanged(listener: FocusChangedListener): void;
	/**
	 * Remove a focus change listener
	 */
	offFocusChanged(listener: FocusChangedListener): void;
	/**
	 * Register a listener for window creation
	 *
	 * @param listener - Callback when window is created
	 */
	onCreated(listener: WindowCreatedListener): void;
	/**
	 * Remove a window created listener
	 */
	offCreated(listener: WindowCreatedListener): void;
	/**
	 * Register a listener for window removal
	 *
	 * @param listener - Callback when window is removed
	 */
	onRemoved(listener: WindowRemovedListener): void;
	/**
	 * Remove a window removed listener
	 */
	offRemoved(listener: WindowRemovedListener): void;
	/**
	 * Check if the windows API is available
	 *
	 * @returns True if the API is available
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listeners
	 * @internal
	 */
	private ensureListenersInitialized;
}
interface Permissions$1 {
	/** API permissions (e.g., 'history', 'bookmarks') */
	permissions?: string[];
	/** Host permissions (URL patterns) */
	origins?: string[];
}
/**
 * Callback for permission added events
 */
export type PermissionsAddedListener = (permissions: Permissions$1) => void;
/**
 * Callback for permission removed events
 */
export type PermissionsRemovedListener = (permissions: Permissions$1) => void;
declare class QevoPermissions extends QevoLogger {
	private addedListeners;
	private removedListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * Check if extension has specific permissions
	 *
	 * @param permissions - Permissions to check
	 * @returns True if all specified permissions are granted
	 *
	 * @example Check API permission
	 * ```typescript
	 * const hasBookmarks = await permissions.contains({
	 *   permissions: ['bookmarks']
	 * });
	 * ```
	 *
	 * @example Check host permission
	 * ```typescript
	 * const hasGoogleAccess = await permissions.contains({
	 *   origins: ['*://*.google.com/*']
	 * });
	 * ```
	 *
	 * @example Check multiple
	 * ```typescript
	 * const hasAll = await permissions.contains({
	 *   permissions: ['history', 'bookmarks'],
	 *   origins: ['*://*.example.com/*']
	 * });
	 * ```
	 */
	contains(permissions: Permissions$1): Promise<boolean>;
	/**
	 * Get all currently granted permissions
	 *
	 * @returns All granted permissions
	 *
	 * @example
	 * ```typescript
	 * const all = await permissions.getAll();
	 * console.log('Permissions:', all.permissions);
	 * console.log('Origins:', all.origins);
	 * ```
	 */
	getAll(): Promise<Permissions$1>;
	/**
	 * Request additional permissions
	 *
	 * Must be called from a user gesture (click handler, etc.).
	 * Only optional_permissions from manifest can be requested.
	 *
	 * @param permissions - Permissions to request
	 * @returns True if permissions were granted
	 *
	 * @example
	 * ```typescript
	 * button.onclick = async () => {
	 *   const granted = await permissions.request({
	 *     permissions: ['tabs'],
	 *     origins: ['*://*.example.com/*']
	 *   });
	 *
	 *   if (granted) {
	 *     console.log('Permissions granted!');
	 *   } else {
	 *     console.log('User denied permissions');
	 *   }
	 * };
	 * ```
	 */
	request(permissions: Permissions$1): Promise<boolean>;
	/**
	 * Remove previously granted permissions
	 *
	 * @param permissions - Permissions to remove
	 * @returns True if permissions were removed
	 *
	 * @example
	 * ```typescript
	 * // User disabled a feature, remove its permissions
	 * await permissions.remove({
	 *   permissions: ['history']
	 * });
	 * ```
	 */
	remove(permissions: Permissions$1): Promise<boolean>;
	/**
	 * Register a listener for permission additions
	 *
	 * @param listener - Callback when permissions are added
	 *
	 * @example
	 * ```typescript
	 * permissions.onAdded((perms) => {
	 *   console.log('New permissions:', perms.permissions);
	 *   // Enable features that require these permissions
	 * });
	 * ```
	 */
	onAdded(listener: PermissionsAddedListener): void;
	/**
	 * Remove a permission added listener
	 */
	offAdded(listener: PermissionsAddedListener): void;
	/**
	 * Register a listener for permission removals
	 *
	 * @param listener - Callback when permissions are removed
	 *
	 * @example
	 * ```typescript
	 * permissions.onRemoved((perms) => {
	 *   console.log('Removed permissions:', perms.permissions);
	 *   // Disable features that required these permissions
	 * });
	 * ```
	 */
	onRemoved(listener: PermissionsRemovedListener): void;
	/**
	 * Remove a permission removed listener
	 */
	offRemoved(listener: PermissionsRemovedListener): void;
	/**
	 * Check if the permissions API is available
	 *
	 * @returns True if the API is available
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listeners
	 * @internal
	 */
	private ensureListenersInitialized;
}
/**
 * Download state
 */
export type DownloadState = "in_progress" | "interrupted" | "complete";
/**
 * Interrupt reason
 */
export type InterruptReason = "FILE_FAILED" | "FILE_ACCESS_DENIED" | "FILE_NO_SPACE" | "FILE_NAME_TOO_LONG" | "FILE_TOO_LARGE" | "FILE_VIRUS_INFECTED" | "FILE_TRANSIENT_ERROR" | "FILE_BLOCKED" | "FILE_SECURITY_CHECK_FAILED" | "FILE_TOO_SHORT" | "NETWORK_FAILED" | "NETWORK_TIMEOUT" | "NETWORK_DISCONNECTED" | "NETWORK_SERVER_DOWN" | "NETWORK_INVALID_REQUEST" | "SERVER_FAILED" | "SERVER_NO_RANGE" | "SERVER_BAD_CONTENT" | "SERVER_UNAUTHORIZED" | "SERVER_CERT_PROBLEM" | "SERVER_FORBIDDEN" | "USER_CANCELED" | "USER_SHUTDOWN" | "CRASH";
/**
 * Download danger type
 */
export type DangerType = "file" | "url" | "content" | "uncommon" | "host" | "unwanted" | "safe" | "accepted";
/**
 * Options for downloading a file
 */
export interface DownloadOptions {
	/** URL to download */
	url: string;
	/** Suggested filename */
	filename?: string;
	/** Whether to save as (show file picker) */
	saveAs?: boolean;
	/** HTTP method (GET or POST) */
	method?: "GET" | "POST";
	/** Additional HTTP headers */
	headers?: Array<{
		name: string;
		value: string;
	}>;
	/** POST body */
	body?: string;
	/** Conflict action: 'uniquify', 'overwrite', or 'prompt' */
	conflictAction?: "uniquify" | "overwrite" | "prompt";
}
/**
 * Download item information
 */
export interface DownloadItem {
	/** Download ID */
	id: number;
	/** Download URL */
	url: string;
	/** Referrer URL */
	referrer?: string;
	/** Suggested filename */
	filename: string;
	/** Whether incognito */
	incognito: boolean;
	/** Danger type */
	danger: DangerType;
	/** MIME type */
	mime?: string;
	/** Start time */
	startTime: string;
	/** End time */
	endTime?: string;
	/** Estimated end time */
	estimatedEndTime?: string;
	/** Current state */
	state: DownloadState;
	/** Whether paused */
	paused: boolean;
	/** Whether can resume */
	canResume: boolean;
	/** Error message */
	error?: InterruptReason;
	/** Bytes received */
	bytesReceived: number;
	/** Total bytes (-1 if unknown) */
	totalBytes: number;
	/** File size (-1 if unknown) */
	fileSize: number;
	/** Whether exists */
	exists: boolean;
	/** By extension ID */
	byExtensionId?: string;
	/** By extension name */
	byExtensionName?: string;
}
/**
 * Query options for searching downloads
 */
export interface DownloadQuery {
	/** Filter by URL pattern */
	query?: string[];
	/** Start time */
	startedBefore?: string;
	/** Start time */
	startedAfter?: string;
	/** End time */
	endedBefore?: string;
	/** End time */
	endedAfter?: string;
	/** Total bytes */
	totalBytesGreater?: number;
	/** Total bytes */
	totalBytesLess?: number;
	/** Filename pattern */
	filenameRegex?: string;
	/** URL pattern */
	urlRegex?: string;
	/** Maximum results */
	limit?: number;
	/** Order by */
	orderBy?: string[];
	/** Download ID */
	id?: number;
	/** URL */
	url?: string;
	/** Filename */
	filename?: string;
	/** Danger type */
	danger?: DangerType;
	/** MIME type */
	mime?: string;
	/** Start time */
	startTime?: string;
	/** End time */
	endTime?: string;
	/** State */
	state?: DownloadState;
	/** Paused */
	paused?: boolean;
	/** Error */
	error?: InterruptReason;
	/** Bytes received */
	bytesReceived?: number;
	/** Total bytes */
	totalBytes?: number;
	/** File size */
	fileSize?: number;
	/** Exists */
	exists?: boolean;
}
/**
 * Download delta (changes)
 */
export interface DownloadDelta {
	/** Download ID */
	id: number;
	/** URL change */
	url?: {
		previous?: string;
		current?: string;
	};
	/** Filename change */
	filename?: {
		previous?: string;
		current?: string;
	};
	/** Danger change */
	danger?: {
		previous?: DangerType;
		current?: DangerType;
	};
	/** MIME change */
	mime?: {
		previous?: string;
		current?: string;
	};
	/** Start time change */
	startTime?: {
		previous?: string;
		current?: string;
	};
	/** End time change */
	endTime?: {
		previous?: string;
		current?: string;
	};
	/** State change */
	state?: {
		previous?: DownloadState;
		current?: DownloadState;
	};
	/** Can resume change */
	canResume?: {
		previous?: boolean;
		current?: boolean;
	};
	/** Paused change */
	paused?: {
		previous?: boolean;
		current?: boolean;
	};
	/** Error change */
	error?: {
		previous?: InterruptReason;
		current?: InterruptReason;
	};
	/** Total bytes change */
	totalBytes?: {
		previous?: number;
		current?: number;
	};
	/** File size change */
	fileSize?: {
		previous?: number;
		current?: number;
	};
	/** Exists change */
	exists?: {
		previous?: boolean;
		current?: boolean;
	};
}
/**
 * Callback for download created events
 */
export type DownloadCreatedListener = (downloadItem: DownloadItem) => void;
/**
 * Callback for download changed events
 */
export type DownloadChangedListener = (downloadDelta: DownloadDelta) => void;
/**
 * Callback for download erased events
 */
export type DownloadErasedListener = (downloadId: number) => void;
declare class QevoDownloads extends QevoLogger {
	private createdListeners;
	private changedListeners;
	private erasedListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * Download a file
	 *
	 * @param options - Download options
	 * @returns The download ID
	 *
	 * @example Simple download
	 * ```typescript
	 * const id = await downloads.download({
	 *   url: 'https://example.com/file.pdf'
	 * });
	 * ```
	 *
	 * @example Download with filename
	 * ```typescript
	 * const id = await downloads.download({
	 *   url: 'https://example.com/file.pdf',
	 *   filename: 'my-document.pdf',
	 *   saveAs: false
	 * });
	 * ```
	 *
	 * @example Download with save dialog
	 * ```typescript
	 * const id = await downloads.download({
	 *   url: 'https://example.com/file.pdf',
	 *   saveAs: true
	 * });
	 * ```
	 */
	download(options: DownloadOptions): Promise<number>;
	/**
	 * Search for downloads
	 *
	 * @param query - Search query
	 * @returns Matching download items
	 *
	 * @example
	 * ```typescript
	 * // Get all downloads
	 * const all = await downloads.search({});
	 *
	 * // Get completed downloads
	 * const completed = await downloads.search({ state: 'complete' });
	 *
	 * // Get by ID
	 * const [item] = await downloads.search({ id: 123 });
	 * ```
	 */
	search(query: DownloadQuery): Promise<DownloadItem[]>;
	/**
	 * Pause a download
	 *
	 * @param downloadId - Download ID to pause
	 */
	pause(downloadId: number): Promise<void>;
	/**
	 * Resume a paused download
	 *
	 * @param downloadId - Download ID to resume
	 */
	resume(downloadId: number): Promise<void>;
	/**
	 * Cancel a download
	 *
	 * @param downloadId - Download ID to cancel
	 */
	cancel(downloadId: number): Promise<void>;
	/**
	 * Erase download records (not files)
	 *
	 * @param query - Query to match downloads to erase
	 * @returns Array of erased download IDs
	 */
	erase(query: DownloadQuery): Promise<number[]>;
	/**
	 * Remove downloaded file from disk
	 *
	 * @param downloadId - Download ID
	 */
	removeFile(downloadId: number): Promise<void>;
	/**
	 * Open downloaded file
	 *
	 * @param downloadId - Download ID
	 */
	open(downloadId: number): Promise<void>;
	/**
	 * Show downloaded file in folder
	 *
	 * @param downloadId - Download ID
	 */
	show(downloadId: number): Promise<void>;
	/**
	 * Show downloads folder
	 */
	showDefaultFolder(): Promise<void>;
	/**
	 * Get the icon for a download as a data URL
	 *
	 * @param downloadId - Download ID
	 * @returns Data URL of the file icon, or undefined if not available
	 *
	 * @example
	 * ```typescript
	 * const iconUrl = await downloads.getFileIcon(123);
	 * if (iconUrl) img.src = iconUrl;
	 * ```
	 */
	getFileIcon(downloadId: number): Promise<string | undefined>;
	/**
	 * Get the icon for a download with specified size
	 *
	 * @param downloadId - Download ID
	 * @param options - Options including icon size (16 or 32 pixels)
	 * @returns Data URL of the file icon, or undefined if not available
	 *
	 * @example
	 * ```typescript
	 * const iconUrl = await downloads.getFileIcon(123, { size: 32 });
	 * if (iconUrl) img.src = iconUrl;
	 * ```
	 */
	getFileIcon(downloadId: number, options: {
		size?: 16 | 32;
	}): Promise<string | undefined>;
	/**
	 * Register listener for download creation
	 */
	onCreated(listener: DownloadCreatedListener): void;
	offCreated(listener: DownloadCreatedListener): void;
	/**
	 * Register listener for download changes
	 */
	onChanged(listener: DownloadChangedListener): void;
	offChanged(listener: DownloadChangedListener): void;
	/**
	 * Register listener for download erasure
	 */
	onErased(listener: DownloadErasedListener): void;
	offErased(listener: DownloadErasedListener): void;
	/**
	 * Check if the downloads API is available
	 */
	isAvailable(): boolean;
	private ensureListenersInitialized;
}
/**
 * History item
 */
export interface HistoryItem {
	/** History item ID */
	id: string;
	/** URL */
	url?: string;
	/** Page title */
	title?: string;
	/** Last visit time (ms since epoch) */
	lastVisitTime?: number;
	/** Visit count */
	visitCount?: number;
	/** Typed count (URL bar entries) */
	typedCount?: number;
}
/**
 * Visit item (individual visit)
 */
export interface VisitItem {
	/** Visit ID */
	id: string;
	/** Visit ID */
	visitId: string;
	/** Visit time (ms since epoch) */
	visitTime?: number;
	/** Referrer visit ID */
	referringVisitId: string;
	/** Transition type */
	transition: TransitionType;
}
/**
 * Transition types
 */
export type TransitionType = "link" | "typed" | "auto_bookmark" | "auto_subframe" | "manual_subframe" | "generated" | "auto_toplevel" | "form_submit" | "reload" | "keyword" | "keyword_generated";
/**
 * Search query options
 */
export interface HistoryQuery {
	/** Search text */
	text: string;
	/** Start time (ms since epoch) */
	startTime?: number;
	/** End time (ms since epoch) */
	endTime?: number;
	/** Maximum results */
	maxResults?: number;
}
/**
 * Options for adding URL
 */
export interface UrlDetails {
	/** URL to add */
	url: string;
	/** Optional title */
	title?: string;
	/** Optional transition type */
	transition?: TransitionType;
	/** Optional visit time */
	visitTime?: number;
}
/**
 * Options for deleting
 */
export interface DeleteRange {
	/** Start time (ms since epoch) */
	startTime: number;
	/** End time (ms since epoch) */
	endTime: number;
}
/**
 * Callback for URL visited events
 */
export type HistoryVisitedListener = (result: HistoryItem) => void;
/**
 * Callback for URL removed events
 */
export interface RemovedResult {
	/** Whether all history was removed */
	allHistory: boolean;
	/** Removed URLs (if not all) */
	urls?: string[];
}
export type HistoryRemovedListener = (removed: RemovedResult) => void;
declare class QevoHistory extends QevoLogger {
	private visitedListeners;
	private removedListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * Search browser history
	 *
	 * @param query - Search query
	 * @returns Matching history items
	 *
	 * @example Search by text
	 * ```typescript
	 * const results = await history.search({
	 *   text: 'github',
	 *   maxResults: 50
	 * });
	 * ```
	 *
	 * @example Get recent history
	 * ```typescript
	 * const recent = await history.search({
	 *   text: '',
	 *   startTime: Date.now() - 3600000, // Last hour
	 *   maxResults: 20
	 * });
	 * ```
	 */
	search(query: HistoryQuery): Promise<HistoryItem[]>;
	/**
	 * Get visits for a URL
	 *
	 * @param url - URL to get visits for
	 * @returns Array of visit items
	 *
	 * @example
	 * ```typescript
	 * const visits = await history.getVisits({ url: 'https://example.com' });
	 * visits.forEach(v => {
	 *   console.log('Visited at:', new Date(v.visitTime));
	 * });
	 * ```
	 */
	getVisits(details: {
		url: string;
	}): Promise<VisitItem[]>;
	/**
	 * Add a URL to history
	 *
	 * @param details - URL details
	 *
	 * @example
	 * ```typescript
	 * await history.addUrl({
	 *   url: 'https://example.com',
	 *   title: 'Example Site'
	 * });
	 * ```
	 */
	addUrl(details: UrlDetails): Promise<void>;
	/**
	 * Delete a URL from history
	 *
	 * @param details - URL to delete
	 *
	 * @example
	 * ```typescript
	 * await history.deleteUrl({ url: 'https://example.com' });
	 * ```
	 */
	deleteUrl(details: {
		url: string;
	}): Promise<void>;
	/**
	 * Delete history within a time range
	 *
	 * @param range - Time range to delete
	 *
	 * @example
	 * ```typescript
	 * // Delete last hour of history
	 * await history.deleteRange({
	 *   startTime: Date.now() - 3600000,
	 *   endTime: Date.now()
	 * });
	 * ```
	 */
	deleteRange(range: DeleteRange): Promise<void>;
	/**
	 * Delete all history
	 *
	 * @example
	 * ```typescript
	 * await history.deleteAll();
	 * ```
	 */
	deleteAll(): Promise<void>;
	/**
	 * Register listener for URL visits
	 */
	onVisited(listener: HistoryVisitedListener): void;
	offVisited(listener: HistoryVisitedListener): void;
	/**
	 * Register listener for history removal
	 */
	onVisitRemoved(listener: HistoryRemovedListener): void;
	offVisitRemoved(listener: HistoryRemovedListener): void;
	/**
	 * Check if the history API is available
	 */
	isAvailable(): boolean;
	private ensureListenersInitialized;
}
/**
 * Bookmark tree node
 */
export interface BookmarkTreeNode {
	/** Bookmark ID */
	id: string;
	/** Parent folder ID */
	parentId?: string;
	/** Position within parent */
	index?: number;
	/** URL (undefined for folders) */
	url?: string;
	/** Title */
	title: string;
	/** Date added (ms since epoch) */
	dateAdded?: number;
	/** Date last modified (folders only) */
	dateGroupModified?: number;
	/** Whether unmodifiable (e.g., managed bookmarks) */
	unmodifiable?: "managed";
	/** Children (folders only) */
	children?: BookmarkTreeNode[];
}
/**
 * Options for creating a bookmark
 */
export interface CreateDetails {
	/** Parent folder ID */
	parentId?: string;
	/** Position within parent */
	index?: number;
	/** Bookmark title */
	title?: string;
	/** Bookmark URL (omit for folder) */
	url?: string;
}
/**
 * Options for updating a bookmark
 */
export interface UpdateChanges {
	/** New title */
	title?: string;
	/** New URL */
	url?: string;
}
/**
 * Options for moving a bookmark
 */
export interface MoveDestination {
	/** New parent folder ID */
	parentId?: string;
	/** New position within parent */
	index?: number;
}
/**
 * Callback for bookmark created events
 */
export type BookmarkCreatedListener = (id: string, bookmark: BookmarkTreeNode) => void;
/**
 * Callback for bookmark removed events
 */
export interface RemoveInfo {
	parentId: string;
	index: number;
	node: BookmarkTreeNode;
}
export type BookmarkRemovedListener = (id: string, removeInfo: RemoveInfo) => void;
/**
 * Callback for bookmark changed events
 */
export interface ChangeInfo {
	title: string;
	url?: string;
}
export type BookmarkChangedListener = (id: string, changeInfo: ChangeInfo) => void;
/**
 * Callback for bookmark moved events
 */
export interface MoveInfo {
	parentId: string;
	index: number;
	oldParentId: string;
	oldIndex: number;
}
export type BookmarkMovedListener = (id: string, moveInfo: MoveInfo) => void;
declare class QevoBookmarks extends QevoLogger {
	private createdListeners;
	private removedListeners;
	private changedListeners;
	private movedListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * Get the entire bookmark tree
	 *
	 * @returns The complete bookmark tree
	 *
	 * @example
	 * ```typescript
	 * const tree = await bookmarks.getTree();
	 * // tree[0] is the root, with children
	 * ```
	 */
	getTree(): Promise<BookmarkTreeNode[]>;
	/**
	 * Get a bookmark subtree
	 *
	 * @param id - Root node ID
	 * @returns Subtree starting from the given node
	 */
	getSubTree(id: string): Promise<BookmarkTreeNode[]>;
	/**
	 * Get a specific bookmark by ID
	 *
	 * @param id - Bookmark ID
	 * @returns Matching bookmark nodes
	 *
	 * @example
	 * ```typescript
	 * const [bookmark] = await bookmarks.get('123');
	 * console.log(bookmark.title, bookmark.url);
	 * ```
	 */
	get(id: string): Promise<BookmarkTreeNode[]>;
	/**
	 * Get multiple bookmarks by IDs
	 *
	 * @param ids - Array of bookmark IDs
	 * @returns Matching bookmark nodes
	 *
	 * @example
	 * ```typescript
	 * const bookmarkList = await bookmarks.get(['123', '456', '789']);
	 * bookmarkList.forEach(b => console.log(b.title));
	 * ```
	 */
	get(ids: string[]): Promise<BookmarkTreeNode[]>;
	/**
	 * Get children of a folder
	 *
	 * @param id - Folder ID
	 * @returns Children of the folder
	 */
	getChildren(id: string): Promise<BookmarkTreeNode[]>;
	/**
	 * Get recently added bookmarks
	 *
	 * @param numberOfItems - Maximum number to return
	 * @returns Recently added bookmarks
	 *
	 * @example
	 * ```typescript
	 * const recent = await bookmarks.getRecent(10);
	 * recent.forEach(b => console.log(b.title));
	 * ```
	 */
	getRecent(numberOfItems: number): Promise<BookmarkTreeNode[]>;
	/**
	 * Search bookmarks by text
	 *
	 * @param query - Search string to match against title and URL
	 * @returns Matching bookmarks
	 *
	 * @example
	 * ```typescript
	 * const results = await bookmarks.search('github');
	 * ```
	 */
	search(query: string): Promise<BookmarkTreeNode[]>;
	/**
	 * Search bookmarks with detailed query options
	 *
	 * @param query - Query object with optional filters
	 * @returns Matching bookmarks
	 *
	 * @example Search by URL
	 * ```typescript
	 * const results = await bookmarks.search({ url: 'https://example.com' });
	 * ```
	 *
	 * @example Search by title
	 * ```typescript
	 * const results = await bookmarks.search({ title: 'My Bookmark' });
	 * ```
	 */
	search(query: {
		query?: string;
		url?: string;
		title?: string;
	}): Promise<BookmarkTreeNode[]>;
	/**
	 * Create a bookmark or folder
	 *
	 * @param bookmark - Bookmark details
	 * @returns The created bookmark
	 *
	 * @example Create bookmark
	 * ```typescript
	 * const bookmark = await bookmarks.create({
	 *   title: 'Example',
	 *   url: 'https://example.com'
	 * });
	 * ```
	 *
	 * @example Create folder
	 * ```typescript
	 * const folder = await bookmarks.create({
	 *   title: 'My Folder'
	 *   // No URL = folder
	 * });
	 * ```
	 */
	create(bookmark: CreateDetails): Promise<BookmarkTreeNode>;
	/**
	 * Update a bookmark
	 *
	 * @param id - Bookmark ID
	 * @param changes - Changes to apply
	 * @returns The updated bookmark
	 *
	 * @example
	 * ```typescript
	 * const updated = await bookmarks.update('123', {
	 *   title: 'New Title',
	 *   url: 'https://new-url.com'
	 * });
	 * ```
	 */
	update(id: string, changes: UpdateChanges): Promise<BookmarkTreeNode>;
	/**
	 * Move a bookmark
	 *
	 * @param id - Bookmark ID
	 * @param destination - New location
	 * @returns The moved bookmark
	 *
	 * @example
	 * ```typescript
	 * await bookmarks.move('123', {
	 *   parentId: 'folder-id',
	 *   index: 0  // First position
	 * });
	 * ```
	 */
	move(id: string, destination: MoveDestination): Promise<BookmarkTreeNode>;
	/**
	 * Remove a bookmark
	 *
	 * @param id - Bookmark ID
	 */
	remove(id: string): Promise<void>;
	/**
	 * Remove a folder and all its contents
	 *
	 * @param id - Folder ID
	 */
	removeTree(id: string): Promise<void>;
	onCreated(listener: BookmarkCreatedListener): void;
	offCreated(listener: BookmarkCreatedListener): void;
	onRemoved(listener: BookmarkRemovedListener): void;
	offRemoved(listener: BookmarkRemovedListener): void;
	onChanged(listener: BookmarkChangedListener): void;
	offChanged(listener: BookmarkChangedListener): void;
	onMoved(listener: BookmarkMovedListener): void;
	offMoved(listener: BookmarkMovedListener): void;
	isAvailable(): boolean;
	private ensureListenersInitialized;
}
/**
 * Options for getting auth token
 */
export interface TokenDetails {
	/** Whether to show interactive login */
	interactive?: boolean;
	/** Account to authenticate */
	account?: AccountInfo;
	/** OAuth scopes to request */
	scopes?: string[];
}
/**
 * Account information
 */
export interface AccountInfo {
	/** Account ID */
	id: string;
}
/**
 * Profile information (Chrome only)
 */
export interface ProfileUserInfo {
	/** User email */
	email: string;
	/** User ID */
	id: string;
}
/**
 * Options for web auth flow
 */
export interface WebAuthFlowDetails {
	/** OAuth URL to open */
	url: string;
	/** Whether to show interactive window */
	interactive?: boolean;
}
declare class QevoIdentity extends QevoLogger {
	constructor(debug?: boolean);
	/**
	 * Get an OAuth2 access token (Chrome only with identity API)
	 *
	 * This is Chrome's built-in OAuth flow for Google services.
	 * For other providers, use launchWebAuthFlow.
	 *
	 * @param details - Token request options
	 * @returns The access token
	 *
	 * @example
	 * ```typescript
	 * const token = await identity.getAuthToken({
	 *   interactive: true,
	 *   scopes: ['email', 'profile']
	 * });
	 * ```
	 */
	getAuthToken(details?: TokenDetails): Promise<string | undefined>;
	/**
	 * Remove a cached auth token
	 *
	 * @param details - Token to remove
	 *
	 * @example
	 * ```typescript
	 * // Remove token to force re-authentication
	 * await identity.removeCachedAuthToken({ token: currentToken });
	 * ```
	 */
	removeCachedAuthToken(details: {
		token: string;
	}): Promise<void>;
	/**
	 * Clear all cached auth tokens
	 *
	 * @example
	 * ```typescript
	 * await identity.clearAllCachedAuthTokens();
	 * ```
	 */
	clearAllCachedAuthTokens(): Promise<void>;
	/**
	 * Launch OAuth web authentication flow
	 *
	 * Works with any OAuth provider. Opens a popup window for authentication.
	 *
	 * @param details - Auth flow options
	 * @returns The redirect URL containing the token
	 *
	 * @example GitHub OAuth
	 * ```typescript
	 * const redirectUrl = identity.getRedirectURL();
	 * const authUrl = `https://github.com/login/oauth/authorize?` +
	 *   `client_id=${CLIENT_ID}&` +
	 *   `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
	 *   `scope=user:email`;
	 *
	 * const responseUrl = await identity.launchWebAuthFlow({
	 *   url: authUrl,
	 *   interactive: true
	 * });
	 *
	 * const code = new URL(responseUrl).searchParams.get('code');
	 * ```
	 */
	launchWebAuthFlow(details: WebAuthFlowDetails): Promise<string>;
	/**
	 * Get the redirect URL for OAuth
	 *
	 * @param path - Optional path to append
	 * @returns The redirect URL to use in OAuth
	 *
	 * @example
	 * ```typescript
	 * const url = identity.getRedirectURL();
	 * // https://<extension-id>.chromiumapp.org/
	 *
	 * const urlWithPath = identity.getRedirectURL('oauth2');
	 * // https://<extension-id>.chromiumapp.org/oauth2
	 * ```
	 */
	getRedirectURL(path?: string): string;
	/**
	 * Get profile information for signed-in user (Chrome only)
	 *
	 * @returns User profile information
	 *
	 * @example
	 * ```typescript
	 * const profile = await identity.getProfileUserInfo();
	 * console.log('Email:', profile.email);
	 * ```
	 */
	getProfileUserInfo(): Promise<ProfileUserInfo | undefined>;
	/**
	 * Get list of accounts (Chrome only)
	 *
	 * @returns Array of accounts
	 *
	 * @example
	 * ```typescript
	 * const accounts = await identity.getAccounts();
	 * accounts.forEach(a => console.log(a.id));
	 * ```
	 */
	getAccounts(): Promise<AccountInfo[]>;
	/**
	 * Check if the identity API is available
	 */
	isAvailable(): boolean;
}
/**
 * Command information
 */
export interface Command {
	/** Command name from manifest */
	name?: string;
	/** Command description */
	description?: string;
	/** Current keyboard shortcut */
	shortcut?: string;
}
/**
 * Callback for command events
 */
export type CommandListener = (command: string, tab?: chrome.tabs.Tab) => void;
declare class QevoCommands extends QevoLogger {
	private commandListeners;
	private listenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Get all registered commands
	 *
	 * @returns Array of command definitions
	 *
	 * @example
	 * ```typescript
	 * const commands = await commands.getAll();
	 * commands.forEach(cmd => {
	 *   console.log(`${cmd.name}: ${cmd.shortcut || 'No shortcut'}`);
	 * });
	 * ```
	 */
	getAll(): Promise<Command[]>;
	/**
	 * Register a listener for command events
	 *
	 * @param listener - Callback when command is triggered
	 *
	 * @example
	 * ```typescript
	 * commands.onCommand((command, tab) => {
	 *   console.log(`Command "${command}" triggered`);
	 *   if (tab) {
	 *     console.log(`On tab: ${tab.url}`);
	 *   }
	 * });
	 * ```
	 */
	onCommand(listener: CommandListener): void;
	/**
	 * Remove a command listener
	 *
	 * @param listener - The listener to remove
	 */
	offCommand(listener: CommandListener): void;
	/**
	 * Check if the commands API is available
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listener
	 * @internal
	 */
	private initializeListener;
}
declare class QevoI18n extends QevoLogger {
	constructor(debug?: boolean);
	/**
	 * Get a translated message without substitutions
	 *
	 * @param messageName - Name of the message from messages.json
	 * @returns The translated message, or empty string if not found
	 *
	 * @example Simple message
	 * ```typescript
	 * const title = i18n.getMessage('extensionTitle');
	 * ```
	 *
	 * @example Predefined messages
	 * ```typescript
	 * // Use @@ prefix for predefined messages
	 * const extName = i18n.getMessage('@@extension_id');
	 * const uiLocale = i18n.getMessage('@@ui_locale');
	 * const bidirDir = i18n.getMessage('@@bidi_dir'); // 'ltr' or 'rtl'
	 * ```
	 */
	getMessage(messageName: string): string;
	/**
	 * Get a translated message with a single substitution
	 *
	 * @param messageName - Name of the message from messages.json
	 * @param substitution - Substitution string for placeholder
	 * @returns The translated message, or empty string if not found
	 *
	 * @example
	 * ```typescript
	 * const greeting = i18n.getMessage('hello', 'John');
	 * // "Hello, John!"
	 * ```
	 */
	getMessage(messageName: string, substitution: string): string;
	/**
	 * Get a translated message with multiple substitutions
	 *
	 * @param messageName - Name of the message from messages.json
	 * @param substitutions - Array of substitution strings for placeholders
	 * @returns The translated message, or empty string if not found
	 *
	 * @example
	 * ```typescript
	 * // In messages.json:
	 * // "welcomeMessage": {
	 * //   "message": "Hello $NAME$! You have $COUNT$ messages.",
	 * //   "placeholders": {
	 * //     "name": { "content": "$1" },
	 * //     "count": { "content": "$2" }
	 * //   }
	 * // }
	 *
	 * const message = i18n.getMessage('welcomeMessage', ['John', '5']);
	 * // "Hello John! You have 5 messages."
	 * ```
	 */
	getMessage(messageName: string, substitutions: string[]): string;
	/**
	 * Get the browser UI language
	 *
	 * @returns The browser's UI language code (e.g., 'en', 'es', 'zh-CN')
	 *
	 * @example
	 * ```typescript
	 * const lang = i18n.getUILanguage();
	 * console.log('Browser language:', lang); // e.g., 'en-US'
	 * ```
	 */
	getUILanguage(): string;
	/**
	 * Get the accept languages in order of preference
	 *
	 * @returns Array of language codes in preference order
	 *
	 * @example
	 * ```typescript
	 * const languages = await i18n.getAcceptLanguages();
	 * console.log('Preferred languages:', languages);
	 * // e.g., ['en-US', 'en', 'es']
	 * ```
	 */
	getAcceptLanguages(): Promise<string[]>;
	/**
	 * Detect the language of a text string
	 *
	 * @param text - Text to analyze
	 * @returns Detection result with language and confidence
	 *
	 * @example
	 * ```typescript
	 * const result = await i18n.detectLanguage('Hola, ¿cómo estás?');
	 * console.log('Detected:', result.languages[0].language); // 'es'
	 * ```
	 */
	detectLanguage(text: string): Promise<{
		isReliable: boolean;
		languages: Array<{
			language: string;
			percentage: number;
		}>;
	}>;
	/**
	 * Check if the i18n API is available
	 */
	isAvailable(): boolean;
}
/**
 * Idle state values
 */
export type IdleState = "active" | "idle" | "locked";
/**
 * Callback for state change events
 */
export type IdleStateChangedListener = (newState: IdleState) => void;
declare class QevoIdle extends QevoLogger {
	private stateChangedListeners;
	private listenerInitialized;
	constructor(debug?: boolean);
	/**
	 * Query the current idle state
	 *
	 * @param detectionIntervalInSeconds - Threshold in seconds to consider user idle
	 * @returns Current idle state
	 *
	 * @example
	 * ```typescript
	 * // Check if user has been idle for more than 2 minutes
	 * const state = await idle.queryState(120);
	 *
	 * if (state === 'idle') {
	 *   console.log('User is away');
	 * } else if (state === 'locked') {
	 *   console.log('Screen is locked');
	 * } else {
	 *   console.log('User is active');
	 * }
	 * ```
	 */
	queryState(detectionIntervalInSeconds: number): Promise<IdleState>;
	/**
	 * Set the interval for idle detection
	 *
	 * This affects when onStateChanged fires for 'idle' state.
	 * Minimum is 15 seconds.
	 *
	 * @param intervalInSeconds - Idle threshold in seconds (minimum 15)
	 *
	 * @example
	 * ```typescript
	 * // Consider user idle after 5 minutes of inactivity
	 * idle.setDetectionInterval(300);
	 * ```
	 */
	setDetectionInterval(intervalInSeconds: number): void;
	/**
	 * Get the currently set auto-lock delay (Chrome 73+)
	 *
	 * @returns Auto-lock delay in seconds, or 0 if not available
	 *
	 * @example
	 * ```typescript
	 * const delay = await idle.getAutoLockDelay();
	 * console.log('Screen locks after', delay, 'seconds');
	 * ```
	 */
	getAutoLockDelay(): Promise<number>;
	/**
	 * Register a listener for idle state changes
	 *
	 * @param listener - Callback when state changes
	 *
	 * @example
	 * ```typescript
	 * idle.onStateChanged((state) => {
	 *   switch (state) {
	 *     case 'active':
	 *       console.log('User returned');
	 *       break;
	 *     case 'idle':
	 *       console.log('User went idle');
	 *       break;
	 *     case 'locked':
	 *       console.log('Screen locked');
	 *       break;
	 *   }
	 * });
	 * ```
	 */
	onStateChanged(listener: IdleStateChangedListener): void;
	/**
	 * Remove a state change listener
	 *
	 * @param listener - The listener to remove
	 */
	offStateChanged(listener: IdleStateChangedListener): void;
	/**
	 * Check if the idle API is available
	 */
	isAvailable(): boolean;
	/**
	 * Initialize browser event listener
	 * @internal
	 */
	private initializeListener;
}
/**
 * Platform OS types
 */
export type PlatformOS = "mac" | "win" | "android" | "cros" | "linux" | "openbsd" | "fuchsia";
/**
 * Platform architecture types
 */
export type PlatformArch = "arm" | "arm64" | "x86-32" | "x86-64" | "mips" | "mips64";
/**
 * Platform information
 */
export interface PlatformInfo {
	/** Operating system */
	os: PlatformOS;
	/** CPU architecture */
	arch: PlatformArch;
	/** Native client architecture (Chrome only) */
	nacl_arch?: string;
}
/**
 * Installation details
 */
export interface InstalledDetails {
	/** Reason for the event */
	reason: "install" | "update" | "chrome_update" | "shared_module_update";
	/** Previous version (for updates) */
	previousVersion?: string;
	/** ID of imported shared module (if applicable) */
	id?: string;
}
interface MessageSender$1 {
	/** Tab that sent the message */
	tab?: chrome.tabs.Tab;
	/** Frame ID */
	frameId?: number;
	/** Document ID (Chrome 106+) */
	documentId?: string;
	/** Document lifecycle (Chrome 106+) */
	documentLifecycle?: "prerender" | "active" | "cached" | "pending_deletion";
	/** Extension ID */
	id?: string;
	/** URL of the page/frame */
	url?: string;
	/** Native application name */
	nativeApplication?: string;
	/** TLS channel ID */
	tlsChannelId?: string;
	/** Origin of the sender */
	origin?: string;
}
/**
 * Port for long-lived connections
 */
export interface Port {
	/** Port name */
	name: string;
	/** Sender information */
	sender?: MessageSender$1;
	/** Disconnect the port */
	disconnect(): void;
	/** Post a message */
	postMessage(message: any): void;
	/** Message event */
	onMessage: {
		addListener(callback: (message: any, port: Port) => void): void;
		removeListener(callback: (message: any, port: Port) => void): void;
	};
	/** Disconnect event */
	onDisconnect: {
		addListener(callback: (port: Port) => void): void;
		removeListener(callback: (port: Port) => void): void;
	};
}
/**
 * Callback for install events
 */
export type InstalledListener = (details: InstalledDetails) => void;
/**
 * Callback for startup events
 */
export type StartupListener = () => void;
/**
 * Callback for suspend events
 */
export type SuspendListener = () => void;
/**
 * Callback for connect events
 */
export type ConnectListener = (port: Port) => void;
/**
 * Callback for update available events
 */
export type UpdateAvailableListener = (details: {
	version: string;
}) => void;
declare class QevoRuntime extends QevoLogger {
	private installedListeners;
	private startupListeners;
	private suspendListeners;
	private connectListeners;
	private updateAvailableListeners;
	private listenersInitialized;
	constructor(debug?: boolean);
	/**
	 * The extension's ID
	 *
	 * @example
	 * ```typescript
	 * console.log('Extension ID:', runtime.id);
	 * ```
	 */
	get id(): string;
	/**
	 * Get the extension's manifest
	 *
	 * @returns The parsed manifest.json
	 *
	 * @example
	 * ```typescript
	 * const manifest = runtime.getManifest();
	 * console.log('Version:', manifest.version);
	 * console.log('Name:', manifest.name);
	 * ```
	 */
	getManifest(): chrome.runtime.Manifest;
	/**
	 * Get URL to a resource in the extension
	 *
	 * @param path - Path relative to extension root
	 * @returns Full URL to the resource
	 *
	 * @example
	 * ```typescript
	 * const iconUrl = runtime.getURL('icons/icon48.png');
	 * const pageUrl = runtime.getURL('options.html');
	 * ```
	 */
	getURL(path: string): string;
	/**
	 * Get platform information
	 *
	 * @returns Platform OS and architecture
	 *
	 * @example
	 * ```typescript
	 * const platform = await runtime.getPlatformInfo();
	 * console.log('OS:', platform.os);
	 * console.log('Arch:', platform.arch);
	 * ```
	 */
	getPlatformInfo(): Promise<PlatformInfo>;
	/**
	 * Open the extension's options page
	 *
	 * @example
	 * ```typescript
	 * await runtime.openOptionsPage();
	 * ```
	 */
	openOptionsPage(): Promise<void>;
	/**
	 * Reload the extension
	 *
	 * @example
	 * ```typescript
	 * // Reload after settings change
	 * runtime.reload();
	 * ```
	 */
	reload(): void;
	/**
	 * Request an update check
	 *
	 * @returns Update check result
	 *
	 * @example
	 * ```typescript
	 * const result = await runtime.requestUpdateCheck();
	 * if (result.status === 'update_available') {
	 *   console.log('New version:', result.version);
	 * }
	 * ```
	 */
	requestUpdateCheck(): Promise<{
		status: string;
		version?: string;
	}>;
	/**
	 * Set uninstall URL
	 *
	 * @param url - URL to open when extension is uninstalled
	 *
	 * @example
	 * ```typescript
	 * await runtime.setUninstallURL('https://example.com/uninstall-survey');
	 * ```
	 */
	setUninstallURL(url: string): Promise<void>;
	/**
	 * Connect to another extension or native app
	 *
	 * @param connectInfo - Connection info with optional name
	 * @returns A Port for communication
	 *
	 * @example Connect within same extension
	 * ```typescript
	 * const port = runtime.connect({ name: 'my-channel' });
	 * port.postMessage({ type: 'hello' });
	 * port.onMessage.addListener((msg) => {
	 *   console.log('Received:', msg);
	 * });
	 * ```
	 */
	connect(connectInfo?: {
		name?: string;
	}): Port;
	/**
	 * Connect to another extension
	 *
	 * @param extensionId - Target extension ID
	 * @param connectInfo - Connection info with optional name
	 * @returns A Port for communication
	 *
	 * @example Connect to another extension
	 * ```typescript
	 * const port = runtime.connect('other-extension-id', { name: 'my-channel' });
	 * port.postMessage({ type: 'hello' });
	 * ```
	 */
	connect(extensionId: string, connectInfo?: {
		name?: string;
	}): Port;
	/**
	 * Connect to a native application
	 *
	 * @param application - Native app name from manifest
	 * @returns A Port for communication
	 *
	 * @example
	 * ```typescript
	 * const port = runtime.connectNative('com.example.myapp');
	 * port.postMessage({ command: 'getData' });
	 * ```
	 */
	connectNative(application: string): Port;
	/**
	 * Get the last error that occurred
	 *
	 * @returns The last error, or undefined
	 */
	get lastError(): chrome.runtime.LastError | undefined;
	/**
	 * Register listener for install/update events
	 */
	onInstalled(listener: InstalledListener): void;
	offInstalled(listener: InstalledListener): void;
	/**
	 * Register listener for browser startup
	 */
	onStartup(listener: StartupListener): void;
	offStartup(listener: StartupListener): void;
	/**
	 * Register listener for extension suspend (MV2)
	 */
	onSuspend(listener: SuspendListener): void;
	offSuspend(listener: SuspendListener): void;
	/**
	 * Register listener for port connections
	 */
	onConnect(listener: ConnectListener): void;
	offConnect(listener: ConnectListener): void;
	/**
	 * Register listener for update available
	 */
	onUpdateAvailable(listener: UpdateAvailableListener): void;
	offUpdateAvailable(listener: UpdateAvailableListener): void;
	/**
	 * Check if the runtime API is available
	 */
	isAvailable(): boolean;
	private ensureListenersInitialized;
}
/**
 * Qevo - Cross-Browser Extension Toolkit Core Class
 *
 * Singleton class providing unified cross-browser extension APIs.
 * Automatically detects Chrome vs Firefox and uses the appropriate native APIs.
 *
 * Access the singleton instance via the default export or `qevo` named export.
 *
 * @class Qevo
 *
 * @example Accessing APIs
 * ```typescript
 * import qevo from './qevo';
 *
 * // Access modular APIs
 * qevo.messages  // Message passing
 * qevo.tabs      // Tab management
 * qevo.storage   // Key-value storage
 * qevo.cookies   // Cookie management
 * qevo.webRequest // Network request interception
 *
 * // Check environment
 * qevo.debug = true; // Enable debug logging
 * console.log(qevo.getBrowserType()); // 'chrome' | 'firefox' | 'unknown'
 * ```
 */
export declare class Qevo {
	/** Singleton instance */
	private static instance;
	/** Debug mode flag - when true, enables console logging */
	private _debug;
	private _tabsInstance?;
	private _cookiesInstance?;
	private _messagesInstance?;
	private _webRequestInstance?;
	private _alarmsInstance?;
	private _notificationsInstance?;
	private _contextMenusInstance?;
	private _scriptingInstance?;
	private _actionInstance?;
	private _windowsInstance?;
	private _permissionsInstance?;
	private _downloadsInstance?;
	private _historyInstance?;
	private _bookmarksInstance?;
	private _identityInstance?;
	private _commandsInstance?;
	private _i18nInstance?;
	private _idleInstance?;
	private _runtimeInstance?;
	/**
	 * Private constructor - use `Qevo.getInstance()` or the `qevo` export
	 * @private
	 */
	private constructor();
	/**
	 * Enable or disable debug mode
	 *
	 * When enabled, Qevo and all its modules will log debug information
	 * to the console. Useful for development and troubleshooting.
	 *
	 * @param value - `true` to enable debug logging, `false` to disable
	 *
	 * @example
	 * ```typescript
	 * // Enable debug mode
	 * qevo.debug = true;
	 *
	 * // Disable debug mode (recommended for production)
	 * qevo.debug = false;
	 * ```
	 */
	set debug(value: boolean);
	/**
	 * Get current debug mode status
	 *
	 * @returns `true` if debug logging is enabled, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * if (qevo.debug) {
	 *   console.log('Debug mode is active');
	 * }
	 * ```
	 */
	get debug(): boolean;
	/**
	 * Tabs API - Query, create, update, and manage browser tabs
	 *
	 * Provides a complete wrapper around `chrome.tabs` / `browser.tabs` with
	 * consistent Promise-based APIs and TypeScript types.
	 *
	 * @returns {QevoTabs} Tabs API instance
	 *
	 * @example Query tabs
	 * ```typescript
	 * // Get all tabs
	 * const allTabs = await qevo.tabs.query({});
	 *
	 * // Get active tab in current window
	 * const [activeTab] = await qevo.tabs.query({ active: true, currentWindow: true });
	 *
	 * // Get tabs by URL pattern
	 * const gmailTabs = await qevo.tabs.query({ url: '*://mail.google.com/*' });
	 * ```
	 *
	 * @example Create and manage tabs
	 * ```typescript
	 * // Create a new tab
	 * const tab = await qevo.tabs.create({ url: 'https://example.com', active: false });
	 *
	 * // Update a tab
	 * await qevo.tabs.update(tab.id, { pinned: true });
	 *
	 * // Close a tab
	 * await qevo.tabs.remove(tab.id);
	 *
	 * // Reload a tab
	 * await qevo.tabs.reload(tab.id, { bypassCache: true });
	 * ```
	 *
	 * @example Tab events
	 * ```typescript
	 * // Listen for tab creation
	 * qevo.tabs.onCreated.addListener((tab) => {
	 *   console.log('New tab:', tab.url);
	 * });
	 *
	 * // Listen for tab updates
	 * qevo.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	 *   if (changeInfo.status === 'complete') {
	 *     console.log('Tab loaded:', tab.url);
	 *   }
	 * });
	 * ```
	 */
	get tabs(): QevoTabs;
	/**
	 * Cookies API - Read, write, and manage browser cookies
	 *
	 * Provides full access to `chrome.cookies` / `browser.cookies` with
	 * Promise-based APIs for all cookie operations.
	 *
	 * @returns {QevoCookies} Cookies API instance
	 *
	 * @example Get cookies
	 * ```typescript
	 * // Get a specific cookie
	 * const cookie = await qevo.cookies.get({
	 *   url: 'https://example.com',
	 *   name: 'session'
	 * });
	 *
	 * // Get all cookies for a domain
	 * const cookies = await qevo.cookies.getAll({ domain: 'example.com' });
	 *
	 * // Get all cookies
	 * const allCookies = await qevo.cookies.getAll({});
	 * ```
	 *
	 * @example Set and remove cookies
	 * ```typescript
	 * // Set a cookie
	 * await qevo.cookies.set({
	 *   url: 'https://example.com',
	 *   name: 'token',
	 *   value: 'abc123',
	 *   expirationDate: Date.now() / 1000 + 3600 // 1 hour
	 * });
	 *
	 * // Remove a cookie
	 * await qevo.cookies.remove({
	 *   url: 'https://example.com',
	 *   name: 'token'
	 * });
	 * ```
	 */
	get cookies(): QevoCookies;
	/**
	 * Messages API - Send and receive messages between extension contexts
	 *
	 * Enables communication between background scripts, content scripts,
	 * popups, and other extension pages with type-safe async/await patterns.
	 *
	 * @returns {QevoMessages} Messages API instance
	 *
	 * @example Listen for messages
	 * ```typescript
	 * // Register a message handler
	 * qevo.messages.on('getUserData', async (data, sender, sendResponse) => {
	 *   const user = await fetchUser(data.userId);
	 *   sendResponse({ user });
	 * });
	 *
	 * // Remove a specific listener
	 * qevo.messages.off('getUserData', myHandler);
	 *
	 * // Clear all listeners for a message type
	 * qevo.messages.clear('getUserData');
	 * ```
	 *
	 * @example Send messages
	 * ```typescript
	 * // Send to background script
	 * const response = await qevo.messages.sendToBackground('getUserData', { userId: 123 });
	 * if (response.success) {
	 *   console.log('User:', response.data.user);
	 * }
	 *
	 * // Send to a specific tab
	 * const tabResponse = await qevo.messages.sendToTab(tabId, 'highlight', { color: 'yellow' });
	 *
	 * // Broadcast to all tabs
	 * const responses = await qevo.messages.broadcast('refresh', { force: true });
	 * ```
	 *
	 * @example Message options
	 * ```typescript
	 * // Send with timeout and retries
	 * const response = await qevo.messages.sendToBackground('slowOperation', data, {
	 *   timeout: 30000,    // 30 second timeout
	 *   retries: 3,        // Retry up to 3 times
	 *   retryDelay: 1000   // Wait 1 second between retries
	 * });
	 * ```
	 */
	get messages(): QevoMessages;
	/**
	 * WebRequest API - Intercept and modify network requests
	 *
	 * **Background script only.** Provides access to `chrome.webRequest` /
	 * `browser.webRequest` for monitoring and modifying HTTP requests.
	 *
	 * @returns {QevoWebRequest} WebRequest API instance
	 *
	 * @example Monitor requests
	 * ```typescript
	 * // Log all requests
	 * qevo.webRequest.on('BeforeRequest', (details) => {
	 *   console.log('Request:', details.method, details.url);
	 * }, { urls: ['<all_urls>'] });
	 *
	 * // Monitor specific domains
	 * qevo.webRequest.on('Completed', (details) => {
	 *   console.log('Completed:', details.url, details.statusCode);
	 * }, { urls: ['*://api.example.com/*'] });
	 * ```
	 *
	 * @example Capture headers
	 * ```typescript
	 * // Capture request headers
	 * qevo.webRequest.on('SendHeaders', (details) => {
	 *   console.log('Headers:', details.requestHeaders);
	 * }, { urls: ['<all_urls>'] }, ['requestHeaders']);
	 *
	 * // Capture response headers
	 * qevo.webRequest.on('ResponseStarted', (details) => {
	 *   console.log('Response headers:', details.responseHeaders);
	 * }, { urls: ['<all_urls>'] }, ['responseHeaders']);
	 * ```
	 *
	 * @example Blocking requests (requires permissions)
	 * ```typescript
	 * // Block requests (requires 'webRequestBlocking' permission)
	 * qevo.webRequest.on('BeforeRequest', (details) => {
	 *   if (details.url.includes('tracking')) {
	 *     return { cancel: true };
	 *   }
	 * }, { urls: ['<all_urls>'] }, ['blocking']);
	 * ```
	 */
	get webRequest(): QevoWebRequest;
	/**
	 * Storage API - Key-value store with TTL support
	 *
	 * A high-level key-value storage API built on `chrome.storage.local` /
	 * `browser.storage.local` with automatic JSON serialization, TTL (time-to-live)
	 * support, and expiration cleanup.
	 *
	 * @returns {QevoKVStore} Storage API instance
	 *
	 * @example Basic operations
	 * ```typescript
	 * // Store a value
	 * await qevo.storage.put('user', { name: 'John', age: 30 });
	 *
	 * // Retrieve a value
	 * const user = await qevo.storage.get('user');
	 *
	 * // Delete a value
	 * await qevo.storage.delete('user');
	 *
	 * // Check if key exists
	 * const exists = await qevo.storage.has('user');
	 *
	 * // Get all keys
	 * const keys = await qevo.storage.keys();
	 * ```
	 *
	 * @example TTL (Time-to-Live)
	 * ```typescript
	 * // Store with 1 hour expiration
	 * await qevo.storage.put('token', 'abc123', { ttl: 3600 });
	 *
	 * // Store with 24 hour expiration
	 * await qevo.storage.put('cache', data, { ttl: 86400 });
	 *
	 * // Value automatically returns null after TTL expires
	 * const token = await qevo.storage.get('token'); // null after 1 hour
	 * ```
	 *
	 * @example Bulk operations
	 * ```typescript
	 * // Get multiple values
	 * const values = await qevo.storage.getMany(['key1', 'key2', 'key3']);
	 *
	 * // Clear all storage
	 * await qevo.storage.clear();
	 * ```
	 */
	get storage(): QevoKVStore;
	/**
	 * Alarms API - Schedule periodic or delayed tasks
	 *
	 * Provides access to `chrome.alarms` / `browser.alarms` for scheduling
	 * background tasks that run at specified times or intervals.
	 *
	 * @returns {QevoAlarms} Alarms API instance
	 *
	 * @example Create alarms
	 * ```typescript
	 * // One-time alarm in 5 minutes
	 * await qevo.alarms.create('reminder', { delayInMinutes: 5 });
	 *
	 * // Repeating alarm every hour
	 * await qevo.alarms.create('sync', { periodInMinutes: 60 });
	 *
	 * // Listen for alarms
	 * qevo.alarms.onAlarm((alarm) => {
	 *   if (alarm.name === 'sync') performSync();
	 * });
	 * ```
	 */
	get alarms(): QevoAlarms;
	/**
	 * Notifications API - Display system notifications
	 *
	 * Provides access to `chrome.notifications` / `browser.notifications`
	 * for showing native system notifications to users.
	 *
	 * @returns {QevoNotifications} Notifications API instance
	 *
	 * @example Show notifications
	 * ```typescript
	 * // Basic notification
	 * await qevo.notifications.create({
	 *   type: 'basic',
	 *   title: 'Download Complete',
	 *   message: 'Your file has been downloaded',
	 *   iconUrl: 'icon.png'
	 * });
	 *
	 * // Handle clicks
	 * qevo.notifications.onClicked((id) => openDetailsPage());
	 * ```
	 */
	get notifications(): QevoNotifications;
	/**
	 * Context Menus API - Create right-click context menus
	 *
	 * Provides access to `chrome.contextMenus` / `browser.contextMenus`
	 * for adding custom items to browser context menus.
	 *
	 * @returns {QevoContextMenus} Context Menus API instance
	 *
	 * @example Create context menu items
	 * ```typescript
	 * // Add menu item for text selection
	 * await qevo.contextMenus.create({
	 *   id: 'search',
	 *   title: 'Search for "%s"',
	 *   contexts: ['selection']
	 * });
	 *
	 * // Handle clicks
	 * qevo.contextMenus.onClicked((info, tab) => {
	 *   searchText(info.selectionText);
	 * });
	 * ```
	 */
	get contextMenus(): QevoContextMenus;
	/**
	 * Scripting API - Inject scripts into web pages (MV3)
	 *
	 * Provides access to `chrome.scripting` for programmatically injecting
	 * JavaScript and CSS into web pages. This is the MV3 replacement for
	 * `chrome.tabs.executeScript`.
	 *
	 * @returns {QevoScripting} Scripting API instance
	 *
	 * @example Inject scripts
	 * ```typescript
	 * // Execute script in a tab
	 * const results = await qevo.scripting.executeScript({
	 *   target: { tabId: tab.id },
	 *   func: () => document.title
	 * });
	 *
	 * // Inject CSS
	 * await qevo.scripting.insertCSS({
	 *   target: { tabId: tab.id },
	 *   css: 'body { background: yellow; }'
	 * });
	 * ```
	 */
	get scripting(): QevoScripting;
	/**
	 * Action API - Control the extension's toolbar icon
	 *
	 * Provides access to `chrome.action` (MV3) or `chrome.browserAction` (MV2)
	 * for controlling the extension's toolbar button appearance and behavior.
	 *
	 * @returns {QevoAction} Action API instance
	 *
	 * @example Control toolbar icon
	 * ```typescript
	 * // Set badge
	 * await qevo.action.setBadgeText({ text: '5' });
	 * await qevo.action.setBadgeBackgroundColor({ color: '#FF0000' });
	 *
	 * // Update icon
	 * await qevo.action.setIcon({ path: 'icons/active.png' });
	 *
	 * // Handle clicks
	 * qevo.action.onClicked((tab) => openPopup());
	 * ```
	 */
	get action(): QevoAction;
	/**
	 * Windows API - Manage browser windows
	 *
	 * Provides access to `chrome.windows` / `browser.windows` for creating,
	 * querying, and managing browser windows.
	 *
	 * @returns {QevoWindows} Windows API instance
	 *
	 * @example Manage windows
	 * ```typescript
	 * // Create new window
	 * const win = await qevo.windows.create({ url: 'popup.html', type: 'popup' });
	 *
	 * // Get current window
	 * const current = await qevo.windows.getCurrent();
	 *
	 * // Focus a window
	 * await qevo.windows.update(win.id, { focused: true });
	 * ```
	 */
	get windows(): QevoWindows;
	/**
	 * Permissions API - Request and check extension permissions
	 *
	 * Provides access to `chrome.permissions` / `browser.permissions` for
	 * dynamically requesting and checking optional permissions.
	 *
	 * @returns {QevoPermissions} Permissions API instance
	 *
	 * @example Manage permissions
	 * ```typescript
	 * // Check if we have a permission
	 * const hasHistory = await qevo.permissions.contains({ permissions: ['history'] });
	 *
	 * // Request permission
	 * const granted = await qevo.permissions.request({ permissions: ['history'] });
	 * ```
	 */
	get permissions(): QevoPermissions;
	/**
	 * Downloads API - Manage file downloads
	 *
	 * Provides access to `chrome.downloads` / `browser.downloads` for
	 * initiating, monitoring, and managing file downloads.
	 *
	 * @returns {QevoDownloads} Downloads API instance
	 *
	 * @example Download files
	 * ```typescript
	 * // Start download
	 * const id = await qevo.downloads.download({
	 *   url: 'https://example.com/file.pdf',
	 *   filename: 'document.pdf'
	 * });
	 *
	 * // Monitor progress
	 * qevo.downloads.onChanged((delta) => {
	 *   if (delta.state?.current === 'complete') {
	 *     console.log('Download complete');
	 *   }
	 * });
	 * ```
	 */
	get downloads(): QevoDownloads;
	/**
	 * History API - Access browser history
	 *
	 * Provides access to `chrome.history` / `browser.history` for
	 * searching, reading, and modifying browser history.
	 *
	 * @returns {QevoHistory} History API instance
	 *
	 * @example Work with history
	 * ```typescript
	 * // Search history
	 * const items = await qevo.history.search({ text: 'github', maxResults: 10 });
	 *
	 * // Get visits for a URL
	 * const visits = await qevo.history.getVisits({ url: 'https://github.com' });
	 *
	 * // Delete history
	 * await qevo.history.deleteUrl({ url: 'https://example.com' });
	 * ```
	 */
	get history(): QevoHistory;
	/**
	 * Bookmarks API - Manage browser bookmarks
	 *
	 * Provides access to `chrome.bookmarks` / `browser.bookmarks` for
	 * creating, reading, and organizing bookmarks.
	 *
	 * @returns {QevoBookmarks} Bookmarks API instance
	 *
	 * @example Work with bookmarks
	 * ```typescript
	 * // Get bookmark tree
	 * const tree = await qevo.bookmarks.getTree();
	 *
	 * // Create bookmark
	 * const bookmark = await qevo.bookmarks.create({
	 *   title: 'My Site',
	 *   url: 'https://example.com'
	 * });
	 *
	 * // Search bookmarks
	 * const results = await qevo.bookmarks.search('github');
	 * ```
	 */
	get bookmarks(): QevoBookmarks;
	/**
	 * Identity API - OAuth authentication
	 *
	 * Provides access to `chrome.identity` / `browser.identity` for
	 * OAuth-based authentication flows.
	 *
	 * @returns {QevoIdentity} Identity API instance
	 *
	 * @example OAuth authentication
	 * ```typescript
	 * // Get OAuth token (Chrome)
	 * const token = await qevo.identity.getAuthToken({ interactive: true });
	 *
	 * // Launch OAuth flow (cross-browser)
	 * const redirectUrl = await qevo.identity.launchWebAuthFlow({
	 *   url: 'https://accounts.google.com/o/oauth2/auth?...',
	 *   interactive: true
	 * });
	 * ```
	 */
	get identity(): QevoIdentity;
	/**
	 * Commands API - Keyboard shortcuts
	 *
	 * Provides access to `chrome.commands` / `browser.commands` for
	 * listening to keyboard shortcut events defined in manifest.json.
	 *
	 * @returns {QevoCommands} Commands API instance
	 *
	 * @example Handle keyboard shortcuts
	 * ```typescript
	 * // Get all registered commands
	 * const commands = await qevo.commands.getAll();
	 *
	 * // Listen for command execution
	 * qevo.commands.onCommand((command) => {
	 *   if (command === 'toggle-feature') toggleFeature();
	 * });
	 * ```
	 */
	get commands(): QevoCommands;
	/**
	 * I18n API - Internationalization
	 *
	 * Provides access to `chrome.i18n` / `browser.i18n` for accessing
	 * translated messages and language information.
	 *
	 * @returns {QevoI18n} I18n API instance
	 *
	 * @example Internationalization
	 * ```typescript
	 * // Get translated message
	 * const greeting = qevo.i18n.getMessage('greeting');
	 *
	 * // With substitutions
	 * const welcome = qevo.i18n.getMessage('welcome', ['John']);
	 *
	 * // Get browser language
	 * const lang = qevo.i18n.getUILanguage();
	 * ```
	 */
	get i18n(): QevoI18n;
	/**
	 * Idle API - User idle detection
	 *
	 * Provides access to `chrome.idle` / `browser.idle` for detecting
	 * when the user is idle or the system is locked.
	 *
	 * @returns {QevoIdle} Idle API instance
	 *
	 * @example Detect user idle state
	 * ```typescript
	 * // Check idle state
	 * const state = await qevo.idle.queryState(60);
	 * console.log('User is:', state); // 'active', 'idle', or 'locked'
	 *
	 * // Listen for state changes
	 * qevo.idle.onStateChanged((newState) => {
	 *   if (newState === 'idle') pauseSync();
	 * });
	 * ```
	 */
	get idle(): QevoIdle;
	/**
	 * Runtime API - Extension runtime management
	 *
	 * Provides access to `chrome.runtime` / `browser.runtime` for
	 * runtime information and lifecycle events.
	 *
	 * @returns {QevoRuntime} Runtime API instance
	 *
	 * @example Runtime operations
	 * ```typescript
	 * // Get extension info
	 * const manifest = qevo.runtime.getManifest();
	 * console.log('Version:', manifest.version);
	 *
	 * // Handle installation
	 * qevo.runtime.onInstalled((details) => {
	 *   if (details.reason === 'install') showWelcome();
	 * });
	 *
	 * // Get resource URL
	 * const iconUrl = qevo.runtime.getURL('icons/icon.png');
	 * ```
	 */
	get runtime(): QevoRuntime;
	/**
	 * Check if code is running in a background script context
	 *
	 * Useful for conditionally executing code that should only run
	 * in the background script (e.g., webRequest listeners).
	 *
	 * @returns `true` if running in background script, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * if (qevo.isBackgroundScript()) {
	 *   // Set up webRequest listeners
	 *   qevo.webRequest.on('BeforeRequest', handler, { urls: ['<all_urls>'] });
	 * }
	 * ```
	 */
	isBackgroundScript(): boolean;
	/**
	 * Check if code is running in a content script context
	 *
	 * Content scripts run in the context of web pages and have access
	 * to the DOM but limited access to extension APIs.
	 *
	 * @returns `true` if running in content script, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * if (qevo.isContentScript()) {
	 *   // Interact with page DOM
	 *   document.body.style.backgroundColor = 'yellow';
	 * }
	 * ```
	 */
	isContentScript(): boolean;
	/**
	 * Detect the browser type
	 *
	 * @returns `'chrome'` for Chromium browsers, `'firefox'` for Firefox, `'unknown'` otherwise
	 *
	 * @example
	 * ```typescript
	 * const browser = qevo.getBrowserType();
	 *
	 * if (browser === 'firefox') {
	 *   // Firefox-specific handling
	 * } else if (browser === 'chrome') {
	 *   // Chrome-specific handling
	 * }
	 * ```
	 */
	getBrowserType(): "chrome" | "firefox" | "unknown";
	/**
	 * Internal logging method - only outputs when debug mode is enabled
	 * @internal
	 */
	private log;
	/**
	 * Get the singleton Qevo instance
	 *
	 * @returns The Qevo singleton instance
	 *
	 * @example
	 * ```typescript
	 * const qevo = Qevo.getInstance();
	 * ```
	 */
	static getInstance(): Qevo;
}
/**
 * Qevo singleton instance
 *
 * This is the primary way to access Qevo functionality.
 *
 * @example
 * ```typescript
 * import { qevo } from './qevo';
 * // or
 * import qevo from './qevo';
 *
 * await qevo.tabs.query({ active: true });
 * ```
 */
export declare const qevo: Qevo;
/**
 * Check if running in background script context
 *
 * Standalone function for convenient imports.
 *
 * @returns `true` if running in background script, `false` otherwise
 *
 * @example
 * ```typescript
 * import { isBackgroundScript } from './qevo';
 *
 * if (isBackgroundScript()) {
 *   // Background-only code
 * }
 * ```
 *
 * @see {@link Qevo.isBackgroundScript}
 */
export declare const isBackgroundScript: () => boolean;
/**
 * Check if running in content script context
 *
 * Standalone function for convenient imports.
 *
 * @returns `true` if running in content script, `false` otherwise
 *
 * @example
 * ```typescript
 * import { isContentScript } from './qevo';
 *
 * if (isContentScript()) {
 *   // Content script-only code
 * }
 * ```
 *
 * @see {@link Qevo.isContentScript}
 */
export declare const isContentScript: () => boolean;
/**
 * Get the browser type
 *
 * Standalone function for convenient imports.
 *
 * @returns `'chrome'` | `'firefox'` | `'unknown'`
 *
 * @example
 * ```typescript
 * import { getBrowserType } from './qevo';
 *
 * const browserType = getBrowserType();
 * ```
 *
 * @see {@link Qevo.getBrowserType}
 */
export declare const getBrowserType: () => "chrome" | "firefox" | "unknown";
/**
 * Direct access to the Storage API
 *
 * Allows importing the storage API directly without going through the `qevo` object.
 *
 * @example
 * ```typescript
 * import { storage } from './qevo';
 *
 * await storage.put('key', 'value');
 * const value = await storage.get('key');
 * ```
 *
 * @see {@link Qevo.storage}
 */
export declare const storage: QevoKVStore;
/**
 * Direct access to the Cookies API
 *
 * Allows importing the cookies API directly without going through the `qevo` object.
 *
 * @example
 * ```typescript
 * import { cookies } from './qevo';
 *
 * const allCookies = await cookies.getAll({ domain: 'example.com' });
 * ```
 *
 * @see {@link Qevo.cookies}
 */
export declare const cookies: QevoCookies;
/**
 * Direct access to the Tabs API
 *
 * Allows importing the tabs API directly without going through the `qevo` object.
 *
 * @example
 * ```typescript
 * import { tabs } from './qevo';
 *
 * const allTabs = await tabs.query({});
 * const activeTab = await tabs.getActive();
 * ```
 *
 * @see {@link Qevo.tabs}
 */
export declare const tabs: QevoTabs;
/**
 * Direct access to the WebRequest API
 *
 * Allows importing the webRequest API directly without going through the `qevo` object.
 * **Note:** Only works in background scripts.
 *
 * @example
 * ```typescript
 * import { webRequest } from './qevo';
 *
 * webRequest.on('BeforeRequest', (details) => {
 *   console.log('Request:', details.url);
 * }, { urls: ['<all_urls>'] });
 * ```
 *
 * @see {@link Qevo.webRequest}
 */
export declare const webRequest: QevoWebRequest;
/**
 * Direct access to the Messages API
 *
 * Allows importing the messages API directly without going through the `qevo` object.
 *
 * @example
 * ```typescript
 * import { messages } from './qevo';
 *
 * // Listen for messages
 * messages.on('getData', (data, sender, sendResponse) => {
 *   sendResponse({ result: 'success' });
 * });
 *
 * // Send messages
 * const response = await messages.sendToBackground('getData', { id: 123 });
 * ```
 *
 * @see {@link Qevo.messages}
 */
export declare const messages: QevoMessages;
/**
 * Direct access to the Alarms API
 *
 * @example
 * ```typescript
 * import { alarms } from './qevo';
 *
 * await alarms.create('reminder', { delayInMinutes: 5 });
 * alarms.onAlarm((alarm) => console.log('Alarm fired:', alarm.name));
 * ```
 *
 * @see {@link Qevo.alarms}
 */
export declare const alarms: QevoAlarms;
/**
 * Direct access to the Notifications API
 *
 * @example
 * ```typescript
 * import { notifications } from './qevo';
 *
 * await notifications.create({
 *   type: 'basic',
 *   title: 'Hello',
 *   message: 'World',
 *   iconUrl: 'icon.png'
 * });
 * ```
 *
 * @see {@link Qevo.notifications}
 */
export declare const notifications: QevoNotifications;
/**
 * Direct access to the Context Menus API
 *
 * @example
 * ```typescript
 * import { contextMenus } from './qevo';
 *
 * await contextMenus.create({ id: 'search', title: 'Search', contexts: ['selection'] });
 * contextMenus.onClicked((info) => console.log('Clicked:', info.menuItemId));
 * ```
 *
 * @see {@link Qevo.contextMenus}
 */
export declare const contextMenus: QevoContextMenus;
/**
 * Direct access to the Scripting API (MV3)
 *
 * @example
 * ```typescript
 * import { scripting } from './qevo';
 *
 * await scripting.executeScript({
 *   target: { tabId: tab.id },
 *   func: () => document.title
 * });
 * ```
 *
 * @see {@link Qevo.scripting}
 */
export declare const scripting: QevoScripting;
/**
 * Direct access to the Action API (toolbar icon)
 *
 * @example
 * ```typescript
 * import { action } from './qevo';
 *
 * await action.setBadgeText({ text: '5' });
 * await action.setBadgeBackgroundColor({ color: '#FF0000' });
 * ```
 *
 * @see {@link Qevo.action}
 */
export declare const action: QevoAction;
/**
 * Direct access to the Windows API
 *
 * @example
 * ```typescript
 * import { windows } from './qevo';
 *
 * const win = await windows.create({ url: 'popup.html', type: 'popup' });
 * await windows.update(win.id, { focused: true });
 * ```
 *
 * @see {@link Qevo.windows}
 */
export declare const windows: QevoWindows;
/**
 * Direct access to the Permissions API
 *
 * @example
 * ```typescript
 * import { permissions } from './qevo';
 *
 * const granted = await permissions.request({ permissions: ['history'] });
 * const has = await permissions.contains({ permissions: ['history'] });
 * ```
 *
 * @see {@link Qevo.permissions}
 */
export declare const permissions: QevoPermissions;
/**
 * Direct access to the Downloads API
 *
 * @example
 * ```typescript
 * import { downloads } from './qevo';
 *
 * const id = await downloads.download({ url: 'https://example.com/file.pdf' });
 * downloads.onChanged((delta) => console.log('Download updated:', delta));
 * ```
 *
 * @see {@link Qevo.downloads}
 */
export declare const downloads: QevoDownloads;
/**
 * Direct access to the History API
 *
 * @example
 * ```typescript
 * import { history } from './qevo';
 *
 * const items = await history.search({ text: 'github', maxResults: 10 });
 * await history.deleteUrl({ url: 'https://example.com' });
 * ```
 *
 * @see {@link Qevo.history}
 */
declare const history$1: QevoHistory;
/**
 * Direct access to the Bookmarks API
 *
 * @example
 * ```typescript
 * import { bookmarks } from './qevo';
 *
 * const tree = await bookmarks.getTree();
 * const bookmark = await bookmarks.create({ title: 'My Site', url: 'https://example.com' });
 * ```
 *
 * @see {@link Qevo.bookmarks}
 */
export declare const bookmarks: QevoBookmarks;
/**
 * Direct access to the Identity API
 *
 * @example
 * ```typescript
 * import { identity } from './qevo';
 *
 * const token = await identity.getAuthToken({ interactive: true });
 * const redirectUrl = await identity.launchWebAuthFlow({ url: authUrl, interactive: true });
 * ```
 *
 * @see {@link Qevo.identity}
 */
export declare const identity: QevoIdentity;
/**
 * Direct access to the Commands API
 *
 * @example
 * ```typescript
 * import { commands } from './qevo';
 *
 * const allCommands = await commands.getAll();
 * commands.onCommand((command) => console.log('Command:', command));
 * ```
 *
 * @see {@link Qevo.commands}
 */
export declare const commands: QevoCommands;
/**
 * Direct access to the I18n API
 *
 * @example
 * ```typescript
 * import { i18n } from './qevo';
 *
 * const greeting = i18n.getMessage('greeting');
 * const lang = i18n.getUILanguage();
 * ```
 *
 * @see {@link Qevo.i18n}
 */
export declare const i18n: QevoI18n;
/**
 * Direct access to the Idle API
 *
 * @example
 * ```typescript
 * import { idle } from './qevo';
 *
 * const state = await idle.queryState(60);
 * idle.onStateChanged((state) => console.log('Idle state:', state));
 * ```
 *
 * @see {@link Qevo.idle}
 */
export declare const idle: QevoIdle;
/**
 * Direct access to the Runtime API
 *
 * @example
 * ```typescript
 * import { runtime } from './qevo';
 *
 * const manifest = runtime.getManifest();
 * runtime.onInstalled((details) => console.log('Installed:', details.reason));
 * ```
 *
 * @see {@link Qevo.runtime}
 */
export declare const runtime: QevoRuntime;

export {
	CookieStore$1 as CookieStore,
	history$1 as history,
	qevo as default,
};

export {};
