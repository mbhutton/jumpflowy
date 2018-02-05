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
   * @returns {number} The current clock time in seconds since Unix epoch.
   */
  function getCurrentTimeSec() {
    return Math.floor(date_time.getCurrentTimeInMS() / 1000);
  }

  // Return jumpflowy object
  return {
    // Alphabetical order
    applyToEachNode: applyToEachNode,
    findMatchingNodes: findMatchingNodes,
    getCurrentTimeSec: getCurrentTimeSec,
    getRootNode: getRootNode
  };
});
