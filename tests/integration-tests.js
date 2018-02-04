/*
Integration tests and tests of basic assumptions.

Run these tests in the browser after
loading the expect.js and jumpflowy modules.
*/
/*jshint esversion: 6 */
(function() {
  "use strict";

  /** Tests existence and behaviour of common projectRef functions. */
  function expectProjectRefFunctions(node) {
    expect(node.getName).to.be.a("function");
    expect(node.getNote).to.be.a("function");
    expect(node.getProjectId).to.be.a("function");
    expect(node.getProjectId()).to.be.a("string");
    expect(node.getAncestors).to.be.a("function");
    expect(node.getAncestors()).to.be.an("array");
    expect(node.getChildren).to.be.a("function");
    expect(node.getChildren()).to.be.an("array");
  }

  /** Tests getRootNode, and the projectRef type. */
  function whenUsingGetRootNodeAndProjectRefFunctions() {
    expect(jumpflowy.getRootNode).to.be.a("function");

    expect(project_tree).to.be.an("object");
    expect(project_tree.getMainProjectTree).to.be.a("function");
    const mainProjectTree = project_tree.getMainProjectTree();
    expect(mainProjectTree).to.be.an("object");
    expect(mainProjectTree.getRootProjectReference).to.be.a("function");

    const rootNodeViaTree = mainProjectTree.getRootProjectReference();
    const rootNode = jumpflowy.getRootNode();
    expect(rootNode).to.be.an("object");
    expect(rootNodeViaTree.getProjectId()).to.eql(rootNode.getProjectId());

    expectProjectRefFunctions(rootNode);
    expect(rootNode.getName()).to.eql(null);
    expect(rootNode.getNote()).to.eql(null);
    expect(rootNode.getProjectId()).to.eql("None");
    expect(rootNode.getAncestors().length).to.eql(0);
    expect(rootNode.getChildren().length).to.be.greaterThan(0);

    const firstChildOfRoot = rootNode.getChildren()[0];

    expectProjectRefFunctions(firstChildOfRoot);
    expect(firstChildOfRoot.getName()).not.to.eql(null);
    expect(firstChildOfRoot.getNote()).not.to.eql(null);
    expect(firstChildOfRoot.getProjectId()).to.not.be(rootNode.getProjectId());
    expect(firstChildOfRoot.getAncestors().length).to.eql(1);
    const ancestorOfFirstChild = firstChildOfRoot.getAncestors()[0];
    expect(ancestorOfFirstChild.getProjectId()).to.eql(rootNode.getProjectId());
  }

  function runAllTests() {
    console.log("Starting integration tests.");
    whenUsingGetRootNodeAndProjectRefFunctions();
    console.log("Finished integration tests.");
  }

  expect(jumpflowy).to.be.an("object");
  runAllTests();
})();
