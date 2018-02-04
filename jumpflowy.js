/*
JumpFlowy: WorkFlowy extension/library for search and navigation.
*/

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

  // Return jumpflowy object
  return {
    getRootNode: getRootNode
  };
});
