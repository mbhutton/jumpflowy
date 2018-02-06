/*
JumpFlowy: WorkFlowy extension/library for search and navigation.
*/
/*jshint esversion: 6 */

// UMD (Universal Module Definition) boilerplate
(function(root, umdFactory) {
  "use strict";
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define([], umdFactory);
  } else {
    // Browser globals
    root.jumpflowy = umdFactory();
  }
})(typeof self !== "undefined" ? self : this, function() {
  "use strict";
  // JumpFlowy implementation starts

  /**
   * @returns {projectRef} The root node of the WorkFlowy account
   *                       currently logged into.
   */
  function getRootNode() {
    return project_tree.getMainProjectTree().getRootProjectReference();
  }

  /**
   * Applies the given function to the given node
   * and each of its descendants, as a depth first search.
   * @param {function} functionToApply The function to apply to each visited node.
   * @param {projectRef} searchRoot The root node of the search.
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
   * @param {function} nodePredicate A function (projectRef -> boolean) which
   *                                 returns whether or not a node is a match.
   * @param {projectRef} searchRoot The root node of the search.
   * @returns {Array.projectRef} The matching nodes, in order or appearance.
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
   *
   * Note: Tags containing punctuation may produce unexpected results.
   * Suggested best practice: freely use '-' and '_' and ':'
   * as part of tags, being careful to avoid ':' as a suffix.
   *
   * @param {string} s The string to split.
   * @returns {Array.string} An array of tags found in the string.
   */
  function stringToTags(s) {
    const results = Array();
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
   *                    exact given tag, ignoring case.
   * @see {@link stringToTags} For notes, caveats regarding tag handling.
   */
  function doesStringHaveTag(tagToMatch, s) {
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
    if (!doesStringHaveTag(tagToMatch, s)) {
      return false;
    }

    let start = 0;
    while (true) {
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
   * @param {string} tagToMatch The tag to match.
   * @param {projectRef} node The node to extract the args text from.
   * @returns {string} The trimmed arguments string, or null if no call found.
   * @see {@link stringToTagArgsText} For semantics.
   */
  function nodeToTagArgsText(tagToMatch, node) {
    const resultForName = stringToTagArgsText(tagToMatch, node.getName());
    if (resultForName !== null) {
      return resultForName;
    }
    return stringToTagArgsText(tagToMatch, node.getNote());
  }

  /**
   * @param {function} textPredicate The predicate to apply to each string.
   * @param {projectRef} node The node to test.
   * @returns {boolean} Whether textPredicate returns true for either the node's
   *                    name or note.
   */
  function doesNodeNameOrNoteMatch(textPredicate, node) {
    return textPredicate(node.getName()) || textPredicate(node.getNote());
  }

  /**
   * @param {string} tagToMatch The tag to match.
   * @param {projectRef} node The node to test.
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
    nodeToTagArgsText: nodeToTagArgsText,
    stringToTags: stringToTags,
    stringToTagArgsText: stringToTagArgsText
  };
});
