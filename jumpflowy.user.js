// ==UserScript==
// @name         JumpFlowy
// @namespace    https://github.com/mbhutton/jumpflowy
// @version      0.1.8.18
// @description  WorkFlowy user script for search and navigation
// @author       Matt Hutton
// @match        https://workflowy.com/*
// @match        https://beta.workflowy.com/*
// @match        https://dev.workflowy.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/mbhutton/jumpflowy/raw/master/jumpflowy.user.js
// ==/UserScript==

// ESLint globals from WorkFlowy:
/*
global WF:false
*/

// Enable TypeScript checking
// @ts-check
/// <reference path="index.d.ts" />
/// <reference path="types/workflowy-api.d.ts" />

(function() {
  "use strict";

  /**
   * Applies the given function to the given item
   * and each of its descendants, as a depth first search.
   * @param {function} functionToApply The function to apply to each item.
   * @param {Item} searchRoot The root item of the search.
   * @returns {void}
   */
  function applyToEachItem(functionToApply, searchRoot) {
    // Apply the function
    functionToApply(searchRoot);
    // Recurse
    for (let child of searchRoot.getChildren()) {
      applyToEachItem(functionToApply, child);
    }
  }

  /**
   * @param {function} itemPredicate A function (Item -> boolean) which
   *                                 returns whether or not an item is a match.
   * @param {Item} searchRoot The root item of the search.
   * @returns {Array<Item>} The matching items, in order of appearance.
   */
  function findMatchingItems(itemPredicate, searchRoot) {
    const matches = Array();

    function addIfMatch(item) {
      if (itemPredicate(item)) {
        matches.push(item);
      }
    }
    applyToEachItem(addIfMatch, searchRoot);
    return matches;
  }

  /**
   * @template K
   * @template V
   * @param {function} itemFunction A function of type (Item -> Array<K>).
   *                                Can return null or empty array.
   * @param {Item} searchRoot The root item of the search.
   * @returns {Map<K, Array<Item>>} A map of keys to arrays of items.
   */
  function toItemMultimapWithMultipleKeys(itemFunction, searchRoot) {
    /** @type Map<K, Array<Item>> */
    const itemMultimap = new Map();
    /**
     * @param {Item} item The item
     * @returns {void}
     */
    function visitorFunction(item) {
      const keysForItem = itemFunction(item);
      if (keysForItem && keysForItem.length) {
        for (let key of keysForItem) {
          addToMultimap(key, item, itemMultimap);
        }
      }
    }
    applyToEachItem(visitorFunction, searchRoot);
    return itemMultimap;
  }

  /**
   * @template K
   * @template V
   * @param {function} itemFunction A function of type (Item -> K).
   *                                Can return null.
   * @param {Item} searchRoot The root item of the search.
   * @returns {Map<K, Array<Item>>} A map of keys to arrays of items.
   */
  function toItemMultimapWithSingleKeys(itemFunction, searchRoot) {
    /**
     * @param {Item} item The item
     * @returns {Array<K> | null} The returned result (if any) as an array.
     */
    function wrappedFunction(item) {
      const key = itemFunction(item);
      return (key && [key]) || null;
    }
    return toItemMultimapWithMultipleKeys(wrappedFunction, searchRoot);
  }

  /**
   * @template K
   * @template V
   * @param {K} key The key.
   * @param {V} value Value to append to the array associated with the key.
   * @param {Map<K, Array<V>>} multimap A map of keys to arrays of values.
   * @returns {void}
   */
  function addToMultimap(key, value, multimap) {
    if (multimap.has(key)) {
      multimap.get(key).push(value);
    } else {
      multimap.set(key, [value]);
    }
  }

  /**
   * @template K
   * @template V
   * @param {function} keyFilter The filter to apply to keys in the map.
   * @param {Map<K, V>} map The map to filter.
   * @returns {Map<K, V>} map The filtered map.
   */
  function filterMapByKeys(keyFilter, map) {
    /** @type {Map<K, V>} */
    const filteredMap = new Map();
    map.forEach((v, k) => {
      if (keyFilter(k)) {
        filteredMap.set(k, v);
      }
    });
    return filteredMap;
  }

  /**
   * @template K
   * @template V
   * @param {function} valueFilter The filter to apply to values in the map.
   * @param {Map<K, V>} map The map to filter.
   * @returns {Map<K, V>} map The filtered map.
   */
  function filterMapByValues(valueFilter, map) {
    /** @type {Map<K, V>} */
    const filteredMap = new Map();
    map.forEach((v, k) => {
      if (valueFilter(v)) {
        filteredMap.set(k, v);
      }
    });
    return filteredMap;
  }

  /**
   * @param {Item} searchRoot The root item of the search.
   * @returns {Map<string, Array<Item>>} Items with the same text, keyed by that
   *                                     text.
   */
  function findItemsWithSameText(searchRoot) {
    const allItemsByText = toItemMultimapWithSingleKeys(itemToCombinedPlainText, searchRoot);
    return filterMapByValues(items => items.length > 1, allItemsByText);
  }

  /**
   * Returns the tags found in the given item.
   * Returns the empty set if none are found.
   *
   * Note: Tags containing punctuation may produce unexpected results.
   * Suggested best practice: freely use '-' and '_' and ':'
   * as part of tags, being careful to avoid ':' as a suffix.
   *
   * @param {Item} item The item to query.
   * @returns {Array<string>} An array of tags found in the item.
   */
  function itemToTags(item) {
    const tagsForName = WF.getItemNameTags(item);
    const tagsForNote = WF.getItemNoteTags(item);
    const allTags = tagsForName.concat(tagsForNote);
    return allTags.map(x => x.tag);
  }

  /**
   * @param {function} itemPredicate A function (Item -> boolean) which
   *                                 returns whether or not to include an item.
   * @param {Item} searchRoot The root item of the search.
   * @returns {Set<string>} All tags under the given search root.
   */
  function getTagsForFilteredItems(itemPredicate, searchRoot) {
    const allTags = new Set();
    /**
     * @param {Item} item The item.
     * @returns {void}
     */
    function appendTags(item) {
      if (!itemPredicate || itemPredicate(item)) {
        itemToTags(item).forEach(tag => allTags.add(tag));
      }
    }
    applyToEachItem(appendTags, searchRoot);
    return allTags;
  }

  /**
   * @param {string} tagToMatch The tag to match.
   * @param {Item} item The item to test.
   * @returns {boolean} True if and only if the given item has the
   *                    exact given tag, ignoring case. Otherwise false.
   * @see {@link itemToTags} For notes, caveats regarding tag handling.
   */
  function doesItemHaveTag(tagToMatch, item) {
    if (!item || !tagToMatch) {
      return false;
    }

    // Optimisation: check for first character of tag in the raw rich text
    // before converting to plain text, for both the name and the note.
    const firstTagChar = tagToMatch[0];
    return (
      (item.getName().includes(firstTagChar) && doesStringHaveTag(tagToMatch, item.getNameInPlainText())) ||
      (item.getNote().includes(firstTagChar) && doesStringHaveTag(tagToMatch, item.getNoteInPlainText()))
    );
  }

  /**
   * @param {Item} item The item
   * @returns {string} The plain text version of the item's name,
   *                   or the empty string if it is the root item.
   */
  function itemToPlainTextName(item) {
    return item.getNameInPlainText() || "";
  }

  /**
   * @param {Item} item The item
   * @returns {string} The plain text version of the item's note,
   *                   or the empty string if it is the root item.
   */
  function itemToPlainTextNote(item) {
    return item.getNoteInPlainText() || "";
  }

  /**
   * WARNING: The fastest way to get plain text name/note from an Item is
   * to use the built-in methods for doing so. Only use this method when
   * needing to convert to plain text after doing some processing of rich text.
   *
   * This function converts the given rich text to plain text, removing any tags
   * (preserving their inner text), and un-escaping the required characters.
   *
   * Note that richTextToPlainText(Item.getName()) should always return the same
   * result as Item.getNameInPlainText(), and a failure to do so would be a bug,
   * and the same applies for getNote() and getNoteInPlainText().
   *
   * @param {string} richText The rich text to convert, e.g. from Item.getName()
   * @returns {string} The plain text equivalent
   */
  function richTextToPlainText(richText) {
    return richText
      .replace(/<[^>]*>/g, "")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }

  /**
   * @param {Item} item The item.
   * @returns {string} The item's name and note, concatenated. When the note is
   *                   present, it is preceded by a newline character.
   */
  function itemToCombinedPlainText(item) {
    const name = itemToPlainTextName(item);
    const note = itemToPlainTextNote(item);
    const combinedText = note.length === 0 ? name : `${name}\n${note}`;
    return combinedText;
  }

  /**
   * Marks the focused item and all its descendants as not complete.
   * @returns {void}
   */
  function markFocusedAndDescendantsNotComplete() {
    const focusedItem = WF.focusedItem();
    if (focusedItem === null) {
      return;
    }
    WF.editGroup(() => {
      applyToEachItem(item => {
        if (item.isCompleted()) {
          WF.completeItem(item);
        }
      }, focusedItem);
    });
  }

  /**
   * @param {function} textPredicate The predicate to apply to each string.
   *                                 The predicate should handle null values,
   *                                 as the root item has a null name and note.
   * @param {Item} item The item to test.
   * @returns {boolean} Whether textPredicate returns true for either the item's
   *                    name or note.
   */
  function doesItemNameOrNoteMatch(textPredicate, item) {
    return textPredicate(itemToPlainTextName(item)) || textPredicate(itemToPlainTextNote(item));
  }

  /**
   * @returns {number} The current clock time in seconds since Unix epoch.
   */
  function getCurrentTimeSec() {
    return dateToSecondsSinceEpoch(new Date());
  }

  /**
   * @param {Date} date The given date.
   * @returns {number} Seconds from epoch to the given date, rounding down.
   */
  function dateToSecondsSinceEpoch(date) {
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * @param {Item} item The item to query.
   * @returns {number} When the item was last modified, in seconds since
   *                   unix epoch. For the root item, returns zero.
   */
  function itemToLastModifiedSec(item) {
    return isRootItem(item) ? 0 : dateToSecondsSinceEpoch(item.getLastModifiedDate());
  }

  // Clean up any previous instance of JumpFlowy
  if (
    typeof window.jumpflowy !== "undefined" &&
    typeof window.jumpflowy !== "undefined" &&
    typeof window.jumpflowy.cleanUp !== "undefined"
  ) {
    window.jumpflowy.cleanUp();
  }

  // Global state
  /** @type {Map<string, Target>} */
  const canonicalKeyCodesToTargets = new Map();
  /** @type {Map<string, function | string>} */
  const builtInExpansionsMap = new Map();
  /** @type {Map<string, function | string>} */
  let customExpansions = new Map();
  /** @type {Map<string, function | string>} */
  let abbrevsFromTags = new Map();
  /** @type {Map<string, Target>} */
  let kbShortcutsFromTags = new Map();
  /** @type {Map<string, FunctionTarget>} */
  const builtInFunctionTargetsByName = new Map();
  /** @type {Map<string, ItemTarget>} */
  let bookmarksToItemTargets = new Map();
  /** @type {Map<string, Item>} */
  let bookmarksToSourceItems = new Map();
  /** @type {Map<string, string>} */
  let itemIdsToFirstBookmarks = new Map();
  /** @type {Map<string, string>} */
  const hashSegmentsToIds = new Map();
  /** @type {Set<string>} */
  const unknownHashSegments = new Set();
  /** @type {Map<string, string>} */
  let bannedBookmarkSearchPrefixesToSuggestions = new Map();

  // DEPRECATED TAGS START
  const bookmarkTag = "#bm";
  const abbrevTag = "#abbrev";
  const shortcutTag = "#shortcut";
  // DEPRECATED TAGS END
  const SCATTER_TAG = "#scatter";
  const SCHEDULE_TAG = "#scheduleFor";

  const searchQueryToMatchNoItems = "META:NO_MATCHING_ITEMS_" + new Date().getTime();
  let lastRegexString = null;
  let isCleanedUp = false;

  /** @type {Item} */
  let configurationRootItem = null;
  const CONFIGURATION_ROOT_NAME = "jumpflowyConfiguration";
  const CONFIG_SECTION_EXPANSIONS = "textExpansions";
  const CONFIG_SECTION_BOOKMARKS = "bookmarks";
  const CONFIG_SECTION_KB_SHORTCUTS = "keyboardShortcuts";
  const CONFIG_SECTION_BANNED_BOOKMARK_SEARCH_PREFIXES = "bannedBookmarkSearchPrefixes";

  // Global event listener data
  const gelData = [0, 0, 0, 0];
  const GEL_CALLBACKS_FIRED = 0;
  const GEL_CALLBACKS_RECEIVED = 1;
  const GEL_CALLBACKS_TOTAL_MS = 2;
  const GEL_CALLBACKS_MAX_MS = 3;
  const IS_DEBUG_GEL_TIMING = false;

  const isBetaDomain = location.origin === "https://beta.workflowy.com";
  const isDevDomain = location.origin === "https://dev.workflowy.com";
  const originalWindowOpenFn = window.open;

  class AbortActionError extends Error {
    constructor(message) {
      super(message);
      this.name = "AbortActionError";
    }
  }

  /**
   * Calls the given no-args function, catching any AbortActionError
   * and showing its message.
   * @param {function} f The function to call.
   * @returns {void}
   */
  function callWithErrorHandling(f) {
    try {
      f();
    } catch (err) {
      if (err instanceof AbortActionError) {
        WF.showMessage(`Action failed: ${err.message}`, true);
      } else {
        throw err;
      }
    }
  }

  /**
   * @param {boolean} condition Whether to throw the AbortActionError.
   * @param {string | function} message The message to include in the error.
   *                                    If a function, must return a string.
   * @throws {AbortActionError} If the condition is true.
   * @returns {void}
   */
  function failIf(condition, message) {
    if (condition) {
      throw new AbortActionError(message);
    }
  }

  /**
   * @param {Item} item The item to check.
   * @returns {void}
   * @throws {AbortActionError} If the item is embedded.
   */
  function validateItemIsLocalOrFail(item) {
    failIf(
      item && item.isEmbedded(),
      () => `${formatItem(item)} is embedded from another document. Was expecting local items only.`
    );
  }

  function openHere(url) {
    open(url, "_self");
  }

  /**
   * Note: pop-ups must be allowed from https://workflowy.com for this to work.
   * @param {string} url The URL to open.
   * @returns {void}
   */
  function openInNewTab(url) {
    open(url, "_blank");
  }

  /**
   * An alternative to window.open which rewrites the URL as
   * necessary to avoid crossing between the various workflowy.com subdomains.
   * Intended primarily for use on the dev/beta domains but also usable in prod.
   * @param {string} url The URL to open.
   * @param {string} targetWindow (See documentation for window.open)
   * @param {string} features (See documentation for window.open)
   * @param {boolean} replace (See documentation for window.open)
   * @returns {Window} (See documentation for window.open)
   */
  function _openWithoutChangingWfDomain(url, targetWindow, features, replace) {
    if (isWorkFlowyUrl(url)) {
      url = location.origin + url.substring(new URL(url).origin.length);
    }
    targetWindow = targetWindow || (isWorkFlowyUrl(url) ? "_self" : "_blank");
    return originalWindowOpenFn(url, targetWindow, features, replace);
  }

  function zoomToAndSearch(item, searchQuery) {
    if (searchQuery) {
      // This is much faster than zooming and searching in two steps.
      openHere(itemAndSearchToWorkFlowyUrl("current", item, searchQuery));
    } else {
      WF.zoomTo(item);
    }
  }

  /**
   * Prompt for a search query, then perform a normal WorkFlowy search.
   * @returns {void}
   */
  function promptToNormalLocalSearch() {
    const previousQuery = WF.currentSearchQuery();
    const newQuery = prompt("WorkFlowy search: ", previousQuery || "");
    if (newQuery !== null) {
      WF.search(newQuery);
    }
  }

  /**
   * Prompts for X, then performs a local WorkFlowy search for last-changed:X
   * @returns {void}
   */
  function promptToFindByLastChanged() {
    const timePeriod = prompt("last-changed=");
    if (timePeriod) {
      WF.search(`last-changed:${timePeriod.trim()}`);
    }
  }

  /**
   * @returns {void} Dismisses a notification from the WorkFlowy UI, e.g. after
   *                 deleting a large tree of items.
   */
  function dismissNotification() {
    WF.hideMessage();
  }

  function createItemAtTopOfCurrent() {
    let item = null;
    // Workaround: Use edit group to avoid WF.createItem() returning undefined
    WF.editGroup(() => {
      item = WF.createItem(WF.currentItem(), 0);
    });
    if (item) {
      WF.editItemName(item);
    }
  }

  /**
   * @param {string} tagToMatch The tag to match.
   * @param {string} s The string to test.
   * @returns {boolean} True if and only if the given string has the
   *                    exact given tag, ignoring case. Otherwise false.
   * @see {@link itemToTags} For notes, caveats regarding tag handling.
   */
  function doesStringHaveTag(tagToMatch, s) {
    if (s === null || tagToMatch === null) {
      return false;
    }

    // Ignore case
    tagToMatch = tagToMatch.toLowerCase();
    s = s.toLowerCase();

    let nextStart = 0;
    let matched = false;
    for (;;) {
      const tagIndex = s.indexOf(tagToMatch, nextStart);
      if (tagIndex === -1) {
        break; // Non-match: tag not found
      }
      if (tagToMatch.match(/^[@#]/) === null) {
        break; // Non-match: invalid tagToMatch
      }
      const afterTag = tagIndex + tagToMatch.length;
      nextStart = afterTag;
      if (s.substring(afterTag).match(/^[:]?[a-z0-9-_]/)) {
        continue; // This is a longer tag than tagToMatch, so keep looking
      } else {
        matched = true;
        break;
      }
    }
    return matched;
  }

  /**
   * An 'argument passing' mechanism, where '#foo(bar, baz)'
   * is considered as 'passing' the string "bar, baz" to #foo.
   * It's very rudimentary/naive: e.g. "#foo('bar)', baz')"
   * would lead to an args string of "'bar".
   *
   * @param {string} tagToMatch The tag to match.
   *                            E.g. "#foo".
   * @param {string} s The string to extract the args text from.
   *                   E.g. "#foo(bar, baz)".
   * @returns {string} The trimmed arguments string, or null if no call found.
   *                   E.g. "bar, baz".
   */
  function stringToTagArgsText(tagToMatch, s) {
    if (s === null || s === "") {
      return null;
    }
    let start = 0;
    for (;;) {
      const tagIndex = s.indexOf(tagToMatch, start);
      if (tagIndex === -1) {
        return null;
      }
      const afterTag = tagIndex + tagToMatch.length;
      const callOpenIndex = s.indexOf("(", afterTag);
      if (callOpenIndex === -1) {
        return null;
      }
      const callCloseIndex = s.indexOf(")", callOpenIndex + 1);
      if (callCloseIndex === -1) {
        return null;
      }
      const fullCall = s.substring(afterTag, callCloseIndex + 1);
      if (_stringToTagArgsText_CallRegExp.test(fullCall)) {
        return s.substring(callOpenIndex + 1, callCloseIndex).trim();
      }
      start = afterTag;
    }
  }

  const _stringToTagArgsText_CallRegExp = RegExp("^ *\\([^\\(\\)]*\\) *$");

  /**
   * Finds and returns the items whose "combined plain text" matches the
   * given regular expression. Here, the "combined plain text" is the item's
   * name as plain text, plus the item's note as plain text, with a
   * newline separating the two only when the note is non-empty.
   *
   * @param {RegExp} regExp The compiled regular expression to match.
   * @param {Item} searchRoot The root item of the search.
   * @returns {Array<Item>} The matching items, in order of appearance.
   */
  function findItemsMatchingRegex(regExp, searchRoot) {
    if (typeof regExp !== "object" || regExp.constructor.name !== "RegExp") {
      throw "regExp must be a compiled RegExp object. regExp: " + regExp;
    }
    function itemPredicate(item) {
      const combinedText = itemToCombinedPlainText(item);
      return regExp.test(combinedText);
    }
    return findMatchingItems(itemPredicate, searchRoot);
  }

  /**
   * Prompts the user for a regular expression string (case insensitive, and
   * defaulting to the last chosen regex), the searches for items under the
   * currently zoomed item which match it, then prompts the user to choose which
   * of the matching items to go to.
   * @see findItemsMatchingRegex For how the regex is matched against the item.
   * @returns {void}
   */
  function promptToFindLocalRegexMatchThenZoom() {
    const defaultSearch = lastRegexString || ".*";
    const promptString = "Search for regular expression (case insensitive):";
    const regExpString = prompt(promptString, defaultSearch);
    if (!regExpString) {
      return;
    }
    lastRegexString = regExpString;
    let regExp;
    try {
      regExp = RegExp(regExpString, "i");
    } catch (er) {
      alert(er);
      return;
    }
    const startTime = new Date();
    const matchingItems = findItemsMatchingRegex(regExp, getZoomedItem());
    const message = `Found ${matchingItems.length} matches for ${regExp}`;
    logElapsedTime(startTime, message);

    if (matchingItems.length === 0) {
      alert(`No items under current location match '${regExpString}'.`);
    } else {
      const chosenItem = promptToChooseItem(matchingItems, null);
      if (chosenItem) {
        zoomToAndSearch(chosenItem, null);
      }
    }
  }

  /**
   * @param {string} tagToMatch The tag to match.
   * @param {Item} item The item to extract the args text from.
   * @returns {string} The trimmed arguments string, or null if no call found.
   * @see {@link stringToTagArgsText} For semantics.
   */
  function itemToTagArgsText(tagToMatch, item) {
    const resultForName = stringToTagArgsText(tagToMatch, itemToPlainTextName(item));
    if (resultForName !== null) {
      return resultForName;
    }
    return stringToTagArgsText(tagToMatch, itemToPlainTextNote(item));
  }

  /**
   * @param {Item} item The item to query
   * @returns {boolean} Whether the given item is the root item
   */
  function isRootItem(item) {
    return item.getId() === "None";
  }

  /**
   * @returns {string} The long (non-truncated) ID of the
   *                   item which is currently zoomed into.
   */
  function getZoomedItemAsLongId() {
    return WF.currentItem().getId();
  }

  /**
   * @returns {Item} The item which is currently zoomed into.
   */
  function getZoomedItem() {
    const zoomedItemId = getZoomedItemAsLongId();
    return WF.getItemById(zoomedItemId);
  }

  /**
   * @param {Item} item The item whose path to get
   * @returns {Array<Item>} An array starting with the root and ending
   *                              with the item.
   */
  function itemToPathAsItems(item) {
    return item
      .getAncestors() // parent ... root
      .slice()
      .reverse() // root ... parent
      .concat(item); // root ... parent, item
  }

  /**
   * @param {Item} itemToMove The item to be moved.
   * @param {Item} targetItem The target item being moved to.
   * @returns {boolean} Whether it's safe to move the item to the target.
   */
  function isSafeToMoveItemToTarget(itemToMove, targetItem) {
    // Both must be specified
    if (!itemToMove || !targetItem) {
      return false;
    }
    // Can't be the same item
    if (itemToMove.getId() === targetItem.getId()) {
      return false;
    }
    // Neither can be read-only
    if (itemToMove.isReadOnly() || targetItem.isReadOnly()) {
      return false;
    }
    // Can't move an ancestor to a descendant
    if (isAAncestorOfB(itemToMove, targetItem)) {
      return false;
    }

    return true;
  }

  /**
   * @param {Item} a Item A.
   * @param {Item} b Item B.
   * @returns {boolean} Whether item A is an ancestor of item B.
   */
  function isAAncestorOfB(a, b) {
    if (!a || !b) {
      return false;
    }
    let ancestorOfB = b.getParent();
    while (ancestorOfB) {
      if (a.getId() === ancestorOfB.getId()) {
        return true;
      }
      ancestorOfB = ancestorOfB.getParent();
    }
    return false;
  }

  /**
   * @param {Item} itemA Some item
   * @param {Item} itemB Another item
   * @returns {Item} The closest common ancestor of both items, inclusive.
   */
  function findClosestCommonAncestor(itemA, itemB) {
    const pathA = itemToPathAsItems(itemA);
    const pathB = itemToPathAsItems(itemB);
    const minLength = Math.min(pathA.length, pathB.length);

    let i;
    for (i = 0; i < minLength; i++) {
      if (pathA[i].getId() !== pathB[i].getId()) {
        break;
      }
    }
    if (i === 0) {
      throw "Items shared no common root";
    }
    return pathA[i - 1];
  }

  /**
   * @param {'prod' | 'beta' | 'dev' | 'current'} domainType Domain to use.
   * @returns {string} The base WorkFlowy URL for the given domain type.
   */
  function getWorkFlowyBaseUrlForDomainType(domainType) {
    switch (domainType) {
      case "current":
        return location.origin;
      case "prod":
        return "https://workflowy.com";
      case "beta":
        return "https://beta.workflowy.com";
      case "dev":
        return "https://dev.workflowy.com";
      default:
        throw "Unrecognized domain type: " + domainType;
    }
  }

  /**
   * @param {'prod' | 'beta' | 'dev' | 'current'} domainType Domain to use.
   * @param {Item} item The item to create a WorkFlowy URL for.
   * @param {string} searchQuery (Optional) search query string.
   * @returns {string} The WorkFlowy URL pointing to the item.
   */
  function itemAndSearchToWorkFlowyUrl(domainType, item, searchQuery) {
    const baseUrl = getWorkFlowyBaseUrlForDomainType(domainType);
    const searchSuffix = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : "";
    return `${baseUrl}/${itemToHashSegment(item)}${searchSuffix}`;
  }

  /**
   * @returns {boolean} True if and only if the given string is a WorkFlowy URL.
   * @param {string} s The string to test.
   */
  function isWorkFlowyUrl(s) {
    return s && s.match("^https://(dev\\.|beta\\.)?workflowy\\.com(/.*)?$") !== null;
  }

  /**
   * @param {string} fullUrl The full WorkFlowy URL.
   * @returns {[string, string]} The hash segment, of the form returned by
   *                             itemToHashSegment(), and search query or null.
   */
  function workFlowyUrlToHashSegmentAndSearchQuery(fullUrl) {
    const urlObject = new URL(fullUrl);
    let [hash, rawSearchQuery] = urlObject.hash.split("?q=");
    if (hash.length <= 2) {
      // '#/' or '#' or ''
      hash = "#";
    }
    let searchQuery = null;
    if (rawSearchQuery) {
      searchQuery = decodeURIComponent(rawSearchQuery);
    }
    return [hash, searchQuery];
  }

  /**
   * @param {Item} item The item.
   * @returns {string} '#' for the root item, or e.g. '#/80cbd123abe1'.
   */
  function itemToHashSegment(item) {
    let hash = item.getUrl();
    hash = hash.startsWith("/") ? hash.substring(1) : hash;
    return hash === "" ? "#" : hash;
  }

  /**
   * Walks the entire tree, (re-)populating the hashSegmentsToIds map.
   * @returns {void}
   */
  function populateHashSegmentsForFullTree() {
    function populateHash(item) {
      const hashSegment = itemToHashSegment(item);
      if (!hashSegmentsToIds.has(hashSegment)) {
        hashSegmentsToIds.set(hashSegment, item.getId());
      }
    }
    applyToEachItem(populateHash, WF.rootItem());
  }

  /**
   * @param {string} hashSegment The hash segment part of a WorkFlowy URL.
   * @returns {string | null} The ID of the item if found, otherwise null.
   */
  function findItemIdForHashSegment(hashSegment) {
    const existingEntry = hashSegmentsToIds.get(hashSegment);
    if (existingEntry) {
      return existingEntry;
    }
    if (unknownHashSegments.has(hashSegment)) {
      return null;
    }
    // First request for this hash segment. Re-index the entire tree.
    populateHashSegmentsForFullTree();
    // Re-check the map, blacklisting the hash segment if not found
    if (hashSegmentsToIds.has(hashSegment)) {
      return hashSegmentsToIds.get(hashSegment);
    } else {
      unknownHashSegments.add(hashSegment);
      return null;
    }
  }

  /**
   * @param {string} fullUrl The WorkFlowy URL.
   * @returns {[string, string]} ID of the item in the URL, and search query.
   */
  function findItemIdAndSearchQueryForWorkFlowyUrl(fullUrl) {
    const [hashSegment, searchQuery] = workFlowyUrlToHashSegmentAndSearchQuery(fullUrl);
    const itemId = findItemIdForHashSegment(hashSegment);
    return [itemId, searchQuery];
  }

  /**
   * @param {string} fullUrl The WorkFlowy URL.
   * @returns {[Item, string]} The ID of the item in the URL, and search query.
   */
  function findItemAndSearchQueryForWorkFlowyUrl(fullUrl) {
    const [id, query] = findItemIdAndSearchQueryForWorkFlowyUrl(fullUrl);
    let item = null;
    if (id) {
      item = WF.getItemById(id);
    }
    return [item, query];
  }

  const validRootUrls = [];
  for (let subdomainPrefix of ["", "beta.", "dev."]) {
    for (let suffix of ["", "/", "/#", "/#/"]) {
      validRootUrls.push(`https://${subdomainPrefix}workflowy.com${suffix}`);
    }
  }

  /**
   * @param {Array<Item>} items The items to build the search query for.
   * @returns {string} The search query to use for finding the
   *                   items, or an unmatchable query if items is empty.
   */
  function itemsToVolatileSearchQuery(items) {
    if (items.length === 0) {
      // Return a search query which matches no items
      return searchQueryToMatchNoItems;
    }
    const searches = items.map(n => itemToVolatileSearchQuery(n));
    return searches.join(" OR ");
  }

  /**
   * @param {Item} item The item to build the search query for.
   * @returns {string} The search query to use for finding the item, or
   *                   an unmatchable query for the root item.
   */
  function itemToVolatileSearchQuery(item) {
    if (isRootItem(item)) {
      // Return a search query which matches no items
      return searchQueryToMatchNoItems;
    }
    const currentTimeSec = getCurrentTimeSec();
    const itemLastModifiedSec = itemToLastModifiedSec(item);
    const modifiedHowLongAgoSec = currentTimeSec - itemLastModifiedSec;
    const modifiedHowLongAgoMinutes = Math.ceil(modifiedHowLongAgoSec / 60);
    const timeClause = `last-changed:${modifiedHowLongAgoMinutes + 1} -last-changed:${modifiedHowLongAgoMinutes - 1} `;
    const nameClause = splitStringToSearchTerms(itemToPlainTextName(item));
    return timeClause + nameClause;
  }

  function splitStringToSearchTerms(s) {
    const lines = s.match(/[^\r\n]+/g);
    if (lines === null || lines.length === 0) {
      return "";
    }
    let result = "";
    for (let line of lines) {
      for (let segment of line.split('"')) {
        if (segment.trim() !== "") {
          // Use 2 spaces here, to work around a WorkFlowy bug
          // where "a"  "b c" works, but "a" "b c" does not.
          result += `  "${segment}"`;
        }
      }
    }
    return result;
  }

  /**
   * @param {string} tag The tag to find, e.g. "#foo".
   * @param {Item} searchRoot The root item of the search.
   * @returns {Array<Item>} The matching items, in order of appearance.
   */
  function findItemsWithTag(tag, searchRoot) {
    return findMatchingItems(n => doesItemHaveTag(tag, n), searchRoot);
  }

  /**
   * @template T
   * @param {function} doesABeatB A function which return whether A beats B.
   * @param {Array<T>} results The current results array, ordered
   *                           [null, null, ..., 2nd best, best].
   * @param {T} candidate The candidate item.
   * @returns {void}
   * Note: optimised for large numbers of calls, with small results sizes.
   */
  function insertIntoSortedResults(doesABeatB, results, candidate) {
    if (candidate === undefined || candidate === null) {
      return;
    }
    let insertAt = -1;
    for (let i = 0; i < results.length; i++) {
      const toReplace = results[i];
      if (toReplace === null || doesABeatB(candidate, toReplace)) {
        insertAt = i;
      } else {
        break;
      }
    }
    if (insertAt > 0) {
      // Shift existing results to the left, from out insertion point
      results.copyWithin(0, 1, insertAt + 1);
    }
    if (insertAt >= 0) {
      results[insertAt] = candidate;
    }
  }

  /**
   * @returns {Array<Item>} The top items under the given
   *    search root (inclusive), with higher scoring items first.
   * @param {function} itemToScoreFn A function from item (Item)
   *    to a score (number), where higher scores are better.
   * @param {number} minScore Items must have this score or higher to
   *    be included in the results.
   * @param {number} maxSize The results array will be at most this size.
   * @param {Item} searchRoot The root item of the search.
   */
  function findTopItemsByScore(itemToScoreFn, minScore, maxSize, searchRoot) {
    const results = Array(maxSize).fill(null);
    function isABetterThanB(itemAndScoreA, itemAndScoreB) {
      return itemAndScoreA[1] > itemAndScoreB[1];
    }
    function forEachItem(item) {
      const score = itemToScoreFn(item);
      const itemAndScore = [item, score];
      if (score >= minScore) {
        insertIntoSortedResults(isABetterThanB, results, itemAndScore);
      }
    }
    applyToEachItem(forEachItem, searchRoot);
    return results
      .filter(x => x !== null)
      .map(x => x[0])
      .reverse();
  }

  /**
   * @template T
   * @returns {Array<T>} The the best N items from the given Array,
   *    as scored by the given function.
   * @param {function} isABetterThanB A function which take items A and B,
   *    returning true if A is 'better', and false if B is 'better'.
   * @param {number} maxSize The results array will be at most this size.
   * @param {Iterable<T>} items The items to search.
   */
  function findTopItemsByComparator(isABetterThanB, maxSize, items) {
    const results = Array(maxSize).fill(null);
    for (let candidate in items) {
      insertIntoSortedResults(isABetterThanB, results, candidate);
    }
    return results.filter(x => x !== null).reverse();
  }

  /**
   * @param {Item} item The item whose children to filter.
   * @returns {Array<Item>} The filtered children.
   */
  function getUncompletedChildren(item) {
    return item.getChildren().filter(i => !i.isCompleted());
  }

  class ConversionFailure {
    /**
     * @param {string} description A description of the failure.
     * @param {Item} item The item at which the failure occurred.
     * @param {Array<ConversionFailure>} causes The underlying causes.
     */
    constructor(description, item, causes) {
      this.description = description;
      this.item = item;
      this.causes = causes;
    }

    toString() {
      let parts = [];
      if (this.description) {
        parts.push(this.description);
      }
      if (this.item) {
        parts.push(`See ${itemAndSearchToWorkFlowyUrl("current", this.item, null)} .`);
      }
      if (this.causes) {
        parts.push(`Caused by: ${this.causes}.`);
      }
      return parts.join(" ") || "Conversion failure";
    }
  }

  class ConversionResult {
    /**
     * @param {any} value The result value.
     * @param {boolean} isUsable Whether or not the result is usable.
     * @param {Array<ConversionFailure>} conversionFailures Array of failures.
     */
    constructor(value, isUsable, conversionFailures) {
      this.value = value;
      this.isUsable = isUsable;
      this.conversionFailures = conversionFailures;
    }

    toString() {
      let parts = [];
      if (this.value) {
        parts.push(this.value.toString());
      }
      if (!this.isUsable) {
        parts.push("(Not usable.)");
      }
      if (this.conversionFailures) {
        parts.push(`Failures: ${this.conversionFailures}.`);
      }
      return parts.join(" ") || "Conversion result";
    }
  }

  /**
   * Returns a ConversionResult with a Map of values based on the given item.
   * Ignores completed items, and trims keys strings.
   * @param {Item} item The WorkFlowy item which contains the values.
   * @param {function} keyToConverter (key) -> (Item) -> ConversionResult.
   * @returns {ConversionResult} Result, with a Map of converted values.
   */
  function convertToMap(item, keyToConverter) {
    /** @type Map<string, any> */
    const rMap = new Map();
    /** @type Array<ConversionFailure> */
    const failures = new Array();
    for (let child of getUncompletedChildren(item)) {
      let key = child.getNameInPlainText().trim();
      if (rMap.has(key)) {
        failures.push(new ConversionFailure(`Ignoring value for ${key}, which is already set above.`, child, null));
      } else {
        let childConverter = keyToConverter(key);
        if (childConverter) {
          /** @type ConversionResult */
          let conversionResult = childConverter(child);
          if (conversionResult.isUsable) {
            rMap.set(key, conversionResult.value);
          }
          if (conversionResult.conversionFailures) {
            failures.push(...conversionResult.conversionFailures);
          }
        } else {
          failures.push(new ConversionFailure(`Unknown key "${key}".`, child, null));
        }
      }
    }
    return new ConversionResult(rMap, true, failures);
  }

  /**
   * Returns a ConversionResult with a Map of strings based on the given item.
   * Ignores completed items, and trims keys strings.
   * @param {Item} item The WorkFlowy item which contains the values.
   * @returns {ConversionResult} Result, with a Map of converted strings.
   */
  function convertToMapOfStrings(item) {
    return convertToMap(item, () => convertToNotePlainText);
  }

  /**
   * Returns a ConversionResult with a Map of items based on the given item.
   * @param {Item} item The WorkFlowy item which contains the values.
   * @returns {ConversionResult} Result, with a Map of converted strings to items.
   */
  function convertToMapOfItems(item) {
    const wrapItemAsResult = i => new ConversionResult(i, true, null);
    return convertToMap(item, () => wrapItemAsResult);
  }

  /**
   * Returns a ConversionResult with an Array of values based on the given item.
   * Ignores completed items.
   * @param {Item} item The WorkFlowy item which contains the values.
   * @param {function} childConverter Converts the child values.
   *                                  (Item) -> ConversionResult.
   * @returns {ConversionResult} Result, with an Array of converted values.
   */
  function convertToArray(item, childConverter) {
    const rArray = new Array();
    /** @type Array<ConversionFailure> */
    const failures = new Array();
    for (let child of getUncompletedChildren(item)) {
      /** @type ConversionResult */
      let conversionResult = childConverter(child);
      if (conversionResult.isUsable) {
        rArray.push(conversionResult.value);
      }
      if (conversionResult.conversionFailures) {
        failures.push(...conversionResult.conversionFailures);
      }
    }
    return new ConversionResult(rArray, true, failures);
  }

  /**
   * Returns a ConversionResult with an Array of strings based on the item.
   * Ignores completed items.
   * @param {Item} item The WorkFlowy item which contains the values.
   * @returns {ConversionResult} Result, with an Array of converted strings.
   */
  // eslint-disable-next-line no-unused-vars
  function convertToArrayOfStrings(item) {
    return convertToArray(item, convertToNameOrNotePlainText);
  }

  /**
   * @param {Item} item The item whose note to use.
   * @returns {ConversionResult} A result, with a string value.
   */
  function convertToNotePlainText(item) {
    return new ConversionResult(item.getNoteInPlainText(), true, null);
  }

  /**
   * @param {Item} item The item whose name or note to use.
   * @returns {ConversionResult} A result, with a string value.
   */
  function convertToNameOrNotePlainText(item) {
    const name = item.getNameInPlainText();
    const note = item.getNoteInPlainText();
    const nameTrimmed = name.trim();
    const noteTrimmed = note.trim();
    let isUsable = true;
    let failures = new Array();
    let value = null;
    if (nameTrimmed && noteTrimmed) {
      failures.push(
        new ConversionFailure("Can't specify both a name and a note. Delete the name or the note.", item, null)
      );
      isUsable = false;
    } else if (nameTrimmed) {
      value = name;
    } else if (noteTrimmed) {
      value = note;
    } else {
      value = name;
    }
    return new ConversionResult(value, isUsable, failures);
  }

  /**
   * @param {Item} item The item to test.
   * @returns {boolean} True if and only if the item is a configuration root.
   */
  function isConfigurationRoot(item) {
    return item.getNameInPlainText().trim() === CONFIGURATION_ROOT_NAME;
  }

  /**
   * @returns {Item | null} item The configuration item if found, or null.
   */
  function findConfigurationRootItem() {
    if (configurationRootItem === null || !isConfigurationRoot(configurationRootItem)) {
      configurationRootItem = null;
      const matchingNodes = findMatchingItems(isConfigurationRoot, WF.rootItem());
      if (matchingNodes.length > 0) {
        configurationRootItem = matchingNodes[0];
      }
      if (matchingNodes.length > 1) {
        WF.showMessage(`Multiple ${CONFIGURATION_ROOT_NAME} items found. Using the first one.`, false);
      }
    }
    return configurationRootItem;
  }

  /**
   * @param {Item} item The configuration item.
   * @returns {ConversionResult} The configuration result.
   */
  function convertJumpFlowyConfiguration(item) {
    function keyToConverter(key) {
      switch (key) {
        case CONFIG_SECTION_BOOKMARKS:
          return convertToMapOfItems;
        case CONFIG_SECTION_EXPANSIONS: // Falls through
        case CONFIG_SECTION_KB_SHORTCUTS:
        case CONFIG_SECTION_BANNED_BOOKMARK_SEARCH_PREFIXES:
          return convertToMapOfStrings;
      }
    }
    return convertToMap(item, keyToConverter);
  }

  /**
   * @param {string} sectionName The name of the configuration section.
   * @returns {Item | null} The section item, or null if not found.
   */
  function findConfigurationSection(sectionName) {
    if (configurationRootItem) {
      for (let child of configurationRootItem.getChildren()) {
        if (child.getNameInPlainText().trim() === sectionName) {
          return child;
        }
      }
    }
    return null;
  }

  /**
   * Global event listener.
   * @param {string} eventName The name of the event.
   * @returns {void}
   */
  function wfEventListener(eventName) {
    if ((eventName && eventName.startsWith("operation--")) || eventName === "locationChanged") {
      gelData[GEL_CALLBACKS_FIRED]++;
      // Do the actual work after letting the UI update
      setTimeout(() => {
        const start = new Date();
        gelData[GEL_CALLBACKS_RECEIVED]++;
        // When multiple events are fired together, only process the last one
        if (gelData[GEL_CALLBACKS_FIRED] === gelData[GEL_CALLBACKS_RECEIVED]) {
          cleanConfiguration();
          reloadConfiguration();
        }
        const end = new Date();
        const elapsedMs = end.getTime() - start.getTime();
        gelData[GEL_CALLBACKS_TOTAL_MS] += elapsedMs;
        gelData[GEL_CALLBACKS_MAX_MS] = Math.max(gelData[GEL_CALLBACKS_MAX_MS], elapsedMs);
        if (IS_DEBUG_GEL_TIMING) console.log(`${gelData}`);
      }, 0);
    }
  }

  /**
   * Wipes state which is set in response to user configuration.
   * @returns {void}
   */
  function cleanConfiguration() {
    customExpansions = new Map();
    bookmarksToItemTargets = new Map();
    bookmarksToSourceItems = new Map();
    itemIdsToFirstBookmarks = new Map();
    canonicalKeyCodesToTargets.clear();
    bannedBookmarkSearchPrefixesToSuggestions = new Map();
  }

  /**
   * Finds and applies user configuration.
   * @returns {boolean} True if the config was found, was usable,
   *                    and was applied. False if not found or not usable.
   */
  function reloadConfiguration() {
    // Find and validate configuration
    const configItem = findConfigurationRootItem();
    if (configItem === null) return false;

    const result = convertJumpFlowyConfiguration(configItem);
    if (result.conversionFailures && result.conversionFailures.length > 0) {
      WF.showMessage(result.conversionFailures.toString(), !result.isUsable);
    }
    if (result.isUsable && result.value) {
      // Apply configuration
      applyConfiguration(result.value);
      return true;
    } else {
      return false;
    }
  }

  /**
   * Applies the given user configuration object.
   * @param {Map<string, any>} configObject The configuration object.
   * @returns {void}
   */
  function applyConfiguration(configObject) {
    // Text expansions
    /** @type Map<string, string> */
    const expansionsConfig = configObject.get(CONFIG_SECTION_EXPANSIONS) || new Map();
    customExpansions = new Map([...abbrevsFromTags, ...expansionsConfig]);

    // Keyboard shortcuts
    /** @type Map<string, string> */
    const shortcutsConfig = configObject.get(CONFIG_SECTION_KB_SHORTCUTS) || new Map();
    const allKeyCodesToFunctions = new Map([
      ...kbShortcutsFromTags,
      ..._convertKbShortcutsConfigToTargetMap(shortcutsConfig)
    ]);
    allKeyCodesToFunctions.forEach((target, code) => {
      canonicalKeyCodesToTargets.set(code, target);
    });

    // Banned bookmark searches
    bannedBookmarkSearchPrefixesToSuggestions =
      configObject.get(CONFIG_SECTION_BANNED_BOOKMARK_SEARCH_PREFIXES) || new Map();

    // Bookmarks
    applyBookmarksConfiguration(configObject);
  }

  /**
   * Applies the bookmarks configuration for given user configuration object.
   * @param {Map<string, any>} configObject The configuration object.
   * @returns {void}
   */
  function applyBookmarksConfiguration(configObject) {
    /** @type Map<string, Item> */
    const bookmarksConfig = configObject.get(CONFIG_SECTION_BOOKMARKS) || new Map();
    bookmarksConfig.forEach((sourceItem, bookmarkName) => {
      bookmarksToSourceItems.set(bookmarkName, sourceItem);
      const wfUrl = sourceItem.getNoteInPlainText();
      if (isWorkFlowyUrl(wfUrl)) {
        const [item, query] = findItemAndSearchQueryForWorkFlowyUrl(wfUrl);
        if (item) {
          bookmarksToItemTargets.set(bookmarkName, new ItemTarget(item, query));
          if (!itemIdsToFirstBookmarks.has(item.getId())) {
            itemIdsToFirstBookmarks.set(item.getId(), bookmarkName);
          }
        } else {
          WF.showMessage(`No item found for URL ${wfUrl}, re bookmark "${bookmarkName}".`);
        }
      } else {
        WF.showMessage(`"${wfUrl}" is not a valid WorkFlowy URL, re bookmark "${bookmarkName}".`);
      }
    });
  }

  /**
   * @returns {Array<Item>} Recently edited items, most recent first.
   * @param {number} earliestModifiedSec Items edited before this are excluded.
   * @param {number} maxSize The results array will be at most this size.
   * @param {Item} searchRoot The root item of the search.
   */
  function findRecentlyEditedItems(earliestModifiedSec, maxSize, searchRoot) {
    const scoreFn = itemToLastModifiedSec; // Higher timestamp is a higher score
    return findTopItemsByScore(scoreFn, earliestModifiedSec, maxSize, searchRoot);
  }

  class ItemMove {
    constructor(itemToMove, targetItem) {
      this.itemToMove = itemToMove;
      this.targetItem = targetItem;
    }
  }

  /**
   * @param {ItemMove} itemMove The move to validate.
   * @returns {string} An error message if failed, or null if succeeded.
   */
  function validateMove(itemMove) {
    const itemToMove = itemMove.itemToMove;
    const targetItem = itemMove.targetItem;
    if (!isSafeToMoveItemToTarget(itemToMove, targetItem)) {
      return `Cannot move ${formatItem(itemToMove)} to ${formatItem(targetItem)}.`;
    }
    return null;
  }

  /**
   * @param {Array<ItemMove>} itemMoves The moves to validate.
   * @returns {string} An error message if failed, or null if succeeded.
   */
  function validateMoves(itemMoves) {
    for (const itemMove of itemMoves) {
      const failureMessage = validateMove(itemMove);
      if (failureMessage) {
        return failureMessage;
      }
    }
    return null;
  }

  /**
   * @param {Array<ItemMove>} itemMoves The moves to perform.
   * @returns {string?} An error message if failed, or null if succeeded.
   */
  function performMoves(itemMoves) {
    let whyUnsafe = validateMoves(itemMoves);
    let itemsMovedAlready = 0;
    if (whyUnsafe) {
      return whyUnsafe;
    }
    // Re-do move safety checks, as the structure can changes as we go
    for (const itemMove of itemMoves) {
      const itemToMove = itemMove.itemToMove;
      const targetItem = itemMove.targetItem;
      if (!isSafeToMoveItemToTarget(itemToMove, targetItem)) {
        const prefix = itemsMovedAlready ? `Partial failure: ${itemsMovedAlready} item(s) moved already, but: ` : "";
        return `${prefix}Cannot move ${formatItem(itemToMove)} to ${formatItem(targetItem)}.`;
      }
      WF.moveItems([itemToMove], targetItem, 0);
      itemsMovedAlready++;
    }
    return null;
  }

  /**
   * @param {Array<ItemMove>} itemMoves The moves to make.
   * @param {boolean} shouldConfirm Whether to prompt the user to confirm.
   * @param {function} toRunAfterSuccessInEditGroup Function to call after successful completion in same edit group,
   *                                                of type () -> void.
   * @returns {void}
   * @throws {AbortActionError} If a failure occurs
   */
  function moveInEditGroupOrFail(itemMoves, shouldConfirm = false, toRunAfterSuccessInEditGroup = null) {
    const toMoveCount = itemMoves.length;
    if (toMoveCount === 0) {
      WF.showMessage("No moves required.");
      if (toRunAfterSuccessInEditGroup) {
        WF.editGroup(() => toRunAfterSuccessInEditGroup());
      }
      return;
    }
    const prompt = `Move ${toMoveCount} item(s)?`;
    failIf(shouldConfirm && !confirm(prompt), "Moves cancelled by user");
    let errorMessage;
    WF.editGroup(() => {
      errorMessage = performMoves(itemMoves);
      if (!errorMessage && toRunAfterSuccessInEditGroup) {
        toRunAfterSuccessInEditGroup();
      }
    });
    failIf(errorMessage, errorMessage);
    WF.showMessage(`Moved ${toMoveCount} item(s).`);
  }

  /** @type DatesModule */
  const datesModule = (function() {
    const domParser = new DOMParser();

    class DateEntry {
      /**
       * Year month and day.
       * @param {string?} startYear The year attribute or null
       * @param {string?} startMonth The month attribute or null
       * @param {string?} startDay The day attribute or null
       * @param {string} innerHTML The inner HTML visible in the name/note
       */
      constructor(startYear, startMonth, startDay, innerHTML) {
        this.startYear = startYear;
        this.startMonth = startMonth;
        this.startDay = startDay;
        this.innerHTML = innerHTML;
        this.name = "DateEntry";
      }
    }

    const STANDARD_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const STANDARD_DAY_NAMES_FROM_SUNDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const FULL_DAY_NAMES_FROM_SUNDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const DAY_TOKEN_ARRAYS_FROM_SUNDAY = [
      ["su", "sun", "sunday"],
      ["m", "mo", "mon", "monday"],
      ["tu", "tue", "tues", "tuesday"],
      ["w", "we", "wed", "wednesday"],
      ["th", "thu", "thursday"],
      ["f", "fr", "fri", "friday"],
      ["sa", "sat", "saturday"]
    ];
    const TODAY_TOKENS = ["td", "tod", "tdy", "today"];
    const TOMORROW_TOKENS = ["tm", "tw", "tmw", "tom", "tmrw", "tomorrow"];
    const YESTERDAY_TOKENS = ["y", "ye", "ys", "yes", "yest", "yst", "yd", "yesterday"];
    const EPOCH_TOKENS = ["ep", "epoch"];
    const END_TIME_TOKENS = ["et", "eot", "end"];

    // Only use for simple alphanumeric strings
    function asCapturingGroup(arrayOfStrings) {
      return `(${arrayOfStrings.join("|")})`;
    }

    const ALL_DAY_NAMES_CAPTURING_GROUP = asCapturingGroup(DAY_TOKEN_ARRAYS_FROM_SUNDAY.flat());

    const NAME_WEEK_TOKENS = ["w", "we", "wk", "week"];
    const NAME_LAST_TOKENS = ["l", "la", "lst", "last"];

    const onePatternWithSpaces = p => new RegExp(`^ *${p} *$`, "i");
    const twoPatternsWithSpaces = (a, b) => new RegExp(`^ *${a} +${b} *$`, "i");

    function getOrdinalOrCardinalDayOfMonthAsCapturingGroup() {
      const cardinals = Array.from(Array(31).keys()).map(n => (n + 1).toString());
      const ordinals = cardinals.map(s => `${s}th`);
      const offset = 1;
      ordinals[1 - offset] = "1st";
      ordinals[2 - offset] = "2nd";
      ordinals[3 - offset] = "3rd";
      ordinals[21 - offset] = "21st";
      ordinals[22 - offset] = "22nd";
      ordinals[23 - offset] = "23rd";
      ordinals[31 - offset] = "31st";
      const combined = ordinals.concat(cardinals);
      return `${asCapturingGroup(combined)}`;
    }

    class DateInterpretation {
      /**
       * @param {Date} date Date object form
       * @param {string} description The description of the interpreted date,
       *                             e.g. "Monday week, 8 days away"
       */
      constructor(date, description) {
        this.date = date;
        this.description = description;
      }
    }

    /**
     * @param {string} givenNamedDay The token representing a named day
     * @returns {number} 0 for Sunday, ..., 6 for Saturday, -1 if not found
     */
    function nameTokenToDayNumber(givenNamedDay) {
      for (var dayNumber = 0; dayNumber < 7; dayNumber++) {
        if (DAY_TOKEN_ARRAYS_FROM_SUNDAY[dayNumber].includes(givenNamedDay.toLowerCase())) {
          return dayNumber;
        }
      }
      return -1;
    }

    /**
     * @param {Date} referenceDate The "today" date to use as a reference
     * @param {number} dayNumber The day number to find (Sunday is 0)
     * @returns {number} The number of days until the next occurrence of the
     *                   given day number after the reference
     */
    function daysFromReferenceUntilComingDayNumber(referenceDate, dayNumber) {
      const refDayNumber = referenceDate.getDay();
      return dayNumber === refDayNumber ? 7 : (dayNumber + 7 - refDayNumber) % 7;
    }

    /**
     * @param {Date} referenceDate The "today" date to use as a reference
     * @param {number} dayNumber The day number to find (Sunday is 0)
     * @returns {number} The number of days since the most recent previous
     *                   occurrence of the given day number before the reference
     */
    function daysFromRecentDayNumberUntilReference(referenceDate, dayNumber) {
      const refDayNumber = referenceDate.getDay();
      return dayNumber === refDayNumber ? 7 : (refDayNumber + 7 - dayNumber) % 7;
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsYesterday(s, referenceDate) {
      if (s.match(onePatternWithSpaces(asCapturingGroup(YESTERDAY_TOKENS)))) {
        return [new DateInterpretation(getNoonDateNDaysAway(-1, referenceDate), "Yesterday"), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsToday(s, referenceDate) {
      if (s.match(onePatternWithSpaces(asCapturingGroup(TODAY_TOKENS)))) {
        return [new DateInterpretation(getNoonDateNDaysAway(0, referenceDate), "Today"), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsTodayWeek(s, referenceDate) {
      if (s.match(twoPatternsWithSpaces(asCapturingGroup(TODAY_TOKENS), asCapturingGroup(NAME_WEEK_TOKENS)))) {
        return [new DateInterpretation(getNoonDateNDaysAway(7, referenceDate), "A week from today, 7 days away"), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsTomorrow(s, referenceDate) {
      if (s.match(onePatternWithSpaces(asCapturingGroup(TOMORROW_TOKENS)))) {
        return [new DateInterpretation(getNoonDateNDaysAway(1, referenceDate), "Tomorrow"), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsTomorrowWeek(s, referenceDate) {
      if (s.match(twoPatternsWithSpaces(asCapturingGroup(TOMORROW_TOKENS), asCapturingGroup(NAME_WEEK_TOKENS)))) {
        const description = "A week from tomorrow, 8 days away";
        return [new DateInterpretation(getNoonDateNDaysAway(8, referenceDate), description), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsMostRecentNamedDay(s, referenceDate) {
      const result = s.match(twoPatternsWithSpaces(ALL_DAY_NAMES_CAPTURING_GROUP, asCapturingGroup(NAME_LAST_TOKENS)));
      if (result) {
        const givenNamedDay = result[1];
        const dayNumber = nameTokenToDayNumber(givenNamedDay);
        const daysPrior = daysFromRecentDayNumberUntilReference(referenceDate, dayNumber);
        return [
          new DateInterpretation(
            getNoonDateNDaysAway(-daysPrior, referenceDate),
            `${FULL_DAY_NAMES_FROM_SUNDAY[dayNumber]} gone, ${daysPrior} days prior`
          ),
          null
        ];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsComingNamedDay(s, referenceDate) {
      const result = s.match(onePatternWithSpaces(ALL_DAY_NAMES_CAPTURING_GROUP));
      if (result) {
        const givenNamedDay = result[1];
        const dayNumber = nameTokenToDayNumber(givenNamedDay);
        const daysAway = daysFromReferenceUntilComingDayNumber(referenceDate, dayNumber);
        return [
          new DateInterpretation(
            getNoonDateNDaysAway(daysAway, referenceDate),
            `${FULL_DAY_NAMES_FROM_SUNDAY[dayNumber]}, ${daysAway} days away`
          ),
          null
        ];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsComingNamedDayPlusWeek(s, referenceDate) {
      const result = s.match(twoPatternsWithSpaces(ALL_DAY_NAMES_CAPTURING_GROUP, asCapturingGroup(NAME_WEEK_TOKENS)));
      if (result) {
        const givenNamedDay = result[1];
        const dayNumber = nameTokenToDayNumber(givenNamedDay);
        const daysAway = 7 + daysFromReferenceUntilComingDayNumber(referenceDate, dayNumber);
        return [
          new DateInterpretation(
            getNoonDateNDaysAway(daysAway, referenceDate),
            `${FULL_DAY_NAMES_FROM_SUNDAY[dayNumber]} week, ${daysAway} days away`
          ),
          null
        ];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsDayAndMonthEitherOrder(s, referenceDate) {
      const monthsCapturingGroup = asCapturingGroup(STANDARD_MONTH_NAMES);
      const dayGroup = getOrdinalOrCardinalDayOfMonthAsCapturingGroup();
      var dayOfMonthString;
      var monthName;

      var dayThenMonthResult = s.match(twoPatternsWithSpaces(dayGroup, monthsCapturingGroup));
      var monthThenDayResult = s.match(twoPatternsWithSpaces(monthsCapturingGroup, dayGroup));
      if (dayThenMonthResult) {
        dayOfMonthString = dayThenMonthResult[1];
        monthName = dayThenMonthResult[2];
      } else if (monthThenDayResult) {
        monthName = monthThenDayResult[1];
        dayOfMonthString = monthThenDayResult[2];
      } else {
        return [null, null];
      }

      const simpleNumberString = dayOfMonthString.replace(/a-z/gi, "");
      const simpleNumber = parseInt(simpleNumberString);
      const monthIndex = STANDARD_MONTH_NAMES.map(s => s.toLowerCase()).indexOf(monthName.toLowerCase());
      const date = new Date(referenceDate.getFullYear(), monthIndex, simpleNumber, 12, 0, 0);
      const description = `${simpleNumberString} ${STANDARD_MONTH_NAMES[monthIndex]}`;
      if (date.getTime() <= referenceDate.getTime()) {
        return [null, "Month and day formats only supported for clearly future dates. To fix: specify the year."];
      }
      return [new DateInterpretation(date, description), null];
    }

    /**
     * @param {string} s The date to interpret
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsEpoch(s) {
      if (s.match(onePatternWithSpaces(asCapturingGroup(EPOCH_TOKENS)))) {
        return [new DateInterpretation(new Date(0), "Epoch"), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsEndOfTime(s) {
      if (s.match(onePatternWithSpaces(asCapturingGroup(END_TIME_TOKENS)))) {
        const endOfTime = new Date(9999, 11, 31, 23, 59, 59); // Pessimistic
        return [new DateInterpretation(endOfTime, "End of time"), null];
      } else return [null, null];
    }

    /**
     * @param {string} s The date to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {[DateInterpretation?, string?]} Date interpretation or error message, or neither if no match
     */
    function interpretAsNDaysOrWeeksAway(s, referenceDate) {
      const cardinalNumberGroup = "([1-9][0-9]*)";
      const dayOrWeekSuffixGroup = "(d|w)";
      const result = s.match(onePatternWithSpaces(`${cardinalNumberGroup}${dayOrWeekSuffixGroup}`));
      if (result) {
        const numberString = result[1];
        const number = parseInt(numberString);
        const dayOrWeekString = result[2];
        const isWeeks = dayOrWeekString.toLowerCase() === "w";
        const date = getNoonDateNDaysAway(number * (isWeeks ? 7 : 1), referenceDate);
        const description = `${formatDateWithoutTime(date)}, ${number} ${isWeeks ? "week" : "day"}(s) away`;
        return [new DateInterpretation(date, description), null];
      } else return [null, null];
    }

    /**
     * Attempts to parse the given date string, returning a corresponding
     * Date object at noon (12pm) or an error message.
     * @param {string} s The string to parse
     * @param {Date} referenceDate The "today" date to use as a reference
     * @return {[DateInterpretation?, string?]} A tuple with exactly one of a
     *   DateInterpretation, or an error explaining why it couldn't be recognized.
     *   The other value will be null.
     */
    function interpretDate(s, referenceDate) {
      // Note: optimise for flexibility and maintainability, not runtime speed.

      const interpretations = [];
      const errors = [];
      const addIfMatch = ([interpretation, error]) => {
        if (interpretation) {
          interpretations.push(interpretation);
        }
        if (error) {
          errors.push(error);
        }
      };
      addIfMatch(interpretAsYesterday(s, referenceDate));
      addIfMatch(interpretAsToday(s, referenceDate));
      addIfMatch(interpretAsTodayWeek(s, referenceDate));
      addIfMatch(interpretAsTomorrow(s, referenceDate));
      addIfMatch(interpretAsTomorrowWeek(s, referenceDate));
      addIfMatch(interpretAsComingNamedDay(s, referenceDate));
      addIfMatch(interpretAsComingNamedDayPlusWeek(s, referenceDate));
      addIfMatch(interpretAsMostRecentNamedDay(s, referenceDate));
      addIfMatch(interpretAsDayAndMonthEitherOrder(s, referenceDate));
      addIfMatch(interpretAsEpoch(s));
      addIfMatch(interpretAsEndOfTime(s));
      addIfMatch(interpretAsNDaysOrWeeksAway(s, referenceDate));

      if (interpretations.length === 1 && errors.length === 0) {
        return [interpretations[0], null];
      } else if (errors.length !== 0) {
        return [null, errors[0]];
      } else if (interpretations.length === 0) {
        return [null, `"${s}" was not recognized as a date`];
      } else if (interpretations.length > 1) {
        return [null, `"${s}" was recognized in too many ways: ${interpretations.map(i => i.description).join(", ")}`];
      }
    }

    /**
     * @param {Date} date The date object to format in WorkFlowy's default style
     * @returns {string} The date as a string
     */
    function formatDateWithoutTime(date) {
      // E.g. Sat, Feb 29, 2020
      const year = date.getFullYear().toString();
      const dayNumber = date.getDate().toString();
      const monthName = STANDARD_MONTH_NAMES[date.getMonth()];
      const dayName = STANDARD_DAY_NAMES_FROM_SUNDAY[date.getDay()];
      return `${dayName}, ${monthName} ${dayNumber}, ${year}`;
    }

    /**
     * Sets the time of the given date to noon (12pm).
     * @param {Date} date The date to set
     * @returns {void}
     */
    function setToNoon(date) {
      date.setHours(12);
      date.setMinutes(0);
      date.setSeconds(0);
    }

    /**
     * Returns a Date object the given number of days from the reference date,
     * at noon (12pm)
     * @param {number} daysFromReference The number of days from today
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {Date} A future Date
     */
    function getNoonDateNDaysAway(daysFromReference, referenceDate) {
      const date = referenceDate ? new Date(referenceDate) : new Date();
      // This is to reduce likelihood of out by one errors re leap seconds
      setToNoon(date);
      const epochMillis = date.getTime();
      const newEpochMillis = epochMillis + 1000 * 60 * 60 * 24 * daysFromReference;
      date.setTime(newEpochMillis);
      setToNoon(date);
      return date;
    }

    /**
     * Converts the given date to a DateEntry, with year/month/date and
     * innerHTML set.
     * @param {Date} date The date object to convert
     * @return {DateEntry} The converted date entry
     */
    function dateToDateEntry(date) {
      return new DateEntry(
        date.getFullYear().toString(),
        (date.getMonth() + 1).toString(),
        date.getDate().toString(),
        formatDateWithoutTime(date)
      );
    }

    const TIME_ATTR_STARTYEAR = "startYear";
    const TIME_ATTR_STARTMONTH = "startMonth";
    const TIME_ATTR_STARTDAY = "startDay";

    /**
     * Converts the given <time> element to a DateEntry
     * @param {HTMLElement} timeElement The <time> element to convert
     * @returns {DateEntry} A corresponding date entry
     */
    // eslint-disable-next-line no-unused-vars
    function timeElementToDateEntry(timeElement) {
      const dateEntry = new DateEntry(
        timeElement.getAttribute(TIME_ATTR_STARTYEAR),
        timeElement.getAttribute(TIME_ATTR_STARTMONTH),
        timeElement.getAttribute(TIME_ATTR_STARTDAY),
        timeElement.innerHTML
      );
      return dateEntry;
    }

    /**
     * WARNING: Never write the serialized DOM element back to
     * items, as WorkFlowy reads some attributes case sensitively,
     * but casing of HTML element attributes is not preserved in the DOM.
     *
     * Returns the string as an HTML body and <time> elements array.
     *
     * @param {string} s The string to parse
     * @returns {[HTMLElement, Array<HTMLElement>]} HTML body and <time>s
     */
    function stringToHtmlBodyAndTimeElements(s) {
      const htmlDoc = domParser.parseFromString(s, "text/html");
      const body = htmlDoc.body;
      const timeElements = Array.from(body.getElementsByTagName("time"));
      return [body, timeElements];
    }

    /**
     * @param {string} s The string to parse
     * @returns {boolean} Whether or not the string contains <time> elements
     */
    function doesRawStringHaveDates(s) {
      return s.includes("<time");
    }

    /**
     * Returns the text before the first date, then the string of the first
     * date (the <time> element), then the text after.
     * If there is no date, the first two values are empty.
     * @param {string} s The string to split
     * @returns {[string, string, string]} Before the date, the date, and after.
     */
    function splitByFirstDate(s) {
      if (!doesRawStringHaveDates(s)) {
        return ["", "", s];
      }
      const indexOfDateEntryStart = s.indexOf("<time");
      const endTag = "</time>";
      const indexOfDateEntryEnd = s.indexOf(endTag) + endTag.length;
      return [
        s.substring(0, indexOfDateEntryStart),
        s.substring(indexOfDateEntryStart, indexOfDateEntryEnd),
        s.substring(indexOfDateEntryEnd, s.length)
      ];
    }

    /**
     * Creates a <time> entry string with data from the given date entry
     * @param {DateEntry} dateEntry The date entry to use as a data source
     * @returns {string} The <time> entry as a string
     */
    function createDateAsRawString(dateEntry) {
      var s = "<time";
      const setAttribute = (name, value) => {
        if (value) {
          s = s + ` ${name}="${value}"`;
        }
      };
      setAttribute(TIME_ATTR_STARTYEAR, dateEntry.startYear);
      setAttribute(TIME_ATTR_STARTMONTH, dateEntry.startMonth);
      setAttribute(TIME_ATTR_STARTDAY, dateEntry.startDay);
      s = s + ">" + dateEntry.innerHTML + "</time>";
      return s;
    }

    /**
     * Updates the first <time> element in the given string, pre-pending one
     * if not already present.
     * @param {string} s The string to update
     * @param {DateEntry} dateEntry The source of the date information
     * @return {string} The updated string with updated/prepended first <time>
     */
    function setFirstDateOnRawString(s, dateEntry) {
      var [pre, date, post] = splitByFirstDate(s);
      date = createDateAsRawString(dateEntry);
      if (pre && !pre.endsWith(" ")) {
        pre = pre + " ";
      }
      if (post && !post.startsWith(" ")) {
        post = " " + post;
      }
      return pre + date + post;
    }

    /**
     * Removes the first <time> element in the given string, if any.
     * @param {string} s The string to update
     * @return {string} The updated string with removed first <time>
     */
    function clearFirstDateOnRawString(s) {
      var [pre, , post] = splitByFirstDate(s);
      // Trim on both sides, to remove any padding which had been added for the date
      pre = pre.trimRight();
      post = post.trimLeft();
      // If deleting the date squashes non-space characters together, ensure a space
      var padding = "";
      if (pre.trim() && post.trim() && !pre.endsWith(" ") && !post.startsWith(" ")) {
        padding = " ";
      }
      return pre + padding + post;
    }

    // eslint-disable-next-line no-unused-vars
    function fixTimeTagCase(nameOrNote) {
      if (!nameOrNote) {
        return nameOrNote;
      }
      return nameOrNote
        .replace(/<time([^>]*)startyear([^>]*)>/gi, "<time$1startYear$2>")
        .replace(/<time([^>]*)startmonth([^>]*)>/gi, "<time$1startMonth$2>")
        .replace(/<time([^>]*)startday([^>]*)>/gi, "<time$1startDay$2>");
    }

    /**
     * Updates the first <time> element in the given item, pre-pending one
     * on the note if not already present.
     * @param {Item} item The item to update
     * @param {DateEntry} dateEntry The source of the date information
     * @return {void}
     */
    function setFirstDateOnItem(item, dateEntry) {
      if (doesRawStringHaveDates(item.getName())) {
        WF.setItemName(item, setFirstDateOnRawString(item.getName(), dateEntry));
      } else {
        WF.setItemNote(item, setFirstDateOnRawString(item.getNote(), dateEntry));
      }
    }

    /**
     * Removes the first <time> element in the given item, if any.
     * @param {Item} item The item to update
     * @return {void}
     */
    function clearFirstDateOnItem(item) {
      if (doesRawStringHaveDates(item.getName())) {
        WF.setItemName(item, clearFirstDateOnRawString(item.getName()));
      } else if (doesRawStringHaveDates(item.getNote())) {
        WF.setItemNote(item, clearFirstDateOnRawString(item.getNote()));
      }
    }

    /**
     * Updates the first <time> element in the active items, pre-pending one
     * if not already present.
     * @returns {void}
     * @throws {AbortActionError} If a failure occurs
     */
    function _updateDateOnActiveItemsOrFail() {
      const activeItems = getActiveItems().items;
      activeItems.forEach(validateItemIsLocalOrFail);

      const today = new Date();
      const question = `Update date on ${activeItems.length} item(s) to what?`;
      const suffix = ` (Today is ${formatDateWithoutTime(today)}})`;
      const dateString = prompt(question + suffix);
      if (!dateString || !dateString.trim()) {
        return;
      }
      const [interpretation, errorMessage] = interpretDate(dateString, today);
      failIf(!!errorMessage, errorMessage);
      const futureDate = interpretation.date;
      const futureDateEntry = dateToDateEntry(futureDate);

      WF.editGroup(() => {
        for (const activeItem of activeItems) {
          setFirstDateOnItem(activeItem, futureDateEntry);
        }
      });
      WF.showMessage(`Dated ${activeItems.length} item(s) for ${interpretation.description}`);
    }

    /**
     * Fail if the given item has more than one date.
     * @param {Item} item The item to check
     * @returns {void}
     * @throws {AbortActionError} If the item has more than one date
     */
    function failIfMultipleDates(item) {
      const fullHtml = item.getName() + item.getNote();
      const [, timeElements] = stringToHtmlBodyAndTimeElements(fullHtml);
      failIf(timeElements.length > 1, `Item ${formatItem(item)} has more than 1 date.`);
    }

    /**
     * Clears the first <time> element in the active items, if any,
     * failing if any items have multiple <time> elements.
     * @returns {void}
     * @throws {AbortActionError} If a failure occurs
     */
    function _clearDateOnActiveItemsOrFail() {
      const activeItems = getActiveItems().items;
      activeItems.forEach(validateItemIsLocalOrFail);

      const question = `CLEAR date on ${activeItems.length} item(s)?`;
      if (!confirm(question)) {
        return;
      }

      activeItems.forEach(failIfMultipleDates);

      WF.editGroup(() => {
        for (const activeItem of activeItems) {
          clearFirstDateOnItem(activeItem);
        }
      });
      WF.showMessage(`Cleared dates on ${activeItems.length} item(s)`);
    }

    /**
     * @param {string} dateOrRangeString The string to interpret
     * @param {Date} referenceDate The "today" date to use as a reference
     * @returns {string} The given rate or date range, as a WF search clause
     * @throws {AbortActionError} If not a valid relative date or date range
     */
    function toDateRangeClauseOrFail(dateOrRangeString, referenceDate) {
      const toDateStringOrEmptyOrFail = s => {
        if (!s) return "";
        const [interpretation, errorMessage] = interpretDate(s, referenceDate);
        failIf(!!errorMessage, errorMessage);
        return formatDateWithoutTime(interpretation.date);
      };

      const parts = dateOrRangeString
        .trim()
        .split("-")
        .map(s => s.trim());
      failIf(
        ![1, 2].includes(parts.length),
        `Couldn't parse relative date or date range "${dateOrRangeString}". (Hint: use one hyphen at most)`
      );
      const firstDateOrEmpty = toDateStringOrEmptyOrFail(parts[0]);
      const secondDateOrEmpty = parts.length === 2 ? toDateStringOrEmptyOrFail(parts[1]) : "";
      failIf(!firstDateOrEmpty && !secondDateOrEmpty, "No date specified");
      const dateClause = parts.length === 1 ? firstDateOrEmpty : firstDateOrEmpty + "-" + secondDateOrEmpty;
      return dateClause;
    }

    /**
     * Prompts for a related date or range of relative dates, then
     * performs an equivalent date search.
     * @returns {void}
     * @throws {AbortActionError} If a failure occurs
     */
    function _promptToFindByDateRangeOrFail() {
      const dateOrRangeString = prompt("Enter relative date or range (a, a-, -b, a-b):");
      if (!dateOrRangeString || !dateOrRangeString.trim()) {
        return;
      }
      const today = new Date();
      const dateClause = toDateRangeClauseOrFail(dateOrRangeString, today);
      WF.search(dateClause);
    }

    const clearDate = () => callWithErrorHandling(_clearDateOnActiveItemsOrFail);
    const updateDate = () => callWithErrorHandling(_updateDateOnActiveItemsOrFail);
    const promptToFindByDateRange = () => callWithErrorHandling(_promptToFindByDateRangeOrFail);

    return {
      _updateDateOnActiveItemsOrFail: _updateDateOnActiveItemsOrFail,
      clearDate: clearDate,
      clearFirstDateOnItem: clearFirstDateOnItem,
      clearFirstDateOnRawString: clearFirstDateOnRawString,
      dateToDateEntry: dateToDateEntry,
      doesRawStringHaveDates: doesRawStringHaveDates,
      failIfMultipleDates: failIfMultipleDates,
      interpretDate: interpretDate,
      promptToFindByDateRange: promptToFindByDateRange,
      setFirstDateOnItem: setFirstDateOnItem,
      updateDate: updateDate
    };
  })();

  /** @type {NameTreeModule} */
  const nameTreeModule = (function() {
    const nameTreeSeparator = "::";
    const exampleNameChain = `a${nameTreeSeparator}b${nameTreeSeparator}...${nameTreeSeparator}`;

    /**
     * @param {string} nameChain The name chain.
     * @returns {string?} The parent name chain, or null if a name tree root,
     *                    or not a name chain.
     */
    function nameChainToParent(nameChain) {
      if (!nameChain) {
        return null;
      }
      const separatorLength = nameTreeSeparator.length;
      // Slice off the last part of the chain
      const penultimateSeparatorIndex = nameChain.lastIndexOf(
        nameTreeSeparator,
        nameChain.length - (separatorLength + 1)
      );
      const parentChain =
        penultimateSeparatorIndex === -1 || penultimateSeparatorIndex === 0
          ? null
          : nameChain.substring(0, penultimateSeparatorIndex + separatorLength);
      return parentChain;
    }

    /**
     * @param {string} nameChain The name chain.
     * @returns {string?} The root name chain, or null if not a name chain.
     */
    function nameChainToRoot(nameChain) {
      if (!nameChain) {
        return null;
      }
      const parentChain = nameChainToParent(nameChain);
      if (parentChain === null) {
        // We are a name chain with no parent, therefore we're the root
        return nameChain;
      } else {
        // Recurse
        return nameChainToRoot(parentChain);
      }
    }

    /**
     * @param {string} a The name chain A.
     * @param {string} b The name chain B.
     * @returns {boolean} Whether A is a parent of B.
     */
    // eslint-disable-next-line no-unused-vars
    function isNameChainAParentOfB(a, b) {
      return a && b && a === nameChainToParent(b);
    }

    /**
     * @param {string} a The name chain A.
     * @param {string} b The name chain B.
     * @returns {boolean} Whether A is an ancestor of B.
     */
    function isNameChainAAncestorOfB(a, b) {
      return a && b && a !== b && b.startsWith(a);
    }

    class NameChainAndItem {
      /**
       * @param {string} nameChain The name chain of the item.
       * @param {Item} item The item itself.
       */
      constructor(nameChain, item) {
        this.nameChain = nameChain;
        this.item = item;
      }
    }

    /**
     * @param {string} text The text to simplify.
     * @param {string} openingBracket Opening bracket char.
     * @param {string} closingBracket Closing bracket char.
     * @returns {string} The updated text.
     */
    function trimBracketedText(text, openingBracket, closingBracket) {
      if (openingBracket.length !== 1 || closingBracket.length !== 1) {
        throw "Programmer error: opening or closing bracket must be 1 character.";
      }
      const trimmedText = text.trim();
      if (trimmedText.startsWith(openingBracket) && trimmedText.includes(closingBracket)) {
        const closingIndex = text.lastIndexOf(closingBracket);
        return trimmedText.substring(closingIndex + 1).trimLeft();
      } else if (trimmedText.endsWith(closingBracket)) {
        const openingIndex = text.indexOf(openingBracket);
        return trimmedText.substring(0, openingIndex).trimRight();
      } else {
        return text;
      }
    }

    function simplifyNameTreeName(name) {
      let shouldContinue = true;
      name = name.toLowerCase();
      while (shouldContinue) {
        const nameBeforeLoop = name;
        name = trimBracketedText(name, "[", "]");
        name = trimBracketedText(name, "(", ")");
        name = trimBracketedText(name, "{", "}");
        name = name.trim();
        shouldContinue = nameBeforeLoop !== name; // Until we reach a fixed point
      }
      return name;
    }

    /**
     * @param {string} plainText Plain text name or note of the item to parse.
     * @param {string} richText Rich text name or note of the item to parse.
     * @returns {string?} Name chain for the item, or null.
     */
    function plainAndRichNameOrNoteToNameChain(plainText, richText) {
      // Optimisation: eliminate the common case first (not in a name tree):
      if (!plainText.includes(nameTreeSeparator)) {
        return null;
      }

      // Strip all dates (<time> elements)
      while (datesModule.doesRawStringHaveDates(richText)) {
        richText = datesModule.clearFirstDateOnRawString(richText);
        plainText = richTextToPlainText(richText);
        // Check again for the separator, in case it only appeared in date text
        if (!plainText.includes(nameTreeSeparator)) {
          return null;
        }
      }

      // For multiline strings, only analyse the first line
      if (plainText.includes("\n")) {
        plainText = plainText.split("\n", 1)[0];
        if (!plainText.includes(nameTreeSeparator)) {
          return null;
        }
      }

      const rawNames = plainText.split(nameTreeSeparator);
      rawNames.pop(); // Remove any text after the last separator
      const simplifiedNames = rawNames.map(simplifyNameTreeName);
      return simplifiedNames.join(nameTreeSeparator) + nameTreeSeparator;
    }

    /**
     * @param {Item} item Item to extract the name chain from.
     * @returns {string?} Name chain for the item, or null.
     */
    function itemToNameChain(item) {
      if (!item) {
        return null;
      }
      return (
        plainAndRichNameOrNoteToNameChain(item.getNameInPlainText(), item.getName()) ||
        plainAndRichNameOrNoteToNameChain(item.getNoteInPlainText(), item.getNote())
      );
    }

    function toNameChainAndItem(item) {
      return new NameChainAndItem(itemToNameChain(item), item);
    }

    /**
     * @returns {Array<NameChainAndItem>} All name trees local to document.
     */
    function getAllLocalNameTrees() {
      return findMatchingItems(item => !item.isEmbedded() && itemToNameChain(item), WF.rootItem()).map(
        toNameChainAndItem
      );
    }

    /**
     * @param {Array<NameChainAndItem>} nameChainsAndItems Entries to map.
     * @returns {Map<string, Array<Item>>} The entries as a map.
     */
    function mapNameTreesByNameChains(nameChainsAndItems) {
      /** @type {Map<string, Array<Item>>} */
      const multimap = new Map();
      for (const entry of nameChainsAndItems) {
        addToMultimap(entry.nameChain, entry.item, multimap);
      }
      return multimap;
    }

    class ItemAndNameTreeParents {
      /**
       * @param {Item} item The item.
       * @param {string} nameChain The name chain.
       * @param {Array<Item>} parents The item's parents.
       */
      constructor(item, nameChain, parents) {
        this.item = item;
        this.nameChain = nameChain;
        this.parents = parents;
      }
    }

    class ProcessNameTreesResult {
      /**
       * @param {Array<ItemAndNameTreeParents>} singleParentItems Items with 1 parent.
       * @param {Array<ItemAndNameTreeParents>} noParentItems Items with no parent.
       * @param {Array<ItemAndNameTreeParents>} manyParentItems Items with many parents.
       * @param {Array<ItemAndNameTreeParents>} nameTreeRoots Name tree root items.
       * @param {Map<string, Array<Item>>} duplicateNameChains Name chains with multiple items.
       * @param {Array<ItemMove>} requiredMoves The required moves to restore name trees.
       * @param {Array<String>} impossibleMoves Messages describing impossible moves.
       */
      constructor(
        singleParentItems,
        noParentItems,
        manyParentItems,
        nameTreeRoots,
        duplicateNameChains,
        requiredMoves,
        impossibleMoves
      ) {
        this.singleParentItems = singleParentItems;
        this.noParentItems = noParentItems;
        this.manyParentItems = manyParentItems;
        this.nameTreeRoots = nameTreeRoots;
        this.duplicateNameChains = duplicateNameChains;
        this.requiredMoves = requiredMoves;
        this.impossibleMoves = impossibleMoves;
      }
    }

    /**
     * Processes the given name tree items.
     * Can be used to either (a) gather information about the status of
     * name trees, or (b) calculate required moves to restore the chosen
     * name tree items to the implied name tree structure. In the latter case,
     * both the impossibleMoves and requiredMoves results should inform what
     * action to take, and the other fields of the result can be ignored.
     *
     * @param {Map<string, Array<Item>>} nameTrees Name trees.
     * @param {function} nameChainPredicate A function (string -> boolean) which
     *                                 returns whether or not to process a name tree item
     *                                 based on its name chain.
     * @param {function} itemPredicate A function (Item -> boolean) which
     *                                 returns whether or not to process a name tree item
     *                                 based on the Item.
     * @returns {ProcessNameTreesResult} See ProcessNameTreesResult class.
     */
    function analyseNameTrees(nameTrees, nameChainPredicate, itemPredicate) {
      /** @type {Array<ItemAndNameTreeParents>} */
      const singleParentItems = [];
      /** @type {Array<ItemAndNameTreeParents>} */
      const noParentItems = [];
      /** @type {Array<ItemAndNameTreeParents>} */
      const manyParentItems = [];
      /** @type {Array<ItemAndNameTreeParents>} */
      const nameTreeRoots = [];
      /** @type {Map<string, Array<Item>>} */
      const nameChainsToItems = new Map();
      /** @type {Array<ItemMove>} */
      const requiredMoves = [];

      /** @type {Array<String>} */
      const impossibleMoves = [];

      /**
       * @param {Item} item The item to test.
       * @param {Array<Item>} candidateParents The possible parents.
       * @returns {boolean} Whether or not the item is a child of one of them.
       */
      function isItemAChildOfOneOf(item, candidateParents) {
        for (const parent of candidateParents) {
          if (item.getParent().getId() === parent.getId()) {
            return true;
          }
        }
        return false;
      }

      for (const [nameChain, items] of nameTrees) {
        if (nameChainPredicate && !nameChainPredicate(nameChain)) {
          continue;
        }
        const parentNameChain = nameChainToParent(nameChain);
        const parentItems = (parentNameChain && nameTrees.get(parentNameChain)) || [];
        const parentCount = parentItems.length;
        for (const item of items) {
          if (itemPredicate && !itemPredicate(item)) {
            continue;
          }
          addToMultimap(nameChain, item, nameChainsToItems);
          const itemAndNameTreeParents = new ItemAndNameTreeParents(item, nameChain, parentItems);
          let arrayToPushTo;
          if (!parentNameChain) {
            arrayToPushTo = nameTreeRoots;
            // No move required
          } else if (parentCount === 0) {
            arrayToPushTo = noParentItems;
            impossibleMoves.push(
              `No name tree parent found for item ${formatItem(item)} ` + `which has name chain "${nameChain}".`
            );
          } else if (parentCount === 1) {
            arrayToPushTo = singleParentItems;
            if (!isItemAChildOfOneOf(item, parentItems)) {
              requiredMoves.push(new ItemMove(item, parentItems[0]));
            }
          } else {
            arrayToPushTo = manyParentItems;
            if (!isItemAChildOfOneOf(item, parentItems)) {
              impossibleMoves.push(
                "Multiple name tree parents found for item " +
                  `${formatItem(item)} which has name chain "${nameChain}:"` +
                  `${parentItems.map(formatItem)}`
              );
            }
          }
          arrayToPushTo.push(itemAndNameTreeParents);
        }
      }

      /** @type {Map<string, Array<Item>>} */
      const duplicateNameChains = filterMapByValues(items => items.length > 1, nameChainsToItems);

      /** @type {Array<ItemMove>} */
      const validRequiredMoves = [];
      for (const move of requiredMoves) {
        const failureMessage = validateMove(move);
        if (failureMessage) {
          impossibleMoves.push(failureMessage);
        } else {
          validRequiredMoves.push(move);
        }
      }

      return new ProcessNameTreesResult(
        singleParentItems,
        noParentItems,
        manyParentItems,
        nameTreeRoots,
        duplicateNameChains,
        validRequiredMoves,
        impossibleMoves
      );
    }

    const always = () => true;

    /**
     * @param {string} existingMessage Message to append to
     * @param {number} indentCount Number of space to indent each line
     * @param {string} toAppend The string to append to the message
     * @returns {string} The resulting string
     */
    function appendIndented(existingMessage, indentCount, toAppend) {
      existingMessage = existingMessage || "";
      for (const line of toAppend.split("\n")) {
        existingMessage += " ".repeat(indentCount) + line + "\n";
      }
      return existingMessage;
    }

    /**
     * Validates all local name trees and shows a summary message via a dialog.
     * @returns {void}
     */
    function validateAllNameTrees() {
      /**
       * Takes a single map of name chains to item arrays, and splits those
       * maps by root name chain, returning a map of maps.
       * @param {Map<string, Array<Item>>} nameTreesByChains Items by name chain
       * @returns {Map<string, Map<string, Array<Item>>>} The split maps
       */
      function mapNameTreesByChainsByRoots(nameTreesByChains) {
        /** @type {Map<string, Map<string, Array<Item>>>} */
        const byRoots = new Map();
        for (const [nameChain, items] of nameTreesByChains.entries()) {
          const rootChain = nameChainToRoot(nameChain);
          /** @type {Map<string, Array<Item>>} */
          let mapForRoot = null;
          if (byRoots.has(rootChain)) {
            mapForRoot = byRoots.get(rootChain);
          } else {
            mapForRoot = new Map();
            byRoots.set(rootChain, mapForRoot);
          }
          mapForRoot.set(nameChain, items);
        }
        return byRoots;
      }

      const localNameTrees = getAllLocalNameTrees();
      const nameTreesByChains = mapNameTreesByNameChains(localNameTrees);
      const mapsByRoots = mapNameTreesByChainsByRoots(nameTreesByChains);

      let message = "Summary of name tree status for local name trees:\n";
      const addMsg = (indent, toAppend) => {
        message = appendIndented(message, indent, toAppend);
      };
      const fmt = formatItem;
      // Iterate over the name chain roots
      const sortedRootChains = Array.from(mapsByRoots.keys()).sort();
      for (const rootChain of sortedRootChains) {
        const nameTreesByChainsForRoot = mapsByRoots.get(rootChain);
        const result = analyseNameTrees(nameTreesByChainsForRoot, always, always);
        const r = result;
        addMsg(1, `For name tree ${rootChain}:`);
        addMsg(2, `${r.requiredMoves.length} item(s) needing moving:`);
        for (const move of r.requiredMoves) {
          addMsg(3, `${fmt(move.itemToMove)} -> ${fmt(move.targetItem)}`);
        }
        addMsg(2, `${r.duplicateNameChains.size} duplicate name chain(s):`);
        for (const dupedNameChain of r.duplicateNameChains.keys()) {
          addMsg(3, `For name chain "${dupedNameChain}:"`);
          for (const item of r.duplicateNameChains.get(dupedNameChain)) {
            addMsg(4, fmt(item));
          }
        }
        addMsg(2, `${r.noParentItems.length} item(s) with no parent:`);
        for (const orphan of r.noParentItems) {
          addMsg(3, fmt(orphan.item));
        }
        addMsg(2, `${r.manyParentItems.length} item(s) with many parents:`);
        for (const manyParentItem of r.manyParentItems) {
          addMsg(3, `${fmt(manyParentItem.item)} has many parents:`);
          for (const parent of manyParentItem.parents) {
            addMsg(4, fmt(parent));
          }
        }
        addMsg(2, `${r.nameTreeRoots.length} name tree root(s):`);
        for (const nameTreeRoot of r.nameTreeRoots) {
          addMsg(3, formatItem(nameTreeRoot.item));
        }
        addMsg(2, `${r.impossibleMoves.length} impossible moves:`);
        for (const impossibleMove of r.impossibleMoves) {
          addMsg(3, impossibleMove);
        }
        addMsg(1, `(End of summary for name tree ${rootChain})`);
      }

      alert(message);
      console.log(message);
    }

    /**
     * Fails if the given item does not have a valid name chain.
     * @param {Item} item The item to validate
     * @returns {void}
     * @throws {AbortActionError} If the item is not a name tree
     */
    function validateItemIsNameTreeOrFail(item) {
      failIf(
        !toNameChainAndItem(item).nameChain,
        `${formatItem(item)} doesn't have a valid name chain. Expected pattern is "${exampleNameChain}".`
      );
    }

    /**
     * This action pushes the active item(s) back to their name tree parents.
     * @param {function} toRunAfterSuccessInEditGroup Function to call after successful completion in same edit group,
     *                                                of type () -> void.
     * @returns {void}
     * @throws {AbortActionError} If a failure occurs
     */
    function _sendToNameTreeOrFail(toRunAfterSuccessInEditGroup = null) {
      const activeItems = getActiveItems().items;
      activeItems.forEach(validateItemIsLocalOrFail);
      activeItems.forEach(validateItemIsNameTreeOrFail);
      const nameTreesByChain = mapNameTreesByNameChains(getAllLocalNameTrees());

      // Calculate moves for active name tree items
      const isActiveItem = a => activeItems.some(b => b.getId() === a.getId());
      const nameTreeResult = analyseNameTrees(nameTreesByChain, always, isActiveItem);

      // Fail if analysis showed impossible moves
      const impossibleMoves = nameTreeResult.impossibleMoves;
      failIf(impossibleMoves.length > 0, impossibleMoves.join("\n"));

      // Perform the sends
      moveInEditGroupOrFail(nameTreeResult.requiredMoves, false, toRunAfterSuccessInEditGroup);
    }

    /**
     * This action pushes the active item(s) back to their name tree parents,
     * and marks them as complete.
     * @returns {void}
     * @throws {AbortActionError} If a failure occurs
     */
    function _sendToNameTreeAndClearDateAndCompleteOrFail() {
      const activeItems = getActiveItems().items;
      activeItems.forEach(datesModule.failIfMultipleDates);
      const toRunAfterSuccessInEditGroup = () => {
        for (const item of activeItems) {
          datesModule.clearFirstDateOnItem(item);
          if (!item.isCompleted()) {
            WF.completeItem(item);
          }
        }
      };
      _sendToNameTreeOrFail(toRunAfterSuccessInEditGroup);
    }

    /**
     * For use with a name tree list or sub-list.
     * For use when items in the name tree may have been moved to other locations
     * in the document outside of the root.
     * This action finds any (non-embedded) name tree items which are outside the
     * name tree list, and moves them back to the name tree list, at the top.
     * The active items are interpreted as the roots of the name trees.
     * @returns {void}
     * @throws {AbortActionError} If a failure occurs
     */
    function _reassembleNameTreeOrFail() {
      const activeItems = getActiveItems().items;
      activeItems.forEach(validateItemIsLocalOrFail);
      activeItems.forEach(validateItemIsNameTreeOrFail);
      const nameTreesByChain = mapNameTreesByNameChains(getAllLocalNameTrees());

      // Calculate moves for name tree items which are under target name chains
      const activeNameChains = activeItems.map(itemToNameChain);
      const isUnderTargetRoot = nameChain =>
        activeNameChains.some(activeNameChain => isNameChainAAncestorOfB(activeNameChain, nameChain));
      const nameTreeResult = analyseNameTrees(nameTreesByChain, isUnderTargetRoot, always);

      // Fail if analysis showed impossible moves
      const impossibleMoves = nameTreeResult.impossibleMoves;
      failIf(impossibleMoves.length > 0, impossibleMoves.join("\n"));

      // Perform the sends
      moveInEditGroupOrFail(nameTreeResult.requiredMoves, false);
    }

    const reassembleNameTree = () => callWithErrorHandling(_reassembleNameTreeOrFail);
    const sendToNameTree = () => callWithErrorHandling(_sendToNameTreeOrFail);
    const sendToNameTreeAndClearDateAndComplete = () =>
      callWithErrorHandling(_sendToNameTreeAndClearDateAndCompleteOrFail);

    return {
      itemToNameChain: itemToNameChain,
      plainAndRichNameOrNoteToNameChain: plainAndRichNameOrNoteToNameChain,
      simplifyNameTreeName: simplifyNameTreeName,
      reassembleNameTree: reassembleNameTree,
      sendToNameTree: sendToNameTree,
      sendToNameTreeAndClearDateAndComplete: sendToNameTreeAndClearDateAndComplete,
      validateAllNameTrees: validateAllNameTrees,
      nameChainToParent: nameChainToParent
    };
  })();

  /**
   * @param {function} callbackFn Function to call when the document is loaded,
   *                              of type () -> void.
   * @returns {void}
   * Notes:
   * - The function will be prevented from running if cleanUp() has been called.
   * Caveats:
   * - If multiple functions are passed to this method, the callbacks
   *   will be run in an undefined order.
   */
  function callAfterDocumentLoaded(callbackFn) {
    if (isCleanedUp) {
      console.debug("Not calling function, because cleanUp() already called.");
      return;
    }
    let isLoaded = false;
    let rootItem = null;
    const timeoutMs = 350;

    if (typeof WF !== "undefined" && WF !== null) {
      if (WF.rootItem !== undefined && WF.rootItem !== null) {
        try {
          rootItem = WF.rootItem();
        } catch (er) {
          // This is expected while waiting for the document to load
        }
        if (rootItem !== null) {
          isLoaded = true;
        }
      }
    }
    if (isLoaded) {
      console.log("Document now loaded. Calling function.");
      callbackFn();
    } else {
      console.log(`Document not yet loaded. Waiting for ${timeoutMs}ms.`);
      const repeat = () => callAfterDocumentLoaded(callbackFn);
      setTimeout(repeat, timeoutMs);
    }
  }

  /**
   * @param {Date} date The date to format
   * @returns {string} The given date as a string in YYYY-MM-DD format.
   */
  function dateToYMDString(date) {
    const as2DigitString = num => num.toString().padStart(2, "0");
    const yyyy = date.getFullYear().toString();
    const mm = as2DigitString(date.getMonth() + 1); // Months start at 0
    const dd = as2DigitString(date.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * @returns {string} Today's date as a string in YYYY-MM-DD format.
   */
  function todayAsYMDString() {
    return dateToYMDString(new Date());
  }

  /**
   * A developer utility method to help show time taken for an operation.
   * @param {Date} startDate The start date of the operation to measure.
   * @param {string} message The message to be displayed before the time delta.
   * @returns {void}
   */
  function logElapsedTime(startDate, message) {
    const end = new Date();
    const deltaMs = end.getTime() - startDate.getTime();
    console.log(`${message} (${deltaMs}ms)`);
  }

  /**
   * @param {KeyboardEvent} keyEvent The key event
   * @returns {string} The canonical code
   */
  function keyDownEventToCanonicalCode(keyEvent) {
    let canonicalCode = "";
    for (let flagAndCode of [
      [keyEvent.ctrlKey, "ctrl"],
      [keyEvent.shiftKey, "shift"],
      [keyEvent.altKey, "alt"],
      [keyEvent.metaKey, "meta"]
    ]) {
      if (flagAndCode[0]) {
        canonicalCode += flagAndCode[1] + "+";
      }
    }
    return canonicalCode + keyEvent.code;
  }

  function isValidCanonicalCode(canonicalCode) {
    const result = canonicalCode.match("^(ctrl\\+)?(shift\\+)?(alt\\+)?(meta\\+)?Key.$");
    return result !== null;
  }

  function validateKeyCode(canonicalCode) {
    if (!isValidCanonicalCode(canonicalCode)) {
      throw `${canonicalCode} is not a valid canonical key code`;
    }
  }

  const experimentalUiDecoratorsModule = (function() {
    class ItemElements {
      constructor(item, projectE, nameE, notesE, bulletE, itemMenuE) {
        this.item = item;
        this.projectE = projectE;
        this.nameE = nameE;
        this.notesE = notesE;
        this.bulletE = bulletE;
        this.itemMenuE = itemMenuE;
      }
    }

    /**
     * @param {Element | null} htmlElementOrNull The parent element, or null
     * @param {string} className The class name of the element to find
     * @returns {Element | null} The matching child, or null
     */
    function getFirstChildWithClassOrNull(htmlElementOrNull, className) {
      if (!htmlElementOrNull) {
        return null;
      }
      const matchingChildren = htmlElementOrNull.getElementsByClassName(className);
      return matchingChildren.length > 0 ? matchingChildren[0] : null;
    }

    /**
     * @param {Item} item The item
     * @returns {ItemElements} The item's useful (for us) elements as an ItemElements
     */
    function getItemElements(item) {
      const projectE = item.getElement();
      const nameE = getFirstChildWithClassOrNull(projectE, "name");
      const bulletE = getFirstChildWithClassOrNull(nameE, "bullet");
      const itemMenuE = getFirstChildWithClassOrNull(nameE, "itemMenu");
      const notesE = getFirstChildWithClassOrNull(projectE, "notes");
      return new ItemElements(item, projectE, nameE, notesE, bulletE, itemMenuE);
    }

    /**
     * @param {Element} drawOverElement The Element to draw over
     * @param {string} s The text to put on the "dot"
     * @returns {Element} The new element drawn over the top
     */
    function overlayGutterCodes(drawOverElement, s) {
      const styles = window.getComputedStyle(drawOverElement);
      const div = document.createElement("a");
      div.innerHTML = `<b>${s}</b>`;
      div.style.top = styles.top;
      div.style.left = styles.left;
      div.style.opacity = "1";
      div.style.setProperty("position", "absolute", "important");
      div.style.color = "black";
      div.style.background = "yellow";
      div.style.zIndex = "1";
      drawOverElement.parentElement.insertBefore(div, drawOverElement);
      return div;
    }

    /**
     * @param {Element} childElement The element to remove
     * @returns {void}
     */
    function removeElementFromParent(childElement) {
      if (childElement && childElement.parentElement) {
        childElement.parentElement.removeChild(childElement);
      }
    }

    function getVisibleItemsDepthFirst() {
      const visibleItems = [];
      /**
       * @param {Item} item The visible item
       * @returns {void}
       */
      function addVisibleRecursive(item) {
        if (item.getElement()) {
          // If non-visible due to being collapsed, Element will be null
          visibleItems.push(item);
          item.getVisibleChildren().forEach(addVisibleRecursive);
        }
      }
      addVisibleRecursive(WF.currentItem());
      return visibleItems;
    }

    const gutterCodesToItems = new Map();
    let allGutterElements = null;
    let keyMotionModeActive = false;

    function clearKeyMotionState() {
      gutterCodesToItems.clear();
      if (allGutterElements) {
        for (const dot of allGutterElements) {
          removeElementFromParent(dot);
        }
      }
      allGutterElements = null;
    }

    /**
     * @param {KeyboardEvent} keyEvent The key event
     * @returns {boolean} True if event handled here, false if still needs to be handled
     */
    function handleKeyEvent(keyEvent) {
      if (!keyMotionModeActive) {
        return false;
      }
      const canonicalCode = keyDownEventToCanonicalCode(keyEvent);
      const hasModifiers = keyEvent.ctrlKey || keyEvent.shiftKey || keyEvent.altKey || keyEvent.metaKey;
      const item = gutterCodesToItems.get(keyEvent.key);
      let exitKeyMotionMode = false;

      if (hasModifiers) {
        if (canonicalCode !== "ctrl+ControlLeft") { // Allow for setups where left control doubles as the escape key
          WF.showMessage("Unexpected modifier keys typed when in key motion mode: " + canonicalCode);
        }
      } else if (item) {
        exitKeyMotionMode = true;
        WF.editItemName(item);
      } else if (keyEvent.key === "Escape") {
        exitKeyMotionMode = true;
      } else {
        WF.showMessage("Unexpected key typed when in key motion mode: " + canonicalCode);
      }
      if (exitKeyMotionMode) {
        clearKeyMotionState();
        keyMotionModeActive = false;
      }
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
      return true;
    }

    // const ALPHABET_LETTERS_LOWER_CASE = Array.from("abcdefghijklmnopqrstuvwxyz");
    const KEY_MOTION_LETTERS = Array.from("fjdkghslarueitywoqpvbcnxmz");
    const DIGIT_NAMES = Array.from("0123456789");
    // const UPPER_CASE_LETTERS = Array.from(LOWER_CASE_LETTERS).map(c => c.toUpperCase);
    const KEY_MOTION_CHARACTERS = KEY_MOTION_LETTERS.concat(DIGIT_NAMES);

    function experimentalKeyMotion() {
      clearKeyMotionState();
      let index = 0;
      const gutterElements = [];
      for (const item of getVisibleItemsDepthFirst()) {
        const letterOrDigit = KEY_MOTION_CHARACTERS[index];
        const ie = getItemElements(item);
        const gutterElement = overlayGutterCodes(ie.bulletE || ie.itemMenuE, letterOrDigit);
        gutterElements.push(gutterElement);
        gutterCodesToItems.set(letterOrDigit, item);
        index = index + 1;
        if (index >= KEY_MOTION_CHARACTERS.length) {
          break;
        }
      }
      allGutterElements = gutterElements;
      keyMotionModeActive = true;
    }

    return {
      experimentalKeyMotion: experimentalKeyMotion,
      handleKeyEvent: handleKeyEvent,
      getItemElements: getItemElements,
      overlayGutterCodes: overlayGutterCodes,
      removeElementFromParent: removeElementFromParent
    };
  })();

  /**
   * @param {KeyboardEvent} keyEvent The key event
   * @returns {void}
   */
  function _keyDownListener(keyEvent) {
    const canonicalCode = keyDownEventToCanonicalCode(keyEvent);
    if (experimentalUiDecoratorsModule.handleKeyEvent(keyEvent)) {
      return; // Already handled
    }
    const registeredTarget = canonicalKeyCodesToTargets.get(canonicalCode);
    if (registeredTarget) {
      registeredTarget.go();
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  }

  /**
   * Prompts the user to choose an item from among the given array of items,
   * using a mix of choosing by index, or choosing by bookmark name, or by text.
   * Note: the behaviour of this method is expected to change.
   * Prefixes: "?" will force a re-prompt before returning the item.
   * Suffixes: "*" will force include bookmarks based on prefix matching, even
   *           if there's a full match.
   * @param {Array<Item>} items The array of items to choose from.
   * @param {string} promptMessage Optional message to prompt the user with.
   * @returns {Item} Returns the chosen item, or null if cancelled.
   */
  function promptToChooseItem(items, promptMessage) {
    // Build aliases
    const itemAliases = Array();
    for (let item of items) {
      const tagArgsText = itemToTagArgsText(bookmarkTag, item);
      const firstBmInConfig = itemIdsToFirstBookmarks.get(item.getId());
      let aliasToUse;
      if (tagArgsText && tagArgsText.trim()) {
        aliasToUse = tagArgsText;
      } else if (firstBmInConfig) {
        aliasToUse = firstBmInConfig;
      } else {
        aliasToUse = null;
      }
      itemAliases.push(aliasToUse);
    }

    let text = (promptMessage || "Choose from one of the following:") + "\n";
    for (let i = 0; i < items.length; i++) {
      const aliasPart = (itemAliases[i] && `[${itemAliases[i]}] `) || "";
      const namePart = itemToPlainTextName(items[i]) || "<No name>";
      text += i + ": " + aliasPart + namePart + "\n";
    }
    let answer = prompt(text);
    if (answer === null) {
      return;
    }
    answer = answer.trim();
    let rePromptFlag = false;
    const rePromptPrefix = "?";
    if (answer.startsWith(rePromptPrefix)) {
      rePromptFlag = true;
      answer = answer.substring(rePromptPrefix.length).trimLeft();
    }
    let includePrefixMatchesFlag = false;
    const includePrefixMatchesSuffix = "*";
    if (answer.endsWith(includePrefixMatchesSuffix)) {
      includePrefixMatchesFlag = true;
      answer = answer.slice(0, -includePrefixMatchesSuffix.length).trimRight();
    }
    if (answer === "") {
      return;
    }
    for (const [banned, suggestion] of bannedBookmarkSearchPrefixesToSuggestions.entries()) {
      if (answer.toLowerCase().startsWith(banned.toLowerCase())) {
        alert(`Bookmark searches starting with "${banned}" are banned. Suggestion: "${suggestion}".`);
        return;
      }
    }

    const answerAsInt = parseInt(answer);
    /** @type {Array<Item>} */
    const resultItems = Array();
    const answerLC = answer.toLowerCase();
    let hasPartialMatch = false;
    if (!isNaN(answerAsInt) && `${answerAsInt}` === answer) {
      // It's a number
      if (answerAsInt < 0 || answerAsInt >= items.length) {
        alert("Invalid choice: " + answer);
        return;
      } else if (includePrefixMatchesFlag || rePromptFlag) {
        alert(`Cannot combine a numeric answer (${answer}) with search flags.`);
      } else {
        resultItems.push(items[answerAsInt]);
      }
    }
    if (resultItems.length === 0) {
      // Match the full alias (ignoring case)
      for (let i = 0; i < items.length; i++) {
        const alias = itemAliases[i];
        if (alias && alias.toLowerCase() === answerLC) {
          resultItems.push(items[i]);
        }
      }
    }
    if (resultItems.length === 0 || includePrefixMatchesFlag) {
      // Match aliases which start with the string (ignoring case)
      for (let i = 0; i < items.length; i++) {
        if (resultItems.includes(items[i])) {
          // Don't re-add full matches
          continue;
        }
        const alias = itemAliases[i];
        if (alias && alias.toLowerCase().startsWith(answerLC)) {
          resultItems.push(items[i]);
          hasPartialMatch = true;
        }
      }
    }
    if (resultItems.length === 0) {
      // Match items which contains the full string in the name (ignoring case)
      for (let item of items) {
        const plainTextNameLC = itemToPlainTextName(item).toLowerCase();
        if (plainTextNameLC.includes(answerLC)) {
          resultItems.push(item);
          hasPartialMatch = true;
        }
      }
    }
    const needsPrompt = rePromptFlag || includePrefixMatchesFlag || hasPartialMatch;
    if (resultItems.length > 1 || (resultItems.length === 1 && needsPrompt)) {
      // Choose again amongst only the matches
      return promptToChooseItem(resultItems, promptMessage);
    } else if (resultItems.length === 1) {
      return resultItems[0];
    } else {
      if (confirm(`No matches for "${answer}". Try again or cancel.`)) {
        return promptToChooseItem(items, promptMessage);
      }
    }
  }

  /**
   * @param {Item} item The item to follow.
   * @returns {void}
   * @see itemToTarget
   */
  function followItem(item) {
    const target = itemToTarget(item);
    if (target) {
      target.go();
    }
  }

  /**
   * Calls followItem on the currently zoomed item.
   * @see followItem
   * @returns {void}
   */
  function followZoomedItem() {
    const zoomedItem = getZoomedItem();
    followItem(zoomedItem);
  }

  /**
   * Finds and opens the first (if any) http/https link in the focused item.
   * @returns {void}
   */
  function openFirstLinkInFocusedItem() {
    const focusedItem = WF.focusedItem();
    if (focusedItem === null || isRootItem(focusedItem)) {
      return;
    }
    for (let nameOrNote of [itemToPlainTextName(focusedItem), itemToPlainTextNote(focusedItem)]) {
      const matchResult = nameOrNote.match(/https?:\/\/[^\s]+/);
      if (matchResult) {
        const url = matchResult[0].trim();
        if (isWorkFlowyUrl(url)) {
          openHere(url);
        } else {
          openInNewTab(url);
        }
      }
    }
  }

  /**
   * Returns a target which will 'follow' the given item,
   * performing some action depending on the content of the item.
   * Note: the behaviour of this method is expected to change.
   * @param {Item} item The item to follow.
   * @returns {Target} A target which 'follows' the item.
   */
  function itemToTarget(item) {
    if (!item) {
      return new FunctionTarget("no-op", () => {}); // Return a no-op;
    }
    for (let nameOrNote of [itemToPlainTextName(item), itemToPlainTextNote(item)]) {
      let target = textToTarget(nameOrNote);
      if (target) {
        return target;
      }
    }

    // Otherwise, return a target which goes directly to the item itself
    return new ItemTarget(item, null);
  }

  /**
   * Returns a Target for the given text, or null.
   * The text can be a WorkFlowy URL, or the name of a built-in function,
   * or a bookmarklet.
   * @param {string} text The URL, or function name.
   * @returns {Target} The target, including a no-arg function, or null.
   */
  function textToTarget(text) {
    const trimmed = (text || "").trim();
    let target;
    if (isWorkFlowyUrl(trimmed)) {
      const [item, searchQuery] = findItemAndSearchQueryForWorkFlowyUrl(trimmed);
      if (item) {
        target = new ItemTarget(item, searchQuery);
      } else {
        console.log(`Couldn't find WorkFlowy item for URL: ${trimmed}`);
        target = null;
      }
    } else if (builtInFunctionTargetsByName.has(trimmed)) {
      target = builtInFunctionTargetsByName.get(trimmed);
    } else if (trimmed.startsWith("javascript:")) {
      const bookmarkletBody = trimmed.substring("javascript:".length);
      target = new JavaScriptTarget(bookmarkletBody, bookmarkletBody);
    } else {
      console.log(`Not clear what type of target to build for "${text}".`);
      target = null;
    }
    return target;
  }

  class Target {
    /**
     * @param {'item' | 'builtInFunction' | 'bookmarklet'} type Target type.
     * @param {string} id The full name of the target.
     * @param {string} description A description of the target.
     * @param {function} defaultFunction The default function for the target.
     */
    constructor(type, id, description, defaultFunction) {
      this.id = id;
      this.type = type;
      this.description = description;
      this.defaultFunction = defaultFunction;
      const context = `Building target ${description}`;
      _validateNoArgsFunction(defaultFunction, context, true, true);
    }

    go() {
      this.defaultFunction();
    }

    toString() {
      return `${this.id} (${this.description})`;
    }
  }

  class FunctionTarget extends Target {
    /**
     * @param {string} functionName The name of the function.
     * @param {function} defaultFunction The default function for the target.
     */
    constructor(functionName, defaultFunction) {
      super("builtInFunction", "function:" + functionName, `Built-in function ${functionName}`, defaultFunction);
    }
  }

  class JavaScriptTarget extends Target {
    /**
     * @param {string} scriptName The name of the script.
     * @param {string} javascriptCode The raw JavaScript code.
     */
    constructor(scriptName, javascriptCode) {
      const fn = () => eval(javascriptCode);
      super("bookmarklet", `script:${scriptName}`, `Script ${scriptName}`, fn);
    }
  }

  class ItemTarget extends Target {
    /**
     * @param {Item} item The WorkFlowy Item to zoom to.
     * @param {string} searchQuery The (optional) search query string.
     */
    constructor(item, searchQuery) {
      if (!item) {
        throw "Item must be specified";
      }
      let id = `item:${item.getId()}`;
      let description = `Zoom to "${item.getNameInPlainText()}"`;
      if (searchQuery) {
        id += `; Search: "${searchQuery}"`;
        description += `. Search: "${searchQuery}"`;
      }
      let zoomToItemFn = () => zoomToAndSearch(item, searchQuery);
      super("item", id, description, zoomToItemFn);
      this.item = item;
      this.searchQuery = searchQuery;
    }
  }

  /**
   * Deletes the focused item if and only if it has no children.
   * @returns {void}
   */
  function deleteFocusedItemIfNoChildren() {
    const item = WF.focusedItem();
    if (item && !isRootItem(item) && item.getChildren().length === 0) {
      WF.deleteItem(item);
    }
  }

  /**
   * @returns {Map<string, Item>} All bookmarked items, by bookmark name.
   */
  function getAllBookmarkedItemsByBookmark() {
    /** @type Map<string, Item> */
    const allBookmarkedItemsByBookmark = new Map();
    const globalItemsWithBookmark = findItemsWithTag(bookmarkTag, WF.rootItem());
    for (const item of globalItemsWithBookmark) {
      const bookmark = itemToTagArgsText(bookmarkTag, item);
      if (bookmark) {
        allBookmarkedItemsByBookmark.set(bookmark, item);
      }
    }
    for (const [bookmark, itemTarget] of bookmarksToItemTargets.entries()) {
      allBookmarkedItemsByBookmark.set(bookmark, itemTarget.item);
    }
    return allBookmarkedItemsByBookmark;
  }

  /**
   * Prompts the user to choose from the bookmarked items, then follows
   * the chosen item.
   * Note: the behaviour of this method is expected to change.
   * @returns {void}
   * @see followItem
   */
  function promptToFindGlobalBookmarkThenFollow() {
    const chosenItem = promptToChooseBookmark("Choose a bookmark to go to:");
    followItem(chosenItem);
  }

  /**
   * Prompts the user to choose from the bookmarked items, then returns
   * the chosen item.
   * Note: the behaviour of this method is expected to change.
   * @param {string} promptMessage The prompt message to display to the user.
   * @returns {Item} Returns the chosen item, or null if cancelled.
   */
  function promptToChooseBookmark(promptMessage) {
    const startTime = new Date();
    const itemsWithBmTag = findItemsWithTag(bookmarkTag, WF.rootItem());
    const itemTargetsFromConfig = Array.from(bookmarksToItemTargets.values());
    const itemsFromConfig = itemTargetsFromConfig.map(t => t.item);
    const items = [...itemsFromConfig, ...itemsWithBmTag];
    logElapsedTime(startTime, `Found items with ${bookmarkTag} tag`);
    return promptToChooseItem(items, promptMessage);
  }

  /**
   * @param {Item} item The item to format as a string.
   * @returns {string} A string representation of the item.
   */
  function formatItem(item) {
    if (item) {
      return `"${item.getNameInPlainText()}"`;
    } else {
      return "<no item>";
    }
  }

  /**
   * The active item(s) are the selected items if any, otherwise the
   * focused item if any, otherwise the currently zoomed item.
   */
  class ActiveItems {
    /**
     * @param {Array<Item>} items The selected/focused/current item(s).
     * @param {"selection" | "focused" | "zoomed"} type The type of active item.
     */
    constructor(items, type) {
      this.items = items;
      this.type = type;
    }

    toString() {
      switch (this.type) {
        case "selection":
          return this.items.length === 1
            ? `selected item ${formatItem(this.items[0])}`
            : `selected ${this.items.length} items`;
        case "focused":
          return `focused item ${formatItem(this.items[0])}`;
        case "zoomed":
          return `zoomed item ${formatItem(this.items[0])}`;
      }
    }
  }

  /**
   * The active item(s) are the selected items if any, otherwise the
   * focused item if any, otherwise the currently zoomed item.
   * @returns {ActiveItems} The active items.
   */
  function getActiveItems() {
    const selection = WF.getSelection();
    const focusedItem = WF.focusedItem();
    const currentItem = WF.currentItem();

    if (selection.length > 0) {
      return new ActiveItems(selection, "selection");
    } else if (focusedItem) {
      return new ActiveItems([focusedItem], "focused");
    } else {
      return new ActiveItems([currentItem], "zoomed");
    }
  }

  /**
   * Prompts to choose a bookmark name, then moves the active item(s)
   * to the top of it.
   * The active item(s) are the selected items if any, otherwise the
   * focused item if any, otherwise the currently zoomed item.
   * Following the move of a focused item, as long as it's not the currently
   * zoomed item, it will then focus the next sibling of the moved item.
   * @returns {void}
   */
  function moveToBookmark() {
    const currentItem = WF.currentItem();

    let itemToFocusAfterwards = null;
    const activeItems = getActiveItems();
    let itemsToMove = activeItems.items;
    let formattedItems = activeItems.toString();

    if (activeItems.type === "focused") {
      if (itemsToMove[0].getId() !== currentItem.getId()) {
        itemToFocusAfterwards = itemsToMove[0].getNextVisibleSibling();
      }
    }

    const targetItem = promptToChooseBookmark(`Move ${formattedItems} to:`);
    if (!targetItem) {
      return; // User cancelled, nothing to do
    }

    const formattedTarget = `${formatItem(targetItem)}`;
    for (let itemToMove of itemsToMove) {
      if (!isSafeToMoveItemToTarget(itemToMove, targetItem)) {
        WF.showMessage(
          `Not moving ${formattedItems}, because not safe to move 
          ${formatItem(itemToMove)} to ${formattedTarget}.`,
          true
        );
        return;
      }
    }
    WF.moveItems(itemsToMove, targetItem, 0);
    WF.showMessage(`Moved to: ${formattedTarget}.`);
    if (itemToFocusAfterwards) {
      WF.editItemName(itemToFocusAfterwards);
    }
  }

  /**
   * @deprecated Use addBookmark instead.
   * @returns {void}
   */
  function promptToAddBookmarkForCurrentItem() {
    addBookmark();
  }

  /**
   * Prompts user for bookmark name, using it to bookmark the active item.
   * The active item is the selected item if any, otherwise the
   * focused item if any, otherwise the currently zoomed item.
   * When using the currently zoomed item, the search query is also considered.
   * @returns {void}
   */
  function addBookmark() {
    const activeItems = getActiveItems();
    if (activeItems.items.length !== 1) {
      WF.showMessage("Can only bookmark 1 item at a time.");
      return;
    }
    const targetItem = activeItems.items[0];
    const targetQuery = targetItem.getId() === WF.currentItem().getId() ? WF.currentSearchQuery() : null;
    const formattedTarget = activeItems.toString();
    let bookmarkName = prompt(`Choose bookmark name for ${formattedTarget}:`);
    if (bookmarkName === null || !bookmarkName.trim()) {
      return;
    }
    bookmarkName = bookmarkName.trim();
    let shouldCreate = false;
    let existingSourceItem = bookmarksToSourceItems.get(bookmarkName);
    if (existingSourceItem || bookmarksToItemTargets.has(bookmarkName)) {
      const existingItemTarget = bookmarksToItemTargets.get(bookmarkName);
      const formattedExistingTarget = existingItemTarget
        ? formatItem(existingItemTarget.item)
        : "<invalid or deleted item>";
      if (
        existingItemTarget &&
        existingItemTarget.item.getId() === targetItem.getId() &&
        existingItemTarget.searchQuery === targetQuery
      ) {
        // Nothing to do: there's an existing bookmark pointing to the target
        WF.showMessage(`No action required: Bookmark "${bookmarkName}" already points to ${formattedTarget}.`);
      } else if (existingSourceItem) {
        shouldCreate = confirm(`Update existing bookmark "${bookmarkName}", pointing to ${formattedExistingTarget}?`);
      } else {
        WF.showMessage(
          `Failed: Bookmark "${bookmarkName} is already specified via a tag, pointing to target item ${formattedExistingTarget}.`
        );
      }
    } else {
      shouldCreate = true; // No existing bookmark
    }
    if (shouldCreate) {
      if (configurationRootItem) {
        const bookmarksSectionItem = findConfigurationSection(CONFIG_SECTION_BOOKMARKS);
        if (bookmarksSectionItem) {
          WF.editGroup(() => {
            var newBookmarkItem = existingSourceItem ? existingSourceItem : WF.createItem(bookmarksSectionItem, 0);
            // Workaround: coerce return value of createItem to correct type
            if (typeof newBookmarkItem.projectid === "string") {
              newBookmarkItem = WF.getItemById(newBookmarkItem.projectid);
            }
            if (newBookmarkItem) {
              WF.setItemName(newBookmarkItem, bookmarkName);
              const prodUrl = itemAndSearchToWorkFlowyUrl("prod", targetItem, targetQuery);
              WF.setItemNote(newBookmarkItem, prodUrl);
              WF.showMessage(`Bookmark "${bookmarkName}" now points to ${formattedTarget}.`);
            } else {
              WF.showMessage("Failed to create or update new bookmark. Check the console log.");
            }
          });
        } else {
          WF.showMessage(
            `No "${CONFIG_SECTION_BOOKMARKS}" configuration section found under` +
              `${itemAndSearchToWorkFlowyUrl("current", configurationRootItem, null)}.`
          );
        }
      } else {
        WF.showMessage("Configuration root item not found. " + `Are you missing a "${CONFIGURATION_ROOT_NAME}" item?`);
      }
    }
  }

  /**
   * Finds descendants (inclusive) of the active items,
   * which include instructions to scatter to some other bookmarked item
   * (e.g. "#scatter(today_pm)" to move to an item bookmarked as "today_pm"),
   * and moves those items to those bookmarks.
   * @return {void}
   */
  function _scatterDescendantsOfActiveItemsOrFail() {
    const activeItems = getActiveItems().items;
    activeItems.forEach(validateItemIsLocalOrFail);
    const allBookmarkedItemsByBookmark = getAllBookmarkedItemsByBookmark();

    const itemsWithScatterTag = [];
    const ids = [];
    for (const activeItem of activeItems) {
      for (const itemWithTag of findItemsWithTag(SCATTER_TAG, activeItem)) {
        const id = itemWithTag.getId();
        if (ids.includes(id)) continue; // Already processed this item
        ids.push(id);
        itemsWithScatterTag.push(itemWithTag);
      }
    }

    const itemMoves = [];
    for (const item of itemsWithScatterTag) {
      const bookmark = itemToTagArgsText(SCATTER_TAG, item);
      const recommendation = `Should be ${SCATTER_TAG}(<target-bookmark>)`;
      failIf(!bookmark, `Item ${formatItem(item)} had a ${SCATTER_TAG} tag but with no argument. ${recommendation}`);
      const targetItem = allBookmarkedItemsByBookmark.get(bookmark);
      failIf(!targetItem, `No bookmark found for ${SCATTER_TAG} target bookmark "${bookmark}".`);
      if (item.getParent().getId() !== targetItem.getId()) {
        itemMoves.push(new ItemMove(item, targetItem));
      }
    }
    const errorMessage = validateMoves(itemMoves);
    failIf(!!errorMessage, errorMessage);
    moveInEditGroupOrFail(itemMoves, false);
  }

  const scatterDescendants = () => callWithErrorHandling(_scatterDescendantsOfActiveItemsOrFail);

  /**
   * Finds descendants (inclusive) of the active items, which include instructions to schedule to some day
   * (e.g. "#scheduleFor(tuesday)" to add a date for Tuesday), relative to some given reference date as "today",
   * and sets those dates on those items.
   * @return {void}
   */
  function _scheduleDescendantsOfActiveItemsOrFail() {
    const activeItems = getActiveItems().items;
    activeItems.forEach(validateItemIsLocalOrFail);

    const actualToday = new Date();
    const givenReferenceDayString = prompt('Which day to use as the "today" reference point for interpreting dates?');
    if (!givenReferenceDayString) {
      return;
    }
    const [refDateInterpretation, refDateErrorMsg] = datesModule.interpretDate(givenReferenceDayString, actualToday);
    failIf(!!refDateErrorMsg, refDateErrorMsg);
    const referenceDate = refDateInterpretation.date;

    const itemsWithScheduleTag = [];
    const ids = [];
    for (const activeItem of activeItems) {
      for (const itemWithTag of findItemsWithTag(SCHEDULE_TAG, activeItem)) {
        const id = itemWithTag.getId();
        if (ids.includes(id)) continue; // Already processed this item
        ids.push(id);
        itemsWithScheduleTag.push(itemWithTag);
      }
    }

    /** @type Array<[Item, DateEntry]> */
    const itemsAndDateEntries = [];
    for (const item of itemsWithScheduleTag) {
      const targetDateString = itemToTagArgsText(SCHEDULE_TAG, item);
      const suffix = `Should be ${SCHEDULE_TAG}(<target-date>)`;
      failIf(!targetDateString, `Item ${formatItem(item)} had a ${SCHEDULE_TAG} tag but with no argument. ${suffix}`);
      const [targetDateInterpretation, targetDateErrorMsg] = datesModule.interpretDate(targetDateString, referenceDate);
      failIf(!!targetDateErrorMsg, targetDateErrorMsg);
      const targetDateEntry = datesModule.dateToDateEntry(targetDateInterpretation.date);
      itemsAndDateEntries.push([item, targetDateEntry]);
    }

    WF.editGroup(() => {
      for (const [item, dateEntry] of itemsAndDateEntries) {
        datesModule.setFirstDateOnItem(item, dateEntry);
      }
    });
  }

  const scheduleDescendants = () => callWithErrorHandling(_scheduleDescendantsOfActiveItemsOrFail);

  function blurFocusedContent() {
    window.blurFocusedContent();
  }

  /**
   * Effectively a combination of the updateDate and moveToBookmark actions.
   * @returns {void}
   */
  function combinationUpdateDateThenMoveToBookmark() {
    // Call with error handling, such that a failure of the update date step fails fast
    callWithErrorHandling(() => {
      datesModule._updateDateOnActiveItemsOrFail();
      moveToBookmark();
    });
  }

  /**
   * Logs some very basic info about the current document to the console,
   * showing an alert if any tests fail.
   * @returns {void}
   */
  function logShortReport() {
    const rootItem = WF.rootItem();

    let text = "WorkFlowy report:\n";
    let hasFailed = false;
    let currentTest = null;

    function add(message) {
      text += message + "\n";
    }

    function pass(message) {
      add("[PASS] (" + currentTest + "): " + message);
    }

    /*
    function fail(message) {
      add("[FAIL] (" + currentTest + "): " + message);
      hasFailed = true;
    }
    */

    currentTest = "Count items";
    let totalItems = 0;
    let localItems = 0;
    applyToEachItem(item => {
      totalItems++;
      if (!item.isEmbedded()) {
        localItems++;
      }
    }, rootItem);
    pass(`Total items: ${totalItems}. Local items: ${localItems}`);

    console.log(text);
    if (hasFailed) {
      alert(text);
    }
  }

  /**
   * Shows both the current item and the most recently edited item.
   * @returns {void}
   */
  function showZoomedAndMostRecentlyEdited() {
    const recentItem = findRecentlyEditedItems(0, 1, WF.rootItem())[0];
    const zoomedItem = getZoomedItem();
    const newZoom = findClosestCommonAncestor(recentItem, zoomedItem);
    const searchQuery = itemsToVolatileSearchQuery([recentItem, zoomedItem]);
    zoomToAndSearch(newZoom, searchQuery);
  }

  /**
   * Moves the cursor to the name of the current item.
   * @returns {void}
   */
  function editCurrentItem() {
    const currentItem = WF.currentItem();
    if (!isRootItem(currentItem)) {
      WF.editItemName(currentItem);
    }
  }

  /**
   * Finds the focused item (using the current item as fallback),
   * and puts the cursor in the name of that item's parent.
   * @returns {void}
   */
  function editParentOfFocusedItem() {
    const focusedItem = WF.focusedItem() || WF.currentItem();
    if (focusedItem === null || isRootItem(focusedItem)) {
      return;
    }
    const parentItem = focusedItem.getParent();
    if (focusedItem.getId() === WF.currentItem().getId()) {
      // Zoom out one level
      WF.zoomTo(parentItem);
    }
    if (!isRootItem(parentItem)) {
      WF.editItemName(parentItem);
    }
  }

  /**
   * Escapes all HTML characters in the text.
   * @param {string} text The text to escape.
   * @returns {string} The escaped text.
   */
  function escapeHtmlCharacters(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Action which creates an ordinary link below the current single focused
   * or selected item.
   * @returns {void}
   */
  function createOrdinaryLink() {
    const activeItems = getActiveItems();
    if (activeItems.type !== "selection" && activeItems.type !== "focused") {
      WF.showMessage("Select or focus an item first.");
      return;
    }
    if (activeItems.items.length !== 1) {
      WF.showMessage("Select or focus exactly 1 item first.");
      return;
    }
    const targetItem = activeItems.items[0];
    if (targetItem.getId() === WF.currentItem().getId()) {
      WF.showMessage("Can't create a link for the zoomed item. Zoom up first.");
      return;
    }
    // The link's name is based on the target's name, but with neutered tags
    const linkName =
      "#link: " +
      targetItem
        .getNameInPlainText()
        .replace(/@/g, "@\\")
        .replace(/#/g, "#\\");
    const targetUrl = itemAndSearchToWorkFlowyUrl("prod", targetItem, null);

    let linkItem;
    WF.editGroup(() => {
      linkItem = WF.createItem(targetItem.getParent(), targetItem.getPriority() + 1);
      WF.setItemName(linkItem, escapeHtmlCharacters(linkName));
      WF.setItemNote(linkItem, targetUrl);
    });
    // Note: without the timeout, the selection is not set correctly
    setTimeout(() => WF.setSelection([linkItem]), 0);
  }

  /**
   * @returns {string} The expanded form of the given abbreviation, or null if
   *                   no such expansion is found. Gives preference to user
   *                   defined #abbrev(theAbbrev theExpansion) expansions,
   *                   falling back to the built-in expansions.
   * @param {string} abbreviation The abbreviation to expand.
   */
  function expandAbbreviation(abbreviation) {
    if (abbreviation === null || abbreviation === "") {
      return null;
    }
    if (abbreviation !== abbreviation.trim()) {
      expandAbbreviation(abbreviation.trim());
    }

    const allExpansions = new Map([...builtInExpansionsMap, ...customExpansions]);

    const fnOrValue = allExpansions.get(abbreviation);
    if (!fnOrValue) {
      return null;
    }
    if (typeof fnOrValue === "function") {
      const expansion = fnOrValue();
      if (!expansion) {
        console.log(`Function ${fnOrValue.name} returned ${typeof expansion}`);
      }
      return expansion;
    } else {
      return fnOrValue;
    }
  }

  /**
   * Prompts the user to enter an abbreviation, then expands it
   * and inserts the expanded text at the current edit position.
   * @see expandAbbreviation
   * @returns {void}
   */
  function promptToExpandAndInsertAtCursor() {
    const abbreviation = prompt("Type abbreviation:", "ymd");
    if (!abbreviation) {
      return;
    }
    const expansion = expandAbbreviation(abbreviation);
    if (!expansion) {
      alert(`No expansion found for ${abbreviation}`);
    } else if (typeof expansion === "string") {
      WF.insertText(expansion);
    } else {
      alert(`Invalid type of expansion: ${typeof expansion}.`);
    }
  }

  /**
   * DEPRECATED.
   * @returns {Map} The user defined #abbrev(theAbbrev theExpansion)
   *                style expansions as a Map, by abbreviation.
   *                The Map type is string -> (function | string)
   */
  function _buildCustomAbbreviationsMap() {
    const abbreviationsMap = new Map();
    for (let item of findItemsWithTag(abbrevTag, WF.rootItem())) {
      const argsText = itemToTagArgsText(abbrevTag, item);
      if (!argsText) {
        continue;
      }
      const matchResult = argsText.match("^([^ ]+) +([^ ]+.*)");
      if (matchResult) {
        const abbrev = matchResult[1];
        const expansion = matchResult[2];
        if (abbreviationsMap.has(abbrev)) {
          console.log(`Found multiple ${abbrevTag} definitions for ${abbrev}`);
        }
        abbreviationsMap.set(abbrev, expansion);
      } else {
        console.log(`Invalid ${abbrevTag} arguments: ${argsText}.`);
      }
    }
    return abbreviationsMap;
  }

  /**
   * Validates then adds the given expansion into builtInExpansionsMap.
   * @param {string} abbreviation The abbreviation.
   * @param {function|string} functionOrValue The expansion. Either a string, or
   *   a function of type () -> string.
   * @returns {void}
   */
  function _registerBuiltInExpansion(abbreviation, functionOrValue) {
    if (!abbreviation) {
      throw "abbreviation was missing";
    }
    if (typeof functionOrValue === "function") {
      const fn = functionOrValue;
      // Validate the function as being of type () -> string
      if (fn.length !== 0) {
        throw "Can only register text functions which take no arguments";
      }
      const result = fn();
      const type = typeof result;
      if (type !== "string") {
        throw `${fn.name} returned type '${type}' when expecting a string.`;
      }
    } else if (typeof functionOrValue !== "string") {
      const type = typeof functionOrValue;
      throw `Unsupported type of expansion for ${abbreviation}: ${type}`;
    }
    builtInExpansionsMap.set(abbreviation, functionOrValue);
  }

  /**
   * @returns {Map<string,Target>} A map of key codes to targets.
   */
  function _loadKbShortcutsFromTagsToFunctionMap() {
    const rMap = new Map();
    // From tags
    for (let item of findItemsWithTag(shortcutTag, WF.rootItem())) {
      const keyCode = itemToTagArgsText(shortcutTag, item);
      if (!keyCode) {
        continue;
      }
      if (isValidCanonicalCode(keyCode)) {
        const target = itemToTarget(item);
        validateKeyCode(keyCode);
        rMap.set(keyCode, target);
      } else {
        console.log(`WARN: Invalid keyboard shortcut code: '${keyCode}'.`);
      }
    }
    return rMap;
  }

  /**
   * Reads shortcuts from the given configuration, converting them to
   * a map of key codes to targets.
   * @param {Map<string,string>} shortcutsMap Shortcuts from configuration.
   * @returns {Map<string,Target>} A map of key codes to targets.
   */
  function _convertKbShortcutsConfigToTargetMap(shortcutsMap) {
    const rMap = new Map();
    for (let keyCode of shortcutsMap.keys()) {
      const targetText = shortcutsMap.get(keyCode);
      if (isValidCanonicalCode(keyCode)) {
        const target = textToTarget(targetText);
        if (target) {
          validateKeyCode(keyCode);
          rMap.set(keyCode, target);
        } else {
          WF.showMessage(`"${targetText}" is not a valid target.`);
        }
      } else {
        WF.showMessage(`WARN: Invalid keyboard shortcut code: '${keyCode}'.`, false);
      }
    }
    return rMap;
  }

  /**
   * Checks whether the given argument is a no-args function.
   * @param {function} fn The function to validate.
   * @param {string} context Context description for use in error messages.
   * @param {boolean} warnIfInvalid Whether to warn problems to the console.
   * @param {boolean} failIfInvalid Whether to throw errors for problems.
   * @returns {boolean} True if the given function is valid, false otherwise.
   */
  function _validateNoArgsFunction(fn, context, warnIfInvalid, failIfInvalid) {
    let reasonWhyInvalid = "";
    if (typeof fn !== "function") {
      reasonWhyInvalid = "Not a function: " + fn;
    } else if (fn.length !== 0) {
      reasonWhyInvalid = "Function takes more that zero arguments: " + fn;
    }
    if (reasonWhyInvalid) {
      reasonWhyInvalid += " Context: " + context;
      if (warnIfInvalid) {
        console.warn(reasonWhyInvalid);
      }
      if (failIfInvalid) {
        throw reasonWhyInvalid;
      }
      return false;
    } else {
      return true;
    }
  }

  /**
   * @param {Map<string, FunctionTarget>} map Map to populate.
   * @param {Array<function>} functionsArray The array of functions.
   * @returns {void}
   */
  function _appendAllToFunctionTargetsMap(map, functionsArray) {
    for (let f of functionsArray) {
      const target = _functionToTargetUsingFunctionName(f);
      if (target) {
        map.set(f.name, target);
      }
    }
  }

  /**
   * @param {function} f The function to create a FunctionTarget for.
   * @returns {FunctionTarget} The target, or null if the function is invalid.
   */
  function _functionToTargetUsingFunctionName(f) {
    const context = `Converting function ${f} to a FunctionTarget`;
    if (_validateNoArgsFunction(f, context, true, false)) {
      const functionName = f.name;
      return new FunctionTarget(functionName, f);
    } else {
      return null;
    }
  }

  /**
   * Cleans up global state maintained by this script.
   * Ok to call multiple times, but subsequent calls have no effect.
   * @returns {void}
   */
  function cleanUp() {
    if (isCleanedUp) {
      return;
    }
    console.log("Cleaning up");

    if (isDevDomain || isBetaDomain) {
      window.open = originalWindowOpenFn;
      console.log("Restored original window.open function");
    }

    // Keyboard shortcuts
    document.removeEventListener("keydown", _keyDownListener);
    kbShortcutsFromTags.clear();
    builtInFunctionTargetsByName.clear();

    // Built-in expansions
    builtInExpansionsMap.clear();
    abbrevsFromTags.clear();

    // Configuration
    cleanConfiguration();
    configurationRootItem = null;

    // Other global state
    lastRegexString = null;

    window.WFEventListener = null;

    isCleanedUp = true;
  }

  /**
   * Sets up global state maintained by this script.
   * @returns {void}
   */
  function setUp() {
    callAfterDocumentLoaded(() => {
      if (isCleanedUp) {
        return;
      }

      // Keyboard shortcuts
      builtInFunctionTargetsByName.clear();
      _appendAllToFunctionTargetsMap(builtInFunctionTargetsByName, [
        // Alphabetical order
        // *******************************************************
        // Maintenance note: keep this list in sync with README.md
        // vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
        experimentalUiDecoratorsModule.experimentalKeyMotion,
        // ^^^ Experimental actions
        addBookmark,
        blurFocusedContent,
        combinationUpdateDateThenMoveToBookmark,
        createItemAtTopOfCurrent,
        createOrdinaryLink,
        datesModule.clearDate,
        datesModule.promptToFindByDateRange,
        datesModule.updateDate,
        deleteFocusedItemIfNoChildren,
        dismissNotification,
        editCurrentItem,
        editParentOfFocusedItem,
        logShortReport,
        markFocusedAndDescendantsNotComplete,
        moveToBookmark,
        nameTreeModule.reassembleNameTree,
        nameTreeModule.sendToNameTree,
        nameTreeModule.sendToNameTreeAndClearDateAndComplete,
        openFirstLinkInFocusedItem,
        promptToExpandAndInsertAtCursor,
        promptToAddBookmarkForCurrentItem, // Deprecated
        promptToFindGlobalBookmarkThenFollow,
        promptToFindLocalRegexMatchThenZoom,
        promptToNormalLocalSearch,
        promptToFindByLastChanged,
        scatterDescendants,
        scheduleDescendants,
        showZoomedAndMostRecentlyEdited
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // *******************************************************
      ]);
      kbShortcutsFromTags = _loadKbShortcutsFromTagsToFunctionMap();
      document.addEventListener("keydown", _keyDownListener);

      // Built-in expansions
      _registerBuiltInExpansion("ymd", todayAsYMDString);
      abbrevsFromTags = _buildCustomAbbreviationsMap();

      if (isDevDomain || isBetaDomain) {
        window.open = _openWithoutChangingWfDomain;
        console.log("Overrode window.open function because on dev/beta domain");
      }

      window.WFEventListener = wfEventListener;
      reloadConfiguration();

      // Warn for any deprecated configuration
      const deprecationMessages = [];
      const deprecatedAbbrevItems = findItemsWithTag(abbrevTag, WF.rootItem());
      if (deprecatedAbbrevItems.length > 0) {
        deprecationMessages.push(
          `Found ${deprecatedAbbrevItems.length} ${abbrevTag} items. ` +
            `The ${abbrevTag} tag is deprecated. Instead, define expansions ` +
            `in ${CONFIGURATION_ROOT_NAME} -> ${CONFIG_SECTION_EXPANSIONS}.`
        );
      }
      if (deprecationMessages.length > 0) {
        WF.showMessage(deprecationMessages.join("<br>"));
      }
    });
  }

  setUp();

  // Create jumpflowy object and make it available at 'jumpflowy' in the window
  self.jumpflowy = {
    nameTree: nameTreeModule,
    dates: datesModule,
    experimentalUiDecorators: experimentalUiDecoratorsModule,
    // Functions by alphabetical order
    addBookmark: addBookmark,
    applyToEachItem: applyToEachItem,
    blurFocusedContent: blurFocusedContent,
    callAfterDocumentLoaded: callAfterDocumentLoaded,
    cleanUp: cleanUp,
    combinationUpdateDateThenMoveToBookmark: combinationUpdateDateThenMoveToBookmark,
    createItemAtTopOfCurrent: createItemAtTopOfCurrent,
    createOrdinaryLink: createOrdinaryLink,
    dateToYMDString: dateToYMDString,
    deleteFocusedItemIfNoChildren: deleteFocusedItemIfNoChildren,
    dismissNotification: dismissNotification,
    doesItemHaveTag: doesItemHaveTag,
    doesItemNameOrNoteMatch: doesItemNameOrNoteMatch,
    doesStringHaveTag: doesStringHaveTag,
    editCurrentItem: editCurrentItem,
    editParentOfFocusedItem: editParentOfFocusedItem,
    expandAbbreviation: expandAbbreviation,
    filterMapByKeys: filterMapByKeys,
    filterMapByValues: filterMapByValues,
    findClosestCommonAncestor: findClosestCommonAncestor,
    findItemsMatchingRegex: findItemsMatchingRegex,
    findItemsWithSameText: findItemsWithSameText,
    findItemsWithTag: findItemsWithTag,
    findMatchingItems: findMatchingItems,
    findRecentlyEditedItems: findRecentlyEditedItems,
    findTopItemsByComparator: findTopItemsByComparator,
    findTopItemsByScore: findTopItemsByScore,
    followItem: followItem,
    followZoomedItem: followZoomedItem,
    getAllBookmarkedItemsByBookmark: getAllBookmarkedItemsByBookmark,
    getCurrentTimeSec: getCurrentTimeSec,
    getTagsForFilteredItems: getTagsForFilteredItems,
    getZoomedItem: getZoomedItem,
    getZoomedItemAsLongId: getZoomedItemAsLongId,
    isRootItem: isRootItem,
    isValidCanonicalCode: isValidCanonicalCode,
    itemsToVolatileSearchQuery: itemsToVolatileSearchQuery,
    itemToCombinedPlainText: itemToCombinedPlainText,
    itemToHashSegment: itemToHashSegment,
    itemToLastModifiedSec: itemToLastModifiedSec,
    itemToPathAsItems: itemToPathAsItems,
    itemToPlainTextName: itemToPlainTextName,
    itemToPlainTextNote: itemToPlainTextNote,
    itemToTagArgsText: itemToTagArgsText,
    itemToTags: itemToTags,
    itemToVolatileSearchQuery: itemToVolatileSearchQuery,
    keyDownEventToCanonicalCode: keyDownEventToCanonicalCode,
    logElapsedTime: logElapsedTime,
    logShortReport: logShortReport,
    markFocusedAndDescendantsNotComplete: markFocusedAndDescendantsNotComplete,
    moveToBookmark: moveToBookmark,
    openFirstLinkInFocusedItem: openFirstLinkInFocusedItem,
    openHere: openHere,
    openInNewTab: openInNewTab,
    promptToChooseItem: promptToChooseItem,
    promptToExpandAndInsertAtCursor: promptToExpandAndInsertAtCursor,
    promptToAddBookmarkForCurrentItem: promptToAddBookmarkForCurrentItem, // Deprecated
    promptToFindGlobalBookmarkThenFollow: promptToFindGlobalBookmarkThenFollow,
    promptToFindLocalRegexMatchThenZoom: promptToFindLocalRegexMatchThenZoom,
    promptToNormalLocalSearch: promptToNormalLocalSearch,
    promptToFindByLastChanged: promptToFindByLastChanged,
    scatterDescendants: scatterDescendants,
    scheduleDescendants: scheduleDescendants,
    showZoomedAndMostRecentlyEdited: showZoomedAndMostRecentlyEdited,
    splitStringToSearchTerms: splitStringToSearchTerms,
    stringToTagArgsText: stringToTagArgsText,
    toItemMultimapWithSingleKeys: toItemMultimapWithSingleKeys,
    toItemMultimapWithMultipleKeys: toItemMultimapWithMultipleKeys,
    todayAsYMDString: todayAsYMDString,
    validRootUrls: validRootUrls,
    workFlowyUrlToHashSegmentAndSearchQuery: workFlowyUrlToHashSegmentAndSearchQuery,
    zoomToAndSearch: zoomToAndSearch
  };
})();
