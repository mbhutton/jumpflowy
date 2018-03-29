// ==UserScript==
// @name         JumpFlowy
// @namespace    https://github.com/mbhutton/jumpflowy
// @version      0.1.3.5
// @description  JavaScript extensions for WorkFlowy
// @author       Matt Hutton
// @match        https://workflowy.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/mbhutton/jumpflowy/raw/master/jumpflowy.user.js
// ==/UserScript==

/*
JumpFlowy: WorkFlowy extension/library for search and navigation.
*/

// ESLint globals from WorkFlowy:
/*
global project_tree:false tagging:false date_time:false
       global_project_tree_object:false project_ids:false location_history:false
*/

// Enable TypeScript checking
// @ts-check
/// <reference path="index.d.ts" />

// UMD (Universal Module Definition) boilerplate
(function(root, umdFactory) {
  "use strict";
  // eslint-disable-next-line no-undef
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    // eslint-disable-next-line no-undef
    define([], umdFactory);
  } else {
    // Browser globals
    root.jumpflowy = umdFactory();
  }
})(typeof self !== "undefined" ? self : this, function() {
  "use strict";
  // JumpFlowy implementation starts

  /**
   * @returns {ProjectRef} The root node of the WorkFlowy account
   *                       currently logged into.
   */
  function getRootNode() {
    return project_tree.getMainProjectTree().getRootProjectReference();
  }

  /**
   * Applies the given function to the given node
   * and each of its descendants, as a depth first search.
   * @param {function} functionToApply The function to apply to each node.
   * @param {ProjectRef} searchRoot The root node of the search.
   * @returns {void}
   */
  function applyToEachNode(functionToApply, searchRoot) {
    // Apply the function
    functionToApply(searchRoot);
    // Recurse
    for (let child of searchRoot.getChildren()) {
      applyToEachNode(functionToApply, child);
    }
  }

  /**
   * @param {function} nodePredicate A function (ProjectRef -> boolean) which
   *                                 returns whether or not a node is a match.
   * @param {ProjectRef} searchRoot The root node of the search.
   * @returns {Array<ProjectRef>} The matching nodes, in order or appearance.
   */
  function findMatchingNodes(nodePredicate, searchRoot) {
    const matches = Array();

    function addIfMatch(node) {
      if (nodePredicate(node)) {
        matches.push(node);
      }
    }
    applyToEachNode(addIfMatch, searchRoot);
    return matches;
  }

  /**
   * Returns the tags found in the given string.
   * Returns the empty set if none are found, or if given null.
   *
   * Note: Tags containing punctuation may produce unexpected results.
   * Suggested best practice: freely use '-' and '_' and ':'
   * as part of tags, being careful to avoid ':' as a suffix.
   *
   * @param {string} s The string to split.
   * @returns {Array<string>} An array of tags found in the string.
   */
  function stringToTags(s) {
    const results = Array();
    if (s === null) {
      return results;
    }
    function handleTag(location, tagFound) {
      results.push(tagFound);
    }
    tagging.forEachTagInString(s, handleTag, false);
    return results;
  }

  /**
   * @param {string} tagToMatch The tag to match.
   * @param {string} s The string to test.
   * @returns {boolean} True if and only if the given string has the
   *                    exact given tag, ignoring case. Otherwise false.
   * @see {@link stringToTags} For notes, caveats regarding tag handling.
   */
  function doesStringHaveTag(tagToMatch, s) {
    if (s === null) {
      return false;
    }
    // Optimise for the case where most strings will not have the tag,
    // by quickly eliminating cases where the tag is definitely not there.
    // This gives a ~3x speed up in the common case where the tag is rare.
    if (s.indexOf(tagToMatch) === -1) {
      return false;
    }
    for (let tag of stringToTags(s)) {
      if (tag.toLowerCase() === tagToMatch.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {ProjectRef} node The node
   * @returns {string} The plain text version of the node's name,
   *                   or the empty string if it is the root node.
   */
  function nodeToPlainTextName(node) {
    const treeObj = node.getProjectTreeObject();
    if (treeObj === null) {
      return ""; // Root node
    }
    return global_project_tree_object.getNameInPlainText(treeObj);
  }

  /**
   * @param {ProjectRef} node The node
   * @returns {string} The plain text version of the node's note,
   *                   or the empty string if it is the root node.
   */
  function nodeToPlainTextNote(node) {
    const treeObj = node.getProjectTreeObject();
    if (treeObj === null) {
      return ""; // Root node
    }
    return global_project_tree_object.getNoteInPlainText(treeObj);
  }

  /**
   * @param {function} textPredicate The predicate to apply to each string.
   *                                 The predicate should handle null values,
   *                                 as the root node has a null name and note.
   * @param {ProjectRef} node The node to test.
   * @returns {boolean} Whether textPredicate returns true for either the node's
   *                    name or note.
   */
  function doesNodeNameOrNoteMatch(textPredicate, node) {
    return (
      textPredicate(nodeToPlainTextName(node)) ||
      textPredicate(nodeToPlainTextNote(node))
    );
  }

  /**
   * @param {string} tagToMatch The tag to match.
   * @param {ProjectRef} node The node to test.
   * @returns {boolean} Whether the node has the exact given tag, ignoring case.
   */
  function doesNodeHaveTag(tagToMatch, node) {
    const hasTagFn = text => doesStringHaveTag(tagToMatch, text);
    return doesNodeNameOrNoteMatch(hasTagFn, node);
  }

  /**
   * @returns {number} The current clock time in seconds since Unix epoch.
   */
  function getCurrentTimeSec() {
    return Math.floor(date_time.getCurrentTimeInMS() / 1000);
  }

  /**
   * @param {ProjectRef} node The node to query.
   * @returns {number} When the node was last modified, in seconds since
   *                   unix epoch. For the root node, returns the time the
   *                   user joined WorkFlowy.
   */
  function nodeToLastModifiedSec(node) {
    const tree = node.getProjectTree();
    const joinedSec = tree.dateJoinedTimestampInSeconds;
    const treeObject = node.getProjectTreeObject();
    // treeObject is null for the root node
    if (treeObject === null) {
      return joinedSec;
    }
    const global_tree_obj = global_project_tree_object;
    const lastModSecSinceJoining = global_tree_obj.getLastModified(treeObject);
    return joinedSec + lastModSecSinceJoining;
  }

  ////////////////////////////////////
  // Nursery section starts.
  //
  // The code in this section should be considered under development rather
  // than stable: the functionality is expected to change, and the functions
  // do not form a stable API.
  // Functions defined here are exposed via the 'jumpflowy.nursery' namespace.
  // As code here stabilises, it will be moved above this section, with
  // functions moved into the main 'jumpflowy' namespace.
  ////////////////////////////////////

  // Clean up any previous instance of JumpFlowy
  if (
    typeof window.jumpflowy !== "undefined" &&
    typeof window.jumpflowy.nursery !== "undefined" &&
    typeof window.jumpflowy.nursery.cleanUp !== "undefined"
  ) {
    window.jumpflowy.nursery.cleanUp();
  }

  // Global state
  const canonicalKeyCodesToActions = new Map();
  const builtInAbbreviationsMap = new Map();
  const bindableActionsByName = new Map();
  const bookmarkTag = "#bm";
  const abbrevTag = "#abbrev";
  const shortcutTag = "#shortcut";
  let isCleanedUp = false;

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

  function openNodeHere(node, rawSearchString) {
    const projectId = project_ids.truncateProjectId(node.getProjectId());
    const searchSuffix = toSearchSuffix(rawSearchString);
    openHere(`https://workflowy.com/#/${projectId}${searchSuffix}`);
  }

  /**
   * Prompt for a search string, then perform a normal WorkFlowy search.
   * @returns {void}
   */
  function promptThenWfSearch() {
    // Prompt for a new search string, using the previous value as the default
    const previousVal = $("#searchBox").val().toString();
    const newVal = prompt("WorkFlowy search: ", previousVal);
    // Set search string then simulate <ENTER> key press, to trigger search
    $("#searchBox").val(newVal);
    $("#searchBox").focus();
    $("#searchBox").trigger(
      $.Event("keydown", {
        which: $.ui.keyCode.ENTER
      })
    );
  }

  /**
   * @returns {void} Dismisses a notification from the WorkFlowy UI, e.g. after
   *                 deleting a large tree of nodes.
   */
  function dismissWfNotification() {
    $("#message")
      .children(".close")
      .click();
  }

  function clickAddButton() {
    $(".addButton").click();
  }

  function clickSaveButton() {
    $(".saveButton").click();
  }

  function toSearchSuffix(rawSearchString) {
    if (rawSearchString) {
      const escapedSearchString = encodeURIComponent(rawSearchString);
      return `?q=${escapedSearchString}`;
    } else {
      return "";
    }
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
    // Note: doesStringHaveTag is null safe for s
    if (!doesStringHaveTag(tagToMatch, s)) {
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
   * @param {string} tagToMatch The tag to match.
   * @param {ProjectRef} node The node to extract the args text from.
   * @returns {string} The trimmed arguments string, or null if no call found.
   * @see {@link stringToTagArgsText} For semantics.
   */
  function nodeToTagArgsText(tagToMatch, node) {
    const resultForName = stringToTagArgsText(
      tagToMatch,
      nodeToPlainTextName(node)
    );
    if (resultForName !== null) {
      return resultForName;
    }
    return stringToTagArgsText(tagToMatch, nodeToPlainTextNote(node));
  }

  /**
   * @param {ProjectRef} node The node to query
   * @returns {boolean} Whether the given node is the root node
   */
  function isRootNode(node) {
    return node.getProjectId() === "None";
  }

  /**
   * @returns {string} The long (non-truncated) project ID of the
   *                   node which is currently zoomed into.
   */
  function getZoomedNodeAsLongId() {
    return location_history.getCurrentLocation()._zoomedProjectId;
  }

  /**
   * @returns {ProjectRef} The node which is currently zoomed into.
   */
  function getZoomedNode() {
    const zoomedNodeId = getZoomedNodeAsLongId();
    return getNodeByLongIdOrInvalid(zoomedNodeId);
  }

  /**
   * @param {ProjectRef} node The node whose path to get
   * @returns {Array<ProjectRef>} An array starting with the root and ending
   *                              with the node.
   */
  function nodeToPathAsNodes(node) {
    return node
      .getAncestors() // parent ... root
      .slice()
      .reverse() // root ... parent
      .concat(node); // root ... parent, node
  }

  /**
   * @param {ProjectRef} nodeA Some node
   * @param {ProjectRef} nodeB Another node
   * @returns {ProjectRef} The closest common ancestor of both nodes, inclusive.
   */
  function findClosestCommonAncestor(nodeA, nodeB) {
    const pathA = nodeToPathAsNodes(nodeA);
    const pathB = nodeToPathAsNodes(nodeB);
    const minLength = Math.min(pathA.length, pathB.length);

    let i;
    for (i = 0; i < minLength; i++) {
      if (pathA[i].getProjectId() !== pathB[i].getProjectId()) {
        break;
      }
    }
    if (i === 0) {
      throw "Nodes shared no common root";
    }
    return pathA[i - 1];
  }

  /**
   * @returns {boolean} True if and only if the given string is a WorkFlowy URL.
   * @param {string} s The string to test.
   */
  function isWorkFlowyUrl(s) {
    return s && s.match("^https://workflowy\\.com(/.*)?$") !== null;
  }

  function nodesToSearchUrl(nodes) {
    return (
      "https://workflowy.com/#?q=" +
      encodeURIComponent(nodesToSearchTermText(nodes))
    );
  }

  function nodesToSearchTermText(nodes) {
    const searchesOrNulls = nodes.map(n => nodeToSearchTermText(n));
    const searches = searchesOrNulls.filter(x => x !== null);
    return searches.join(" OR ");
  }

  /**
   * @param {ProjectRef} node The node to build the search string for
   * @returns {string | null} The unescaped search term to use for finding the
   *                          given node, or null if it is the root node.
   */
  function nodeToSearchTermText(node) {
    if (isRootNode(node)) {
      // eslint-disable-next-line no-console
      console.warn(
        "nodeToSearchTermText(node) called with the root node of the document."
      );
      return null;
    }
    const currentTimeSec = getCurrentTimeSec();
    const nodeLastModifiedSec = nodeToLastModifiedSec(node);
    const modifiedHowLongAgoSec = currentTimeSec - nodeLastModifiedSec;
    const modifiedHowLongAgoMinutes = Math.ceil(modifiedHowLongAgoSec / 60);
    const timeClause = `last-changed:${modifiedHowLongAgoMinutes +
      1} -last-changed:${modifiedHowLongAgoMinutes - 1} `;
    const nameClause = splitNameOrStringByDoubleQuotes(
      nodeToPlainTextName(node)
    );
    const noteClause = splitNameOrStringByDoubleQuotes(
      nodeToPlainTextNote(node)
    );
    return timeClause + nameClause + noteClause;
  }

  function splitNameOrStringByDoubleQuotes(s) {
    const lines = s.match(/[^\r\n]+/g);
    if (lines === null || lines.length === 0) {
      return "";
    }
    let result = "";
    for (let line of lines) {
      for (let segment of line.split('"')) {
        if (segment.trim() !== "") {
          result += `"${segment}" `;
        }
      }
    }
    return result;
  }

  /**
   * @param {string} tag The tag to find, e.g. "#foo".
   * @param {ProjectRef} searchRoot The root node of the search.
   * @returns {Array<ProjectRef>} The matching nodes, in order or appearance.
   */
  function findNodesWithTag(tag, searchRoot) {
    return findMatchingNodes(n => doesNodeHaveTag(tag, n), searchRoot);
  }

  /**
   * @param {string} longId The long (non-truncated) project ID.
   * @returns {ProjectRef} The node with the given ID, or an invalid ProjectRef
   *                       if the project ID is invalid. Test the validity of
   *                       the returned node using theReturnedNode.isValid().
   */
  function getNodeByLongIdOrInvalid(longId) {
    const prTree = project_tree.getMainProjectTree();
    return prTree.getProjectReferenceByProjectId(longId);
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
   * @returns {Array<ProjectRef>} The top nodes under the given
   *    search root (inclusive), with higher scoring nodes first.
   * @param {function} nodeToScoreFn A function from node (ProjectRef)
   *    to a score (number), where higher scores are better.
   * @param {number} minScore Nodes must have this score or higher to
   *    be included in the results.
   * @param {number} maxSize The results array will be at most this size.
   * @param {ProjectRef} searchRoot The root node of the search.
   */
  function findTopNodesByScore(nodeToScoreFn, minScore, maxSize, searchRoot) {
    const results = Array(maxSize).fill(null);
    function isABetterThanB(nodeAndScoreA, nodeAndScoreB) {
      return nodeAndScoreA[1] > nodeAndScoreB[1];
    }
    function forEachNode(node) {
      const score = nodeToScoreFn(node);
      const nodeAndScore = [node, score];
      if (score >= minScore) {
        insertIntoSortedResults(isABetterThanB, results, nodeAndScore);
      }
    }
    applyToEachNode(forEachNode, searchRoot);
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
   * @returns {Array<ProjectRef>} Recently edited nodes, most recent first.
   * @param {number} earliestModifiedSec Nodes edited before this are excluded.
   * @param {number} maxSize The results array will be at most this size.
   * @param {ProjectRef} searchRoot The root node of the search.
   */
  function findRecentlyEditedNodes(earliestModifiedSec, maxSize, searchRoot) {
    const scoreFn = nodeToLastModifiedSec; // Higher timestamp is a higher score
    return findTopNodesByScore(
      scoreFn,
      earliestModifiedSec,
      maxSize,
      searchRoot
    );
  }

  /**
   * @param {function} callbackFn The function to apply when project is loaded,
   *                              of type (rootProject:ProjectRef) -> void.
   * @returns {void}
   * Notes:
   * - The function will be prevented from running if cleanUp() has been called.
   * Caveats:
   * - If multiple functions are passed to this method, the callbacks
   *   will be run in an undefined order.
   */
  function applyToProjectWhenLoaded(callbackFn) {
    if (isCleanedUp) {
      // eslint-disable-next-line no-console
      console.debug("Not calling function, because cleanUp() already called.");
      return;
    }
    let isLoaded = false;
    let rootProject;
    const timeoutMs = 350;

    if (typeof project_tree !== "undefined" && project_tree !== null) {
      const mainProjectTree = project_tree.getMainProjectTree();
      if (mainProjectTree !== undefined && mainProjectTree !== null) {
        rootProject = mainProjectTree.getRootProjectReference();
        if (rootProject !== undefined && rootProject !== null) {
          isLoaded = true;
        }
      }
    }
    if (isLoaded) {
      // eslint-disable-next-line no-console
      console.log("Project now loaded. Applying function to root project...");
      callbackFn(rootProject);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Project not yet loaded. Waiting for ${timeoutMs}ms.`);
      const repeat = () => applyToProjectWhenLoaded(callbackFn);
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

  function todayAsYMDString() {
    return dateToYMDString(new Date());
  }

  /**
   * A developer utility method to help show time taken for an operation.
   * @param {Date} startDate The start date of the operation to measure.
   * @param {string} message The message to be displayed before the time delta.
   * @returns {void}
   */
  function showElapsedTime(startDate, message) {
    const end = new Date();
    const deltaMs = end.getTime() - startDate.getTime();
    // eslint-disable-next-line no-console
    console.log(`${message} (${deltaMs}ms)`);
  }

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

  function keyDownListener(keyEvent) {
    const canonicalCode = keyDownEventToCanonicalCode(keyEvent);
    const registeredFn = canonicalKeyCodesToActions.get(canonicalCode);
    if (registeredFn) {
      registeredFn();
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  }

  /**
   * Prompts the user to choose a node from among the given array of nodes,
   * using a mix of choosing by index, or choosing by bookmark, or by text.
   * Note: the behaviour of this method is expected to change.
   * @param {Array<ProjectRef>} nodes The array of nodes to choose from.
   * @returns {ProjectRef} Returns the chosen node, or null if cancelled.
   */
  function promptToChooseNode(nodes) {
    // Build aliases
    const nodeAliases = Array();
    for (let node of nodes) {
      const tagArgsText = nodeToTagArgsText(bookmarkTag, node);
      if (tagArgsText && tagArgsText.trim()) {
        nodeAliases.push(tagArgsText);
      } else {
        nodeAliases.push(null);
      }
    }

    let text = "Choose from one of the following:\n";
    for (let i = 0; i < nodes.length; i++) {
      text += i + ": " + (nodeToPlainTextName(nodes[i]) || "<No name>") + "\n";
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
    const resultNodes = Array();
    const answerLC = answer.toLowerCase();
    if (!isNaN(answerAsInt) && `${answerAsInt}` === answer) {
      // It's a number
      if (answerAsInt < 0 || answerAsInt >= nodes.length) {
        alert("Invalid choice: " + answer);
        return;
      } else {
        resultNodes.push(nodes[answerAsInt]);
      }
    }
    if (resultNodes.length === 0) {
      // Match the full alias (ignoring case)
      for (let i = 0; i < nodes.length; i++) {
        const alias = nodeAliases[i];
        if (alias && alias.toLowerCase() === answerLC) {
          resultNodes.push(nodes[i]);
        }
      }
    }
    if (resultNodes.length === 0) {
      // Match aliases which start with the string (ignoring case)
      for (let i = 0; i < nodes.length; i++) {
        const alias = nodeAliases[i];
        if (alias && alias.toLowerCase().startsWith(answerLC)) {
          resultNodes.push(nodes[i]);
        }
      }
    }
    if (resultNodes.length === 0) {
      // Match nodes which contains the full string in the name (ignoring case)
      for (let node of nodes) {
        if (nodeToPlainTextName(node).toLowerCase().includes(answerLC)) {
          resultNodes.push(node);
        }
      }
    }
    if (resultNodes.length > 1) {
      // Choose again amongst only the matches
      return promptToChooseNode(resultNodes);
    } else if (resultNodes.length === 1) {
      return resultNodes[0];
    } else {
      if (confirm(`No matches for "${answer}". Try again or cancel.`)) {
        return promptToChooseNode(nodes);
      }
    }
  }

  /**
   * @param {ProjectRef} node The node to follow.
   * @returns {void}
   * @see nodeToFollowAction
   */
  function followNode(node) {
    const action = nodeToFollowAction(node);
    action();
  }

  /**
   * Calls followNode on the currently zoomed node.
   * @see followNode
   * @returns {void}
   */
  function followZoomedNode() {
    const zoomedNode = getZoomedNode();
    followNode(zoomedNode);
  }

  /**
   * Returns a no-arg function which will 'follow' the given node,
   * performing some action depending on the content of the node.
   * Note: the behaviour of this method is expected to change.
   * @param {ProjectRef} node The node to follow.
   * @returns {function} A no-arg function which 'follows' the node.
   */
  function nodeToFollowAction(node) {
    if (!node) {
      return () => {}; // Return a no-op
    }
    for (let nameOrNote of [
      nodeToPlainTextName(node),
      nodeToPlainTextNote(node)
    ]) {
      const trimmed = (nameOrNote || "").trim();
      if (isWorkFlowyUrl(trimmed) && node.getChildren().length === 0) {
        // For leaf nodes whose trimmed name or note is a WorkFlowy URL, open it
        return () => openHere(trimmed);
      } else if (bindableActionsByName.has(trimmed)) {
        // If the trimmed name or note is the name of a bindable action, call it
        return bindableActionsByName.get(trimmed);
      }
    }

    // Otherwise, go directly to the node itself
    return () => openNodeHere(node, null);
  }

  /**
   * Prompts the user to choose from the bookmark nodes, then follows
   * the chosen node.
   * Note: the behaviour of this method is expected to change.
   * @returns {void}
   * @see followNode
   */
  function promptToFollowBookmark() {
    const startTime = new Date();
    const nodes = findNodesWithTag(bookmarkTag, getRootNode());
    showElapsedTime(startTime, `Found nodes with ${bookmarkTag} tag`);
    const chosenNode = promptToChooseNode(nodes);
    followNode(chosenNode);
  }

  /**
   * Logs some very basic info about the current document to the console,
   * showing an alert if any tests fail.
   * @returns {void}
   */
  function showShortReport() {
    const rootProject = getRootNode();

    let text = "WorkFlowy report:\n";
    let hasFailed = false;
    let currentTest = null;

    function add(message) {
      text += message + "\n";
    }

    function pass(message) {
      add("[PASS] (" + currentTest + "): " + message);
    }

    function fail(message) {
      add("[FAIL] (" + currentTest + "): " + message);
      hasFailed = true;
    }

    currentTest = "Check platform";
    if (window.IS_IOS) {
      pass("iOS.");
    } else if (window.IS_CHROME) {
      pass("Chrome.");
    } else if (window.IS_FIREFOX) {
      pass("Firefox.");
    } else {
      fail("Running in unknown platform.");
    }

    currentTest = "Count starred pages";
    if (window.IS_IOS) {
      pass("Skipping starred pages check: not available on this platform.");
    } else if (window.IS_CHROME || window.IS_FIREFOX) {
      const starredLocationsCount = window.getStarredLocations().length;
      pass("Starred locations found: " + starredLocationsCount);
    }

    currentTest = "Count total nodes";
    let totalNodes = 0;
    applyToEachNode(() => totalNodes++, rootProject);
    pass(totalNodes + ".");

    // eslint-disable-next-line no-console
    console.log(text);
    if (hasFailed) {
      alert(text);
    }
  }

  function searchZoomedAndMostRecentlyEdited() {
    const recentNode = findRecentlyEditedNodes(0, 1, getRootNode())[0];
    const zoomedNode = getZoomedNode();
    const newZoom = findClosestCommonAncestor(recentNode, zoomedNode);
    const searchText = nodesToSearchTermText([recentNode, zoomedNode]);
    openNodeHere(newZoom, searchText);
  }

  // Note: this function is based on https://jsfiddle.net/timdown/cCAWC/3/
  function insertTextAtCursor(text) {
    let sel, range;
    if (getSelection) {
      sel = getSelection();
      if (sel.getRangeAt && sel.rangeCount) {
        range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        sel.removeAllRanges();
        range = range.cloneRange();
        range.selectNode(textNode);
        range.collapse(false);
        sel.addRange(range);
      }
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

    const customAbbrevs = _buildCustomAbbreviationsMap();
    const allAbbrevs = new Map([...builtInAbbreviationsMap, ...customAbbrevs]);

    const fnOrValue = allAbbrevs.get(abbreviation);
    if (!fnOrValue) {
      return null;
    }
    if (typeof fnOrValue === "function") {
      const expansion = fnOrValue();
      if (!expansion) {
        // eslint-disable-next-line no-console
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
      insertTextAtCursor(expansion);
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
    for (let node of findNodesWithTag(abbrevTag, getRootNode())) {
      const argsText = nodeToTagArgsText(abbrevTag, node);
      if (!argsText) {
        continue;
      }
      const matchResult = argsText.match("^([^ ]+) +([^ ]+.*)");
      if (matchResult) {
        const abbrev = matchResult[1];
        const expansion = matchResult[2];
        if (abbreviationsMap.has(abbrev)) {
          // eslint-disable-next-line no-console
          console.log(`Found multiple ${abbrevTag} definitions for ${abbrev}`);
        }
        abbreviationsMap.set(abbrev, expansion);
      } else {
        // eslint-disable-next-line no-console
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
    } else if ( typeof functionOrValue !== "string") {
      const type = typeof functionOrValue;
      throw `Unsupported type of expansion for ${abbreviation}: ${type}`;
    }
    builtInAbbreviationsMap.set(abbreviation, functionOrValue);
  }

  function _registerKeyboardShortcuts() {
    for (let node of findNodesWithTag(shortcutTag, getRootNode())) {
      const keyCode = nodeToTagArgsText(shortcutTag, node);
      if (!keyCode) {
        continue;
      }
      if (isValidCanonicalCode(keyCode)) {
        registerFunctionForKeyDownEvent(keyCode, nodeToFollowAction(node));
      } else {
        // eslint-disable-next-line no-console
        console.log(`WARN: Invalid keyboard shortcut code: '${keyCode}'.`);
      }
    }
  }

  function _populateMapWithNoArgFunctions(map, functionsArray) {
    for (let f of functionsArray) {
      if (typeof f !== "function") {
        // eslint-disable-next-line no-console
        console.warn("Not a function: " + f);
      } else if (f.length !== 0) {
        // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.log("Cleaning up");

    // Keyboard shortcuts
    document.removeEventListener("keydown", keyDownListener);
    canonicalKeyCodesToActions.clear();
    bindableActionsByName.clear();

    // Built-in expansions
    builtInAbbreviationsMap.clear();

    isCleanedUp = true;
  }

  function setUp() {
    applyToProjectWhenLoaded(() => {
      if (isCleanedUp) {
        return;
      }

      // Keyboard shortcuts
      bindableActionsByName.clear();
      _populateMapWithNoArgFunctions(bindableActionsByName, [
        clickAddButton,
        clickSaveButton,
        dismissWfNotification,
        promptThenWfSearch,
        promptToExpandAndInsertAtCursor,
        promptToFollowBookmark,
        searchZoomedAndMostRecentlyEdited,
        showShortReport,
      ]);
      _registerKeyboardShortcuts();
      document.addEventListener("keydown", keyDownListener);

      // Built-in expansions
      _registerBuiltInExpansion("ymd", todayAsYMDString);
    });
  }

  setUp();

  const nursery = {
    // Alphabetical order
    applyToProjectWhenLoaded: applyToProjectWhenLoaded,
    cleanUp: cleanUp,
    clickAddButton: clickAddButton,
    clickSaveButton: clickSaveButton,
    dateToYMDString: dateToYMDString,
    dismissWfNotification: dismissWfNotification,
    expandAbbreviation: expandAbbreviation,
    findClosestCommonAncestor: findClosestCommonAncestor,
    findRecentlyEditedNodes: findRecentlyEditedNodes,
    findNodesWithTag: findNodesWithTag,
    findTopItemsByComparator: findTopItemsByComparator,
    findTopNodesByScore: findTopNodesByScore,
    followNode: followNode,
    followZoomedNode: followZoomedNode,
    getNodeByLongIdOrInvalid: getNodeByLongIdOrInvalid,
    getZoomedNode: getZoomedNode,
    getZoomedNodeAsLongId: getZoomedNodeAsLongId,
    insertTextAtCursor: insertTextAtCursor,
    isRootNode: isRootNode,
    isValidCanonicalCode: isValidCanonicalCode,
    keyDownEventToCanonicalCode: keyDownEventToCanonicalCode,
    nodeToPathAsNodes: nodeToPathAsNodes,
    nodeToSearchTermText: nodeToSearchTermText,
    nodeToTagArgsText: nodeToTagArgsText,
    nodesToSearchTermText: nodesToSearchTermText,
    nodesToSearchUrl: nodesToSearchUrl,
    openHere: openHere,
    openInNewTab: openInNewTab,
    openNodeHere: openNodeHere,
    promptThenWfSearch: promptThenWfSearch,
    promptToChooseNode: promptToChooseNode,
    promptToExpandAndInsertAtCursor: promptToExpandAndInsertAtCursor,
    promptToFollowBookmark: promptToFollowBookmark,
    registerFunctionForKeyDownEvent: registerFunctionForKeyDownEvent,
    searchZoomedAndMostRecentlyEdited: searchZoomedAndMostRecentlyEdited,
    showElapsedTime: showElapsedTime,
    splitNameOrStringByDoubleQuotes: splitNameOrStringByDoubleQuotes,
    showShortReport: showShortReport,
    stringToTagArgsText: stringToTagArgsText,
    todayAsYMDString: todayAsYMDString,
  };

  ////////////////////////////////////
  // Nursery section ends.
  ////////////////////////////////////

  // Return jumpflowy object
  return {
    // Functions by alphabetical order
    applyToEachNode: applyToEachNode,
    doesNodeNameOrNoteMatch: doesNodeNameOrNoteMatch,
    doesNodeHaveTag: doesNodeHaveTag,
    doesStringHaveTag: doesStringHaveTag,
    findMatchingNodes: findMatchingNodes,
    getCurrentTimeSec: getCurrentTimeSec,
    getRootNode: getRootNode,
    nodeToLastModifiedSec: nodeToLastModifiedSec,
    nodeToPlainTextName: nodeToPlainTextName,
    nodeToPlainTextNote: nodeToPlainTextNote,
    stringToTags: stringToTags,

    // The Nursery namespace
    nursery: nursery
  };
});
