/*
Integration tests and tests of basic assumptions.

Run these tests in the browser after
loading the expect.js and jumpflowy modules.
*/

/* eslint-disable no-console, valid-jsdoc */

// ESLint globals:
/* global project_tree:false global_project_tree_object:false */ // From WorkFlowy
/* global toastr:false expect:false jumpflowy:false */ // Others

(function() {
  "use strict";

  /** Tests existence and behaviour of common ProjectRef functions. */
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
    expect(node.getProjectTreeObject).to.be.a("function");
  }

  /** Tests getRootNode, and the ProjectRef type. */
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
    expect(rootNode.getProjectTreeObject()).to.be(null);

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
    expect(firstChildOfRoot.getProjectTreeObject()).to.be.an("object");
  }

  /** Returns the one and only node with the given note text, or fails. */
  function getUniqueNodeByNoteOrFail(noteText) {
    const matches = jumpflowy.findMatchingNodes(
      node => jumpflowy.nodeToPlainTextNote(node) === noteText,
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

  function getOnlyChildOf(node) {
    if (node === null) {
      expect.fail("Node was null");
    }
    const children = node.getChildren();
    if (children === null || children.length !== 1) {
      expect.fail("Node has no children or multiple children");
    }
    return children[0];
  }

  /** Tests for applyToEachNode and findMatchingNodes functions. */
  function whenUsingFindMatchingNodesAndApplyToEachNode() {
    expect(jumpflowy.applyToEachNode).to.be.a("function");
    expect(jumpflowy.findMatchingNodes).to.be.a("function");

    const alwaysTrue = () => true;
    const alwaysFalse = () => false;

    /**
     * @param {Array<ProjectRef>} The nodes
     * @returns {Array<string | null>} The plain text names of the nodes
     */
    function mapNodesToPlainTextNames(nodes) {
      return nodes.map(node => jumpflowy.nodeToPlainTextName(node));
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
    const actualNames = mapNodesToPlainTextNames(allNodes);
    expect(actualNames).to.eql(expectedNames);

    function isNameSingleVowel(node) {
      const name = jumpflowy.nodeToPlainTextName(node);
      return name.length === 1 && "aeiouAEIOU".includes(name);
    }
    const nodesWithSingleVowel = jumpflowy.findMatchingNodes(
      isNameSingleVowel,
      searchRoot
    );
    expect(mapNodesToPlainTextNames(nodesWithSingleVowel)).to.eql(["a", "e"]);

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
    expect(jumpflowy.getCurrentTimeSec()).to.be.within(1517855243, 7287926400);
  }

  function whenUsingStringToTags() {
    expect(window.tagging.forEachTagInString).to.be.a("function");
    expect(jumpflowy.stringToTags).to.be.a("function");

    expect(jumpflowy.stringToTags(null)).to.eql([]);
    expect(jumpflowy.stringToTags("#foo @bar")).to.eql(["#foo", "@bar"]);
    expect(jumpflowy.stringToTags("#foo #foo")).to.eql(["#foo", "#foo"]);
    expect(jumpflowy.stringToTags("#@foo")).to.eql([]);
    expect(jumpflowy.stringToTags("@#foo")).to.eql([]);
    expect(jumpflowy.stringToTags("#foo(1,2) ")).to.eql(["#foo"]);

    for (let tagStart of "#@") {
      const baseTag = tagStart + "foo";
      // Expect these characters to be a part of a tag
      for (let c of "-_") {
        const tagToMatch = baseTag + c + "1";
        expect(jumpflowy.stringToTags(` ${tagToMatch} `)).to.eql([tagToMatch]);
      }

      // Expect these characters to indicate the end of a tag
      for (let c of "!()[];',/?. ") {
        expect(jumpflowy.stringToTags(` ${baseTag}${c} `)).to.eql([baseTag]);
        expect(jumpflowy.stringToTags(` ${baseTag}${c}1 `)).to.eql([baseTag]);
      }

      // Expect these characters to be part of the tag, except when used as a suffix.
      for (let c of ":") {
        expect(jumpflowy.stringToTags(` ${baseTag}${c} `)).to.eql([baseTag]);
        expect(jumpflowy.stringToTags(` ${baseTag}${c}1 `)).to.eql([
          baseTag + c + 1
        ]);
      }

      // Expect these characters to prevent matching of the tag
      for (let c of '`@#$&%^*=+{}|<>\\"') {
        const tagsFound = jumpflowy.stringToTags(` ${baseTag}${c} `);
        expect(tagsFound).to.be.empty();
      }
    }
  }

  function whenUsingDoesStringHaveTag() {
    expect(jumpflowy.doesStringHaveTag).to.be.a("function");

    expect(jumpflowy.doesStringHaveTag("#foo", null)).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", "#fool")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#fo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("foo", "#foo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo ")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", " #foo ")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", " #foo ")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("@foo", "@foo")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", "@foo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("@foo", "#foo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo:1", "#foo:1")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo:")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo: ", "#foo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo ", "#foo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo()")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo(a,b)")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo (a, b)")).to.be(true);
  }

  function whenUsingDoesNodeNameOrNoteMatch() {
    expect(jumpflowy.doesNodeNameOrNoteMatch).to.be.a("function");

    const parentNode = getUniqueNodeByNoteOrFail(
      "test/JumpFlowy/whenUsingDoesNodeNameOrNoteMatch"
    );
    const node = getOnlyChildOf(parentNode);
    const fnToTest = jumpflowy.doesNodeNameOrNoteMatch;

    expect(fnToTest(t => t === "someName", node)).to.be(true);
    expect(fnToTest(t => t === "someNote", node)).to.be(true);
    expect(fnToTest(t => t === "someName ", node)).to.be(false);
    expect(fnToTest(t => t === "someNote ", node)).to.be(false);
    expect(fnToTest(t => t === "wrong", node)).to.be(false);
  }

  function whenUsingDoesNodeHaveTag() {
    expect(jumpflowy.doesNodeHaveTag).to.be.a("function");

    const parentNode = getUniqueNodeByNoteOrFail(
      "test/JumpFlowy/whenUsingDoesNodeHaveTag"
    );
    const node = getOnlyChildOf(parentNode);

    expect(jumpflowy.doesNodeHaveTag("#foo", node)).to.be(true);
    expect(jumpflowy.doesNodeHaveTag("foo", node)).to.be(false);
    expect(jumpflowy.doesNodeHaveTag("@bar", node)).to.be(true);
    expect(jumpflowy.doesNodeHaveTag("bar", node)).to.be(false);
    expect(jumpflowy.doesNodeHaveTag("#baz", node)).to.be(false);
    expect(jumpflowy.doesNodeHaveTag("baz", node)).to.be(false);
  }

  function whenUsingNodeToPlainTextName() {
    expect(jumpflowy.nodeToPlainTextName).to.be.a("function");
    expect(global_project_tree_object.getNameInPlainText).to.be.a("function");

    const node = getUniqueNodeByNoteOrFail(
      "test/JumpFlowy/whenUsingNodeToPlainTextName"
    );
    expect(jumpflowy.nodeToPlainTextName(node)).to.be("applePie");
    const rootNode = jumpflowy.getRootNode();
    expect(jumpflowy.nodeToPlainTextName(rootNode)).to.be("");
  }

  function whenUsingNodeToPlainTextNote() {
    expect(jumpflowy.nodeToPlainTextNote).to.be.a("function");
    expect(global_project_tree_object.getNoteInPlainText).to.be.a("function");

    const node = getUniqueNodeByNoteOrFail(
      "test/JumpFlowy/whenUsingNodeToPlainTextNote"
    );
    const child = node.getChildren()[0];
    expect(jumpflowy.nodeToPlainTextNote(child)).to.be("bananaCake");
    const rootNode = jumpflowy.getRootNode();
    expect(jumpflowy.nodeToPlainTextNote(rootNode)).to.be("");
  }

  /** Tests for nodeToLastModifiedSec and for assumptions related to it. */
  function whenUsingNodeToLastModifiedSec() {
    expect(jumpflowy.nodeToLastModifiedSec).to.be.a("function");

    const currentTime = jumpflowy.getCurrentTimeSec();

    function testWfAssumptions(node) {
      const tree = node.getProjectTree();
      expect(tree).to.not.be(null);
      expect(tree.dateJoinedTimestampInSeconds).to.be.a("number");
      const treeObject = node.getProjectTreeObject();
      const global_tree_obj = global_project_tree_object;
      expect(global_tree_obj.getLastModified).to.be.a("function");

      if (node.getProjectId() === jumpflowy.getRootNode().getProjectId()) {
        expect(treeObject).to.be(null);
      } else {
        expect(global_tree_obj.getLastModified(treeObject)).to.be.a("number");
      }
    }
    testWfAssumptions(jumpflowy.getRootNode());
    testWfAssumptions(jumpflowy.getRootNode().getChildren()[0]);

    function testNode(uuid) {
      const node = getUniqueNodeByNoteOrFail(uuid);
      // The expected timestamp is the name of its first child node
      const expectedTimestampStr = node.getChildren()[0].getName();
      const expectedTimestamp = Number(expectedTimestampStr);
      const actualTimestamp = jumpflowy.nodeToLastModifiedSec(node);
      expect(actualTimestamp).to.be(expectedTimestamp);
      expect(actualTimestamp).to.be.lessThan(currentTime + 1);
    }
    testNode("7685e7f0-122e-69ff-be9f-e03bcf7d84ca"); // Internal
    testNode("9c6ede17-831d-b04c-7a97-a825f0fd4bf0"); // Embedded

    function testRootNodeJoinedDate() {
      const root = jumpflowy.getRootNode();
      const joinedAt = root.getProjectTree().dateJoinedTimestampInSeconds;
      expect(jumpflowy.nodeToLastModifiedSec(root)).to.be(joinedAt);

      const child = root.getChildren()[0];
      const childJoinedAt = child.getProjectTree().dateJoinedTimestampInSeconds;
      const childLastMod = jumpflowy.nodeToLastModifiedSec(child);
      expect(childLastMod).to.be.within(childJoinedAt, currentTime + 1);
    }
    testRootNodeJoinedDate();
  }

  function whenUsingNodeToTagArgsText() {
    expect(jumpflowy.nodeToTagArgsText).to.be.a("function");

    const parentNode = getUniqueNodeByNoteOrFail(
      "test/JumpFlowy/whenUsingNodeToTagArgsText"
    );
    const node = getOnlyChildOf(parentNode);
    expect(jumpflowy.nodeToTagArgsText("#foo", node)).to.be(
      "a, b, c"
    );
  }

  function whenUsingStringToTagArgsText() {
    expect(jumpflowy.stringToTagArgsText).to.be.a("function");

    const fnToTest = jumpflowy.stringToTagArgsText;

    expect(fnToTest("#foo", null)).to.be(null);
    expect(fnToTest("#foo", "#foo")).to.be(null);
    expect(fnToTest("#foo", "#foo #bar(1,2)")).to.be(null);
    expect(fnToTest("#foo", "#foo-(1,2)")).to.be(null);
    expect(fnToTest("#foo", "#foo(1)")).to.be("1");
    expect(fnToTest("#foo", "#foo (1)")).to.be("1");
    expect(fnToTest("#foo", "#foo( 1) ")).to.be("1");
    expect(fnToTest("#foo", "#foo(1 ) ")).to.be("1");
    expect(fnToTest("#foo", "#foo ( 1 2 ) ")).to.be("1 2");
    expect(fnToTest("#foo", "#foo ( 1, b ) ")).to.be("1, b");
    expect(fnToTest("@foo", "@foo(1 ) ")).to.be("1");
    expect(fnToTest("#foo", "#foo(bar, baz)")).to.be("bar, baz");
    expect(fnToTest("#foo", "#foo('bar)', baz')")).to.be("'bar");
    expect(fnToTest("#foo", "#foo()")).to.be("");
  }

  function toastrIfAvailable(message, methodName) {
    if (typeof toastr !== "undefined" && toastr !== null) {
      if (typeof toastr[methodName] === "function") {
        toastr[methodName](message);
      } else {
        toastr.info(`${methodName}: ${message}`);
        const errorMessage = "Invalid toastr level: " + methodName;
        toastr.error(errorMessage);
        console.error(errorMessage);
      }
    }
  }

  function showInfo(message) {
    console.info(message);
    toastrIfAvailable(message, "info");
  }

  function showSuccess(message) {
    console.info(message);
    toastrIfAvailable(message, "success");
  }

  function showError(message) {
    console.error(message);
    toastrIfAvailable(message, "error");
  }

  function runAllTests() {
    showInfo("Starting tests...");
    try {
      whenUsingGetRootNodeAndProjectRefFunctions();
      whenUsingFindMatchingNodesAndApplyToEachNode();
      whenUsingGetCurrentTimeSec();
      whenUsingStringToTags();
      whenUsingDoesStringHaveTag();
      whenUsingDoesNodeNameOrNoteMatch();
      whenUsingDoesNodeHaveTag();
      whenUsingNodeToLastModifiedSec();
      whenUsingNodeToTagArgsText();
      whenUsingNodeToPlainTextName();
      whenUsingNodeToPlainTextNote();
      whenUsingStringToTagArgsText();
      showSuccess("SUCCESS: Tests passed.");
    } catch (error) {
      showError("FAILURE: Tests failed: " + error.message);
      throw error;
    }
  }

  expect(jumpflowy).to.be.an("object");
  runAllTests();
})();
