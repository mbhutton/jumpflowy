// ==UserScript==
// @name         Example: Count children and descendants of root
// @namespace    https://github.com/mbhutton/jumpflowy
// @version      0.0.0.1
// @description  An example script which shows how to require JumpFlowy
// @author       Matt Hutton
// @match        https://workflowy.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/mbhutton/jumpflowy/raw/master/examples/count-nodes.js
// @require      https://github.com/mbhutton/jumpflowy/raw/master/jumpflowy.user.js
// ==/UserScript==

function showCounts() {
  const root = jumpflowy.getRootNode();
  const childCount = root.getChildren().length;
  const descCount = root.getNumDescendants();
  alert(`Root node has ${childCount} children and ${descCount} descendants.`);
}

// Important: Call your main function after the WorkFlowy project is loaded
jumpflowy.nursery.callAfterProjectLoaded(showCounts);
