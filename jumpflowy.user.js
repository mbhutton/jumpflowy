// ==UserScript==
// @name         JumpFlowy
// @namespace    https://github.com/mbhutton/jumpflowy
// @version      0.1.6.2
// @description  WorkFlowy user script for search and navigation
// @author       Matt Hutton
// @match        https://workflowy.com/*
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
   * @param {Item} item The item to query
   * @returns {boolean} True if and only if the given item is in the
   *                    same tree as the root item.
   */
  function isItemLocal(item) {
    return item.childrenAreInSameTree(WF.rootItem());
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
  const canonicalKeyCodesToActions = new Map();
  const builtInAbbreviationsMap = new Map();
  let customAbbrevs = new Map();
  const bindableActionsByName = new Map();

  // DEPRECATED TAGS START
  const bookmarkTag = "#bm";
  const abbrevTag = "#abbrev";
  const shortcutTag = "#shortcut";
  // DEPRECATED TAGS END

  const searchQueryToMatchNoItems =
    "META:NO_MATCHING_ITEMS_" + new Date().getTime();
  let lastRegexString = null;
  let isCleanedUp = false;

  let configurationRootItem = null;
  const CONFIGURATION_ROOT_NAME = "jumpflowyConfiguration";
  const CONFIG_SECTION_ABBREVS = "abbreviations";
  const CONFIG_SECTION_BOOKMARKS = "bookmarks";
  const CONFIG_SECTION_SHORTCUTS = "shortcuts";

  const prodOrigin = "https://workflowy.com";
  const devOrigin = "https://dev.workflowy.com";
  const isDevDomain = location.origin === devOrigin;
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
   * necessary to avoid crossing between workflowy.com and dev.workflowy.com.
   * Intended primarily for use on the dev domain, but also usable in prod.
   * @param {string} url The URL to open.
   * @param {string} target (See documentation for window.open)
   * @param {string} features (See documentation for window.open)
   * @param {boolean} replace (See documentation for window.open)
   * @returns {Window} (See documentation for window.open)
   */
  function _openWithoutChangingWfDomain(url, target, features, replace) {
    const isProdDomain = !isDevDomain;
    if (isDevDomain && url.startsWith(prodOrigin)) {
      url = devOrigin + url.substring(prodOrigin.length);
    } else if (isProdDomain && url.startsWith(devOrigin)) {
      url = prodOrigin + url.substring(devOrigin.length);
    }
    target = target || (isWorkFlowyUrl(url) ? "_self" : "_blank");
    return originalWindowOpenFn(url, target, features, replace);
  }

  function openItemHere(item, searchQuery) {
    WF.zoomTo(item);
    if (searchQuery) {
      WF.search(searchQuery);
    } else {
      WF.clearSearch();
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
    const item = WF.createItem(WF.currentItem(), 0);
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
      const chosenItem = promptToChooseItem(matchingItems);
      if (chosenItem) {
        openItemHere(chosenItem, null);
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
   * @returns {boolean} True if and only if the given string is a WorkFlowy URL.
   * @param {string} s The string to test.
   */
  function isWorkFlowyUrl(s) {
    return s && s.match("^https://(dev\\.)?workflowy\\.com(/.*)?$") !== null;
  }

  /**
   * @returns {boolean} True if and only if the given string is a WorkFlowy URL
   *                    which represents the root item, with no search query.
   * @param {string} s The string to test.
   */
  function isWorkFlowyHomeUrl(s) {
    const validRootUrls = [
      "https://workflowy.com",
      "https://workflowy.com/",
      "https://workflowy.com/#",
      "https://dev.workflowy.com",
      "https://dev.workflowy.com/",
      "https://dev.workflowy.com/#"
    ];
    return validRootUrls.includes(s);
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
            new ConversionFailure(`Unknown key "${key}"`, child, null)
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
        case CONFIG_SECTION_ABBREVS: // Falls through
        case CONFIG_SECTION_BOOKMARKS: // Falls through
        case CONFIG_SECTION_SHORTCUTS:
          return convertToMapOfStrings;
      }
    }
    return convertToMap(item, keyToConverter);
  }

  /**
   * Global event listener.
   * @param {string} eventName The name of the event.
   * @returns {void}
   */
  function wfEventListener(eventName) {
    if (eventName === "operation--edit" || eventName === "locationChanged") {
      cleanConfiguration();
      updateConfiguration();
    }
  }

  /**
   * Wipes state which is set in response to user configuration.
   * @returns {void}
   */
  function cleanConfiguration() {
    customAbbrevs = new Map();
  }

  /**
   * Finds and applies user configuration.
   * @returns {boolean} True if the config was found, was usable,
   *                    and was applied. False if not found or not usable.
   */
  function updateConfiguration() {
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
    // Extract configuration sections
    /** @type Map<string, string> */
    const abbrevsConfig = configObject.get(CONFIG_SECTION_ABBREVS);
    const abbrevsFromTags = _buildCustomAbbreviationsMap();
    customAbbrevs = new Map([...abbrevsFromTags, ...abbrevsConfig]);
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

  function registerFunctionForKeyDownEvent(canonicalCode, functionToApply) {
    if (!isValidCanonicalCode(canonicalCode)) {
      throw `${canonicalCode} is not a valid canonical key code`;
    }
    if (typeof functionToApply !== "function") {
      throw "Not a function";
    }
    if (functionToApply.length !== 0) {
      throw "Cannot register a callback function which takes arguments";
    }
    canonicalKeyCodesToActions.set(canonicalCode, functionToApply);
  }

  function _keyDownListener(keyEvent) {
    const canonicalCode = keyDownEventToCanonicalCode(keyEvent);
    const registeredFn = canonicalKeyCodesToActions.get(canonicalCode);
    if (registeredFn) {
      registeredFn();
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  }

  /**
   * Prompts the user to choose an item from among the given array of items,
   * using a mix of choosing by index, or choosing by bookmark, or by text.
   * Note: the behaviour of this method is expected to change.
   * @param {Array<Item>} items The array of items to choose from.
   * @returns {Item} Returns the chosen item, or null if cancelled.
   */
  function promptToChooseItem(items) {
    // Build aliases
    const itemAliases = Array();
    for (let item of items) {
      const tagArgsText = itemToTagArgsText(bookmarkTag, item);
      if (tagArgsText && tagArgsText.trim()) {
        itemAliases.push(tagArgsText);
      } else {
        itemAliases.push(null);
      }
    }

    let text = "Choose from one of the following:\n";
    for (let i = 0; i < items.length; i++) {
      text += i + ": " + (itemToPlainTextName(items[i]) || "<No name>") + "\n";
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
      return promptToChooseItem(resultItems);
    } else if (resultItems.length === 1) {
      return resultItems[0];
    } else {
      if (confirm(`No matches for "${answer}". Try again or cancel.`)) {
        return promptToChooseItem(items);
      }
    }
  }

  /**
   * @param {Item} item The item to follow.
   * @returns {void}
   * @see itemToFollowAction
   */
  function followItem(item) {
    const action = itemToFollowAction(item);
    action();
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
   * Returns a no-arg function which will 'follow' the given item,
   * performing some action depending on the content of the item.
   * Note: the behaviour of this method is expected to change.
   * @param {Item} item The item to follow.
   * @returns {function} A no-arg function which 'follows' the item.
   */
  function itemToFollowAction(item) {
    if (!item) {
      return () => {}; // Return a no-op
    }
    for (let nameOrNote of [
      itemToPlainTextName(item),
      itemToPlainTextNote(item)
    ]) {
      const trimmed = (nameOrNote || "").trim();
      if (isWorkFlowyUrl(trimmed) && item.getChildren().length === 0) {
        // For leaf items whose trimmed name or note is a WorkFlowy URL, open it
        if (isWorkFlowyHomeUrl(trimmed)) {
          return () => openItemHere(WF.rootItem(), null);
        } else {
          return () => openHere(trimmed);
        }
      } else if (bindableActionsByName.has(trimmed)) {
        // If the trimmed name or note is the name of a bindable action, call it
        return bindableActionsByName.get(trimmed);
      }
    }

    // Otherwise, go directly to the item itself
    return () => openItemHere(item, null);
  }

  /**
   * Prompts the user to choose from the bookmark items, then follows
   * the chosen item.
   * Note: the behaviour of this method is expected to change.
   * @returns {void}
   * @see followItem
   */
  function promptToFindGlobalBookmarkThenFollow() {
    const startTime = new Date();
    const items = findItemsWithTag(bookmarkTag, WF.rootItem());
    logElapsedTime(startTime, `Found items with ${bookmarkTag} tag`);
    const chosenItem = promptToChooseItem(items);
    followItem(chosenItem);
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
      if (isItemLocal(item)) {
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
    openItemHere(newZoom, searchQuery);
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

    const allAbbrevs = new Map([...builtInAbbreviationsMap, ...customAbbrevs]);

    const fnOrValue = allAbbrevs.get(abbreviation);
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
    const abbreviation = prompt("Type abbreviation", "ymd");
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
   * Validates then adds the given expansion into builtInAbbreviationsMap.
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
    builtInAbbreviationsMap.set(abbreviation, functionOrValue);
  }

  function _registerKeyboardShortcuts() {
    for (let item of findItemsWithTag(shortcutTag, WF.rootItem())) {
      const keyCode = itemToTagArgsText(shortcutTag, item);
      if (!keyCode) {
        continue;
      }
      if (isValidCanonicalCode(keyCode)) {
        registerFunctionForKeyDownEvent(keyCode, itemToFollowAction(item));
      } else {
        console.log(`WARN: Invalid keyboard shortcut code: '${keyCode}'.`);
      }
    }
  }

  function _populateMapWithNoArgFunctions(map, functionsArray) {
    for (let f of functionsArray) {
      if (typeof f !== "function") {
        console.warn("Not a function: " + f);
      } else if (f.length !== 0) {
        console.warn("Function takes more that zero arguments: " + f);
      } else {
        map.set(f.name, f);
      }
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

    if (isDevDomain) {
      window.open = originalWindowOpenFn;
      console.log("Restored original window.open function");
    }

    // Keyboard shortcuts
    document.removeEventListener("keydown", _keyDownListener);
    canonicalKeyCodesToActions.clear();
    bindableActionsByName.clear();

    // Built-in expansions
    builtInAbbreviationsMap.clear();
    customAbbrevs.clear();

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
      bindableActionsByName.clear();
      _populateMapWithNoArgFunctions(bindableActionsByName, [
        // Alphabetical order
        // *******************************************************
        // Maintenance note: keep this list in sync with README.md
        // vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
        createItemAtTopOfCurrent,
        dismissNotification,
        editCurrentItem,
        editParentOfFocusedItem,
        logShortReport,
        markFocusedAndDescendantsNotComplete,
        openFirstLinkInFocusedItem,
        promptToExpandAndInsertAtCursor,
        promptToFindGlobalBookmarkThenFollow,
        promptToFindLocalRegexMatchThenZoom,
        promptToNormalLocalSearch,
        showZoomedAndMostRecentlyEdited
        // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        // *******************************************************
      ]);
      _registerKeyboardShortcuts();
      document.addEventListener("keydown", _keyDownListener);

      // Built-in expansions
      _registerBuiltInExpansion("ymd", todayAsYMDString);

      if (isDevDomain) {
        window.open = _openWithoutChangingWfDomain;
        console.log("Overrode window.open function, because on dev domain");
      }

      window.WFEventListener = wfEventListener;
      updateConfiguration();

      // Warn for any deprecated configuration
      const deprecationMessages = [];
      const deprecatedAbbrevItems = findItemsWithTag(abbrevTag, WF.rootItem());
      if (deprecatedAbbrevItems.length > 0) {
        deprecationMessages.push(
          `Found ${deprecatedAbbrevItems.length} ${abbrevTag} items. ` +
            `The ${abbrevTag} tag is deprecated. Instead, define abbreviations ` +
            `in ${CONFIGURATION_ROOT_NAME} -> ${CONFIG_SECTION_ABBREVS}.`
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
    applyToEachItem: applyToEachItem,
    callAfterDocumentLoaded: callAfterDocumentLoaded,
    cleanUp: cleanUp,
    createItemAtTopOfCurrent: createItemAtTopOfCurrent,
    dateToYMDString: dateToYMDString,
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
    getCurrentTimeSec: getCurrentTimeSec,
    getZoomedItem: getZoomedItem,
    getZoomedItemAsLongId: getZoomedItemAsLongId,
    isRootItem: isRootItem,
    isValidCanonicalCode: isValidCanonicalCode,
    itemsToVolatileSearchQuery: itemsToVolatileSearchQuery,
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
    openFirstLinkInFocusedItem: openFirstLinkInFocusedItem,
    openHere: openHere,
    openInNewTab: openInNewTab,
    openItemHere: openItemHere,
    promptToChooseItem: promptToChooseItem,
    promptToExpandAndInsertAtCursor: promptToExpandAndInsertAtCursor,
    promptToFindGlobalBookmarkThenFollow: promptToFindGlobalBookmarkThenFollow,
    promptToFindLocalRegexMatchThenZoom: promptToFindLocalRegexMatchThenZoom,
    promptToNormalLocalSearch: promptToNormalLocalSearch,
    registerFunctionForKeyDownEvent: registerFunctionForKeyDownEvent,
    showZoomedAndMostRecentlyEdited: showZoomedAndMostRecentlyEdited,
    splitStringToSearchTerms: splitStringToSearchTerms,
    stringToTagArgsText: stringToTagArgsText,
    todayAsYMDString: todayAsYMDString
  };
})();
