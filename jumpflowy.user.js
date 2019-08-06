// ==UserScript==
// @name         JumpFlowy
// @namespace    https://github.com/mbhutton/jumpflowy
// @version      0.1.6.37
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
   * @param {function} itemPredicate A function (Item -> boolean) which
   *                                 returns whether or not an item is a match.
   * @param {function} branchFilter A function (Item -> boolean) which returns
   *                                whether or not to traverse into a branch.
   * @param {boolean} descendIntoMatches Whether or not to descent into matches.
   * @param {Item} searchRoot The root item of the search.
   * @returns {Array<Item>} The matching items.
   */
  function findMatchingItemsFilteringBranches(
    itemPredicate,
    branchFilter,
    descendIntoMatches,
    searchRoot
  ) {
    const matches = Array();

    /**
     * @param {Item} currentBranch The current branch (item) in the search.
     * @returns {void}
     */
    function recurse(currentBranch) {
      if (!branchFilter(currentBranch)) {
        return;
      }

      const isMatch = itemPredicate(currentBranch);
      if (isMatch) {
        matches.push(currentBranch);
      }

      let shouldRecurse = !isMatch || descendIntoMatches;
      if (shouldRecurse) {
        for (let child of currentBranch.getChildren()) {
          recurse(child);
        }
      }
    }
    recurse(searchRoot);
    return matches;
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
   * @param {string} tagToMatch The tag to match.
   * @param {Item} item The item to test.
   * @returns {boolean} True if and only if the given item has the
   *                    exact given tag, ignoring case. Otherwise false.
   * @see {@link itemToTags} For notes, caveats regarding tag handling.
   */
  function doesItemHaveTag(tagToMatch, item) {
    if (item === null) {
      return false;
    }

    return (
      doesStringHaveTag(tagToMatch, item.getNameInPlainText()) ||
      doesStringHaveTag(tagToMatch, item.getNoteInPlainText())
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
    return (
      textPredicate(itemToPlainTextName(item)) ||
      textPredicate(itemToPlainTextNote(item))
    );
  }

  /**
   * @returns {number} The current clock time in seconds since Unix epoch.
   */
  function getCurrentTimeSec() {
    return dateToSecondsSinceEpoch(new Date());
  }

  /**
   * @param {Date} date The given date.
   * @return {number} Seconds from epoch to the given date, rounding down.
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
    return isRootItem(item)
      ? 0
      : dateToSecondsSinceEpoch(item.getLastModifiedDate());
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

  // DEPRECATED TAGS START
  const bookmarkTag = "#bm";
  const abbrevTag = "#abbrev";
  const shortcutTag = "#shortcut";
  // DEPRECATED TAGS END

  const searchQueryToMatchNoItems =
    "META:NO_MATCHING_ITEMS_" + new Date().getTime();
  let lastRegexString = null;
  let isCleanedUp = false;

  /** @type {Item} */
  let configurationRootItem = null;
  const CONFIGURATION_ROOT_NAME = "jumpflowyConfiguration";
  const CONFIG_SECTION_EXPANSIONS = "textExpansions";
  const CONFIG_SECTION_BOOKMARKS = "bookmarks";
  const CONFIG_SECTION_KB_SHORTCUTS = "keyboardShortcuts";

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
      const name = itemToPlainTextName(item);
      const note = itemToPlainTextNote(item);
      const combinedText = note.length === 0 ? name : `${name}\n${note}`;
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
    const resultForName = stringToTagArgsText(
      tagToMatch,
      itemToPlainTextName(item)
    );
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
    const searchSuffix = searchQuery
      ? `?q=${encodeURIComponent(searchQuery)}`
      : "";
    return `${baseUrl}/${itemToHashSegment(item)}${searchSuffix}`;
  }

  /**
   * @returns {boolean} True if and only if the given string is a WorkFlowy URL.
   * @param {string} s The string to test.
   */
  function isWorkFlowyUrl(s) {
    return (
      s && s.match("^https://(dev\\.|beta\\.)?workflowy\\.com(/.*)?$") !== null
    );
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
    const [hashSegment, searchQuery] = workFlowyUrlToHashSegmentAndSearchQuery(
      fullUrl
    );
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
    const timeClause = `last-changed:${modifiedHowLongAgoMinutes +
      1} -last-changed:${modifiedHowLongAgoMinutes - 1} `;
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
        parts.push(
          `See ${itemAndSearchToWorkFlowyUrl("current", this.item, null)} .`
        );
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
        failures.push(
          new ConversionFailure(
            `Ignoring value for ${key}, which is already set above.`,
            child,
            null
          )
        );
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
          failures.push(
            new ConversionFailure(`Unknown key "${key}".`, child, null)
          );
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
        new ConversionFailure(
          "Can't specify both a name and a note. Delete the name or the note.",
          item,
          null
        )
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
    if (
      configurationRootItem === null ||
      !isConfigurationRoot(configurationRootItem)
    ) {
      configurationRootItem = null;
      const matchingNodes = findMatchingItems(
        isConfigurationRoot,
        WF.rootItem()
      );
      if (matchingNodes.length > 0) {
        configurationRootItem = matchingNodes[0];
      }
      if (matchingNodes.length > 1) {
        WF.showMessage(
          `Multiple ${CONFIGURATION_ROOT_NAME} items found. Using the first one.`,
          false
        );
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
    if (
      (eventName && eventName.startsWith("operation--")) ||
      eventName === "locationChanged"
    ) {
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
        gelData[GEL_CALLBACKS_MAX_MS] = Math.max(
          gelData[GEL_CALLBACKS_MAX_MS],
          elapsedMs
        );
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
    const expansionsConfig =
      configObject.get(CONFIG_SECTION_EXPANSIONS) || new Map();
    customExpansions = new Map([...abbrevsFromTags, ...expansionsConfig]);

    // Keyboard shortcuts
    /** @type Map<string, string> */
    const shortcutsConfig =
      configObject.get(CONFIG_SECTION_KB_SHORTCUTS) || new Map();
    const allKeyCodesToFunctions = new Map([
      ...kbShortcutsFromTags,
      ..._convertKbShortcutsConfigToTargetMap(shortcutsConfig)
    ]);
    allKeyCodesToFunctions.forEach((target, code) => {
      canonicalKeyCodesToTargets.set(code, target);
    });

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
    const bookmarksConfig =
      configObject.get(CONFIG_SECTION_BOOKMARKS) || new Map();
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
          WF.showMessage(
            `No item found for URL ${wfUrl}, re bookmark "${bookmarkName}".`
          );
        }
      } else {
        WF.showMessage(
          `"${wfUrl}" is not a valid WorkFlowy URL, re bookmark "${bookmarkName}".`
        );
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
    return findTopItemsByScore(
      scoreFn,
      earliestModifiedSec,
      maxSize,
      searchRoot
    );
  }

  /**
   * Finds (non-embedded) matching items outside the given destination item,
   * and moves them to the destination item.
   * @param {function} itemPredicate A function (Item -> boolean) which
   *                                 returns whether or not an item is a match.
   * @param {Item} destinationItem Where to move the found items to.
   * @param {boolean} toTop Whether to move the items to the top of the list.
   * @returns {boolean} Whether the move took place.
   */
  function gatherExternalMatches(itemPredicate, destinationItem, toTop) {
    /**
     * @param {Item} branchItem The item to test.
     * @returns {boolean} Whether to descend into the given branch.
     */
    function branchFilter(branchItem) {
      // Don't descend into the destination item itself
      const isDestination = branchItem.getId() === destinationItem.getId();
      return !branchItem.isEmbedded() && !isDestination;
    }
    const outOfPlaceRoots = findMatchingItemsFilteringBranches(
      itemPredicate,
      branchFilter,
      false,
      WF.rootItem()
    );
    const toMoveCount = outOfPlaceRoots.length;
    if (toMoveCount === 0) {
      WF.showMessage("Found no matches to gather.");
      return false;
    }
    const formattedDest = formatItem(destinationItem);
    for (let toMove of outOfPlaceRoots) {
      if (isAAncestorOfB(toMove, destinationItem)) {
        WF.showMessage(
          `Can't move ${formatItem(
            toMove
          )} to its descendant: ${formattedDest}}.`
        );
        return false;
      }
    }
    const prompt = `Move ${toMoveCount} item(s) to ${formattedDest}?`;
    if (confirm(prompt)) {
      const priority = toTop ? 0 : destinationItem.getChildren().length;
      WF.editGroup(() => {
        WF.moveItems(outOfPlaceRoots, destinationItem, priority);
      });
      WF.showMessage(`Moved ${toMoveCount} item(s) to ${formattedDest}`);
      return true;
    } else {
      return false;
    }
  }

  /**
   * For use with a "flywheel" list whose root item contains a tag in its name,
   * unique to the list, and whose children also have the tag in their names.
   * For use when flywheel items may have been moved to other locations in the
   * document outside of the root.
   * This action finds any (non-embedded) flywheel items which are outside the
   * list, and moves them back to the flywheel list, at the top.
   * The active item is interpreted as the root of the flywheel.
   * @returns {void}
   */
  function gatherFlywheel() {
    const flywheelTag = "#flywheel";
    const activeItems = getActiveItems().items;
    if (activeItems.length !== 1) {
      WF.showMessage("Can only run this action on exactly 1 item at a time.");
      return;
    }
    const flywheelRoot = activeItems[0];

    function getNameTagsLowered(item) {
      return WF.getItemNameTags(item).map(x => x.tag.toLowerCase());
    }

    const allTagsInRoot = getNameTagsLowered(flywheelRoot);
    const formattedRoot = formatItem(flywheelRoot);
    if (!allTagsInRoot.includes("#flywheel")) {
      WF.showMessage(`Item ${formattedRoot} doesn't have ${flywheelTag} tag.`);
      return;
    }
    const filteredTags = allTagsInRoot.filter(x => x !== flywheelTag);
    if (filteredTags.length !== 1) {
      WF.showMessage(
        `Flywheel item ${formattedRoot} can only have 1 tag other than "${flywheelTag}".`
      );
      return;
    }
    const tag = filteredTags[0];

    function itemPredicate(item) {
      return getNameTagsLowered(item).includes(tag);
    }

    gatherExternalMatches(itemPredicate, flywheelRoot, true);
  }

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
    const result = canonicalCode.match(
      "^(ctrl\\+)?(shift\\+)?(alt\\+)?(meta\\+)?Key.$"
    );
    return result !== null;
  }

  function validateKeyCode(canonicalCode) {
    if (!isValidCanonicalCode(canonicalCode)) {
      throw `${canonicalCode} is not a valid canonical key code`;
    }
  }

  function _keyDownListener(keyEvent) {
    const canonicalCode = keyDownEventToCanonicalCode(keyEvent);
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
    if (answer === "") {
      return;
    }
    const answerAsInt = parseInt(answer);
    const resultItems = Array();
    const answerLC = answer.toLowerCase();
    if (!isNaN(answerAsInt) && `${answerAsInt}` === answer) {
      // It's a number
      if (answerAsInt < 0 || answerAsInt >= items.length) {
        alert("Invalid choice: " + answer);
        return;
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
    if (resultItems.length === 0) {
      // Match aliases which start with the string (ignoring case)
      for (let i = 0; i < items.length; i++) {
        const alias = itemAliases[i];
        if (alias && alias.toLowerCase().startsWith(answerLC)) {
          resultItems.push(items[i]);
        }
      }
    }
    if (resultItems.length === 0) {
      // Match items which contains the full string in the name (ignoring case)
      for (let item of items) {
        const plainTextNameLC = itemToPlainTextName(item).toLowerCase();
        if (plainTextNameLC.includes(answerLC)) {
          resultItems.push(item);
        }
      }
    }
    if (resultItems.length > 1) {
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
    for (let nameOrNote of [
      itemToPlainTextName(focusedItem),
      itemToPlainTextNote(focusedItem)
    ]) {
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
    for (let nameOrNote of [
      itemToPlainTextName(item),
      itemToPlainTextNote(item)
    ]) {
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
      const [item, searchQuery] = findItemAndSearchQueryForWorkFlowyUrl(
        trimmed
      );
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
      super(
        "builtInFunction",
        "function:" + functionName,
        `Built-in function ${functionName}`,
        defaultFunction
      );
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
    const targetQuery =
      targetItem.getId() === WF.currentItem().getId()
        ? WF.currentSearchQuery()
        : null;
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
        WF.showMessage(
          `No action required: Bookmark "${bookmarkName}" already points to ${formattedTarget}.`
        );
      } else if (existingSourceItem) {
        shouldCreate = confirm(
          `Update existing bookmark "${bookmarkName}", pointing to ${formattedExistingTarget}?`
        );
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
        const bookmarksSectionItem = findConfigurationSection(
          CONFIG_SECTION_BOOKMARKS
        );
        if (bookmarksSectionItem) {
          WF.editGroup(() => {
            var newBookmarkItem = existingSourceItem
              ? existingSourceItem
              : WF.createItem(bookmarksSectionItem, 0);
            // Workaround: coerce return value of createItem to correct type
            if (typeof newBookmarkItem.projectid === "string") {
              newBookmarkItem = WF.getItemById(newBookmarkItem.projectid);
            }
            if (newBookmarkItem) {
              WF.setItemName(newBookmarkItem, bookmarkName);
              const prodUrl = itemAndSearchToWorkFlowyUrl(
                "prod",
                targetItem,
                targetQuery
              );
              WF.setItemNote(newBookmarkItem, prodUrl);
              WF.showMessage(
                `Bookmark "${bookmarkName}" now points to ${formattedTarget}.`
              );
            } else {
              WF.showMessage(
                "Failed to create or update new bookmark. Check the console log."
              );
            }
          });
        } else {
          WF.showMessage(
            `No "${CONFIG_SECTION_BOOKMARKS}" configuration section found under` +
              `${itemAndSearchToWorkFlowyUrl(
                "current",
                configurationRootItem,
                null
              )}.`
          );
        }
      } else {
        WF.showMessage(
          "Configuration root item not found. " +
            `Are you missing a "${CONFIGURATION_ROOT_NAME}" item?`
        );
      }
    }
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

    const allExpansions = new Map([
      ...builtInExpansionsMap,
      ...customExpansions
    ]);

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
        WF.showMessage(
          `WARN: Invalid keyboard shortcut code: '${keyCode}'.`,
          false
        );
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
        addBookmark,
        createItemAtTopOfCurrent,
        deleteFocusedItemIfNoChildren,
        dismissNotification,
        editCurrentItem,
        editParentOfFocusedItem,
        gatherFlywheel,
        logShortReport,
        markFocusedAndDescendantsNotComplete,
        moveToBookmark,
        openFirstLinkInFocusedItem,
        promptToExpandAndInsertAtCursor,
        promptToAddBookmarkForCurrentItem, // Deprecated
        promptToFindGlobalBookmarkThenFollow,
        promptToFindLocalRegexMatchThenZoom,
        promptToNormalLocalSearch,
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
    // Functions by alphabetical order
    addBookmark: addBookmark,
    applyToEachItem: applyToEachItem,
    callAfterDocumentLoaded: callAfterDocumentLoaded,
    cleanUp: cleanUp,
    createItemAtTopOfCurrent: createItemAtTopOfCurrent,
    dateToYMDString: dateToYMDString,
    deleteFocusedItemIfNoChildren: deleteFocusedItemIfNoChildren,
    dismissNotification: dismissNotification,
    doesItemHaveTag: doesItemHaveTag,
    doesItemNameOrNoteMatch: doesItemNameOrNoteMatch,
    doesStringHaveTag: doesStringHaveTag,
    editCurrentItem: editCurrentItem,
    editParentOfFocusedItem: editParentOfFocusedItem,
    expandAbbreviation: expandAbbreviation,
    findClosestCommonAncestor: findClosestCommonAncestor,
    findItemsMatchingRegex: findItemsMatchingRegex,
    findItemsWithTag: findItemsWithTag,
    findMatchingItems: findMatchingItems,
    findRecentlyEditedItems: findRecentlyEditedItems,
    findTopItemsByComparator: findTopItemsByComparator,
    findTopItemsByScore: findTopItemsByScore,
    followItem: followItem,
    followZoomedItem: followZoomedItem,
    gatherFlywheel: gatherFlywheel,
    getCurrentTimeSec: getCurrentTimeSec,
    getZoomedItem: getZoomedItem,
    getZoomedItemAsLongId: getZoomedItemAsLongId,
    isRootItem: isRootItem,
    isValidCanonicalCode: isValidCanonicalCode,
    itemsToVolatileSearchQuery: itemsToVolatileSearchQuery,
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
    showZoomedAndMostRecentlyEdited: showZoomedAndMostRecentlyEdited,
    splitStringToSearchTerms: splitStringToSearchTerms,
    stringToTagArgsText: stringToTagArgsText,
    todayAsYMDString: todayAsYMDString,
    validRootUrls: validRootUrls,
    workFlowyUrlToHashSegmentAndSearchQuery: workFlowyUrlToHashSegmentAndSearchQuery,
    zoomToAndSearch: zoomToAndSearch
  };
})();
