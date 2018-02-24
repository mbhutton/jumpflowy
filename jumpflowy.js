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

  let cleanedUp = false;

  function cleanUp() {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
  }

  const alpha = {
    cleanUp: cleanUp,
    findClosestCommonAncestor: findClosestCommonAncestor,
    getZoomedNodeAsLongId: getZoomedNodeAsLongId,
    isRootNode: isRootNode,
    nodeToPathAsNodes: nodeToPathAsNodes,
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
