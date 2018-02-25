/*
JumpFlowy: WorkFlowy extension/library for search and navigation.
*/

// ESLint globals from WorkFlowy:
/*
global project_tree:false tagging:false date_time:false
       global_project_tree_object:false project_ids:false location_history:false
*/

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
   * @param {function} functionToApply The function to apply to each visited node.
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
    tagging.forEachTagInString(s, handleTag, 1);
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

  const _stringToTagArgsText_CallRegExp = RegExp("^ *\\([^\\(\\)]*\\) *$");

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

  /**
   * @param {ProjectRef} node The node
   * @returns {string} The plain text version of the node's name,
   *                   or the empty string if the root node.
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
   *                   or the empty string if the root node.
   */
  function nodeToPlainTextNote(node) {
    const treeObj = node.getProjectTreeObject();
    if (treeObj === null) {
      return ""; // Root node
    }
    return global_project_tree_object.getNoteInPlainText(treeObj);
  }

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
   * @returns {boolean} Whether the given node has the exact given tag, ignoring case.
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
  // Alpha section starts.
  //
  // The code in this section should be considered under development rather
  // than stable: the functionality is expected to change, and the functions
  // do not form a stable API.
  // Functions defined here are exposed via the 'jumpflowy.alpha' namespace.
  // As code here stabilises, it will be moved above this section, with
  // functions moved into the main 'jumpflowy' namespace.
  ////////////////////////////////////

  // Clean up any previous instance of JumpFlowy
  if (
    typeof window.jumpflowy !== "undefined" &&
    typeof window.jumpflowy.alpha !== "undefined" &&
    typeof window.jumpflowy.alpha.cleanUp !== "undefined"
  ) {
    window.jumpflowy.alpha.cleanUp();
  }

  // Global state
  const canonicalCodesToKeyDownFunctions = new Map();

  function openHere(url) {
    open(url, "_self");
  }

  function openNodeHere(node, rawSearchString) {
    const projectId = project_ids.truncateProjectId(node.getProjectId());
    const searchSuffix = toSearchSuffix(rawSearchString);
    openHere(`https://workflowy.com/#/${projectId}${searchSuffix}`);
  }

  /**
   * Prompt for a search string, then perform a normal
   * WorkFlowy search.
   * @returns {void}
   */
  function promptThenWfSearch() {
    $("#searchBox").val(prompt("WorkFlowy search: ", $("#searchBox").val()));
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

  function toSearchSuffix(rawSearchString) {
    if (rawSearchString) {
      const escapedSearchString = encodeURIComponent(rawSearchString);
      return `?q=${escapedSearchString}`;
    } else {
      return "";
    }
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
   * @returns {string | null} The unescaped search term to use for finding the given node,
   *                          or null if this is the root node.
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
    canonicalCodesToKeyDownFunctions.set(canonicalCode, functionToApply);
  }

  function keyDownListener(keyEvent) {
    const canonicalCode = keyDownEventToCanonicalCode(keyEvent);
    const registeredFn = canonicalCodesToKeyDownFunctions.get(canonicalCode);
    if (registeredFn) {
      registeredFn();
      keyEvent.stopPropagation();
      keyEvent.preventDefault();
    }
  }

  /**
   * Cleans up global state maintained by this script.
   * Ok to call multiple times.
   * @returns {void}
   */
  function cleanUp() {
    // eslint-disable-next-line no-console
    console.log("Cleaning up");
    canonicalCodesToKeyDownFunctions.clear();
    document.removeEventListener("keydown", keyDownListener);
  }

  function setUp() {
    document.addEventListener("keydown", keyDownListener);
  }

  setUp();

  const alpha = {
    // Alphabetical order
    cleanUp: cleanUp,
    dismissWfNotification: dismissWfNotification,
    findClosestCommonAncestor: findClosestCommonAncestor,
    findNodesWithTag: findNodesWithTag,
    getZoomedNodeAsLongId: getZoomedNodeAsLongId,
    isRootNode: isRootNode,
    isValidCanonicalCode: isValidCanonicalCode,
    keyDownEventToCanonicalCode: keyDownEventToCanonicalCode,
    nodeToPathAsNodes: nodeToPathAsNodes,
    nodeToSearchTermText: nodeToSearchTermText,
    nodesToSearchTermText: nodesToSearchTermText,
    nodesToSearchUrl: nodesToSearchUrl,
    openHere: openHere,
    openNodeHere: openNodeHere,
    promptThenWfSearch: promptThenWfSearch,
    registerFunctionForKeyDownEvent: registerFunctionForKeyDownEvent,
    splitNameOrStringByDoubleQuotes: splitNameOrStringByDoubleQuotes,
  };

  ////////////////////////////////////
  // Alpha section ends.
  ////////////////////////////////////

  // Return jumpflowy object
  return {
    // Alphabetical order
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

    beta: {
      nodeToTagArgsText: nodeToTagArgsText,
      stringToTagArgsText: stringToTagArgsText
    },

    alpha: alpha
  };
});
