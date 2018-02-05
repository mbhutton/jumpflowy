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
    expect(node.getNumDescendants).to.be.a("function");
    expect(node.getNumDescendants()).to.be.a("number");
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
    expect(rootNodeViaTree.getProjectId()).to.be(rootNode.getProjectId());

    expectProjectRefFunctions(rootNode);
    expect(rootNode.getName()).to.be(null);
    expect(rootNode.getNote()).to.be(null);
    expect(rootNode.getProjectId()).to.be("None");
    expect(rootNode.getAncestors()).to.be.empty();
    expect(rootNode.getChildren()).to.not.be.empty();

    const firstChildOfRoot = rootNode.getChildren()[0];

    expectProjectRefFunctions(firstChildOfRoot);
    expect(firstChildOfRoot.getName()).not.to.be(null);
    expect(firstChildOfRoot.getNote()).not.to.be(null);
    expect(firstChildOfRoot.getProjectId()).to.not.be(rootNode.getProjectId());
    expect(firstChildOfRoot.getAncestors().length).to.be(1);
    const ancestorOfFirstChild = firstChildOfRoot.getAncestors()[0];
    expect(ancestorOfFirstChild.getProjectId()).to.be(rootNode.getProjectId());

    expect(firstChildOfRoot.getNumDescendants()).to.be.lessThan(
      rootNode.getNumDescendants()
    );
  }

  /** Returns the one and only node with the given note text, or fails. */
  function getUniqueNodeByNoteOrFail(noteText) {
    const matches = jumpflowy.findMatchingNodes(
      node => node.getNote() === noteText,
      jumpflowy.getRootNode()
    );
    if (matches.length === 0) {
      expect.fail(
        `Couldn't find node with note text matching >>>${noteText}<<<.`
      );
    }
    if (matches.length > 1) {
      expect.fail(
        `Found multiple nodes with note text matching >>>${noteText}<<<, when expecting exactly 1.`
      );
    }
    return matches[0];
  }

  /** Tests for applyToEachNode and findMatchingNodes functions. */
  function whenUsingFindMatchingNodesAndApplyToEachNode() {
    expect(jumpflowy.applyToEachNode).to.be.a("function");
    expect(jumpflowy.findMatchingNodes).to.be.a("function");

    const alwaysTrue = node => true;
    const alwaysFalse = node => false;

    /**
     * @param {Array.projectRef} nodes
     * @returns {Array.string}
     */
    function mapNodesToNames(nodes) {
      return nodes.map(node => node.getName());
    }

    const searchRoot = getUniqueNodeByNoteOrFail(
      "b611674e-b218-9580-ea39-2dda99a0e627"
    );

    const noNodes = jumpflowy.findMatchingNodes(alwaysFalse, searchRoot);
    expect(noNodes).to.be.an("array");
    expect(noNodes).to.be.empty();

    const allNodes = jumpflowy.findMatchingNodes(alwaysTrue, searchRoot);
    const expectedNames = ["search root", "a", "b", "c", "d", "e"];
    expect(allNodes.length).to.be(expectedNames.length);
    expect(allNodes.length).to.be(searchRoot.getNumDescendants() + 1);
    const actualNames = mapNodesToNames(allNodes);
    expect(actualNames).to.eql(expectedNames);

    function isNameSingleVowel(node) {
      const name = node.getName();
      return name.length === 1 && "aeiouAEIOU".includes(name);
    }
    const nodesWithSingleVowel = jumpflowy.findMatchingNodes(
      isNameSingleVowel,
      searchRoot
    );
    expect(mapNodesToNames(nodesWithSingleVowel)).to.eql(["a", "e"]);

    // Test that applyToEachNode is applied for each node in order
    const foundNames = Array(0);
    jumpflowy.applyToEachNode(
      node => foundNames.push(node.getName()),
      searchRoot
    );
    expect(foundNames).to.eql(expectedNames);
  }

  /** Tests for getCurrentTimeSec function. */
  function whenUsingGetCurrentTimeSec() {
    expect(jumpflowy.getCurrentTimeSec).to.be.a("function");
    expect(jumpflowy.getCurrentTimeSec()).to.be.a("number");
    expect(jumpflowy.getCurrentTimeSec()).to.be.greaterThan(1517855243);
    expect(jumpflowy.getCurrentTimeSec()).to.be.lessThan(7287926400); // 2200 A.D.
  }

  function runAllTests() {
    console.log("Starting integration tests.");
    whenUsingGetRootNodeAndProjectRefFunctions();
    whenUsingFindMatchingNodesAndApplyToEachNode();
    whenUsingGetCurrentTimeSec();
    console.log("Finished integration tests.");
  }

  expect(jumpflowy).to.be.an("object");
  runAllTests();
})();
