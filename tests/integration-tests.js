/*
Integration tests and tests of basic assumptions.

Run these tests in the browser after
loading the expect.js and jumpflowy modules.
*/

/* eslint-disable valid-jsdoc */

// ESLint globals:
/* global WF:false */ // From WorkFlowy
/* global toastr:false expect:false jumpflowy:false */ // Others

// Enable TypeScript checking
// @ts-check
/// <reference path="../index.d.ts" />
/// <reference path="../types/workflowy-api.d.ts" />

(function() {
  "use strict";

  /** Tests existence and behaviour of common Item functions. */
  function expectItemFunctions(item) {
    expect(item.getName).to.be.a("function");
    expect(item.getNote).to.be.a("function");
    expect(item.getId).to.be.a("function");
    expect(item.getId()).to.be.a("string");
    expect(item.getAncestors).to.be.a("function");
    expect(item.getAncestors()).to.be.an("array");
    expect(item.getChildren).to.be.a("function");
    expect(item.getChildren()).to.be.an("array");
    expect(item.getNumDescendants).to.be.a("function");
    expect(item.getNumDescendants()).to.be.a("number");
  }

  /** Tests the Item type. */
  function whenUsingItemFunctions() {
    expect(WF.rootItem).to.be.a("function");

    const rootItem = WF.rootItem();
    expect(rootItem).to.be.an("object");

    expectItemFunctions(rootItem);
    expect(rootItem.getName()).to.be("Home");
    expect(rootItem.getNote()).to.be("");
    expect(rootItem.getId()).to.be("None");
    expect(rootItem.getAncestors()).to.be.empty();
    expect(rootItem.getChildren()).to.not.be.empty();

    const firstChildOfRoot = rootItem.getChildren()[0];

    expectItemFunctions(firstChildOfRoot);
    expect(firstChildOfRoot.getName()).not.to.be(null);
    expect(firstChildOfRoot.getNote()).not.to.be(null);
    expect(firstChildOfRoot.getId()).to.not.be(rootItem.getId());
    expect(firstChildOfRoot.getAncestors().length).to.be(1);
    const ancestorOfFirstChild = firstChildOfRoot.getAncestors()[0];
    expect(ancestorOfFirstChild.getId()).to.be(rootItem.getId());

    expect(firstChildOfRoot.getNumDescendants()).to.be.lessThan(
      rootItem.getNumDescendants()
    );
  }

  /** Returns the one and only item with the given note text, or fails. */
  function getUniqueItemByNoteOrFail(noteText) {
    const matches = jumpflowy.findMatchingItems(
      item => jumpflowy.itemToPlainTextNote(item) === noteText,
      WF.rootItem()
    );
    if (matches.length === 0) {
      expect.fail(
        `Couldn't find item with note text matching >>>${noteText}<<<.`
      );
    }
    if (matches.length > 1) {
      expect.fail(
        `Found multiple items with note text matching >>>${noteText}<<<, when expecting exactly 1.`
      );
    }
    return matches[0];
  }

  function getOnlyChildOf(item) {
    if (item === null) {
      expect.fail("Item was null");
    }
    const children = item.getChildren();
    if (children === null || children.length !== 1) {
      expect.fail("Item has no children or multiple children");
    }
    return children[0];
  }

  /** Tests for applyToEachItem and findMatchingItems functions. */
  function whenUsingFindMatchingItemsAndApplyToEachItem() {
    expect(jumpflowy.applyToEachItem).to.be.a("function");
    expect(jumpflowy.findMatchingItems).to.be.a("function");

    const alwaysTrue = () => true;
    const alwaysFalse = () => false;

    /**
     * @param {Array<Item>} items The items
     * @returns {Array<string | null>} The plain text names of the items
     */
    function mapItemsToPlainTextNames(items) {
      return items.map(item => jumpflowy.itemToPlainTextName(item));
    }

    const searchRoot = getUniqueItemByNoteOrFail(
      "b611674e-b218-9580-ea39-2dda99a0e627"
    );

    const noItems = jumpflowy.findMatchingItems(alwaysFalse, searchRoot);
    expect(noItems).to.be.an("array");
    expect(noItems).to.be.empty();

    const allItems = jumpflowy.findMatchingItems(alwaysTrue, searchRoot);
    const expectedNames = ["search root", "a", "b", "c", "d", "e"];
    expect(allItems.length).to.be(expectedNames.length);
    expect(allItems.length).to.be(searchRoot.getNumDescendants() + 1);
    const actualNames = mapItemsToPlainTextNames(allItems);
    expect(actualNames).to.eql(expectedNames);

    function isNameSingleVowel(item) {
      const name = jumpflowy.itemToPlainTextName(item);
      return name.length === 1 && "aeiouAEIOU".includes(name);
    }
    const itemsWithSingleVowel = jumpflowy.findMatchingItems(
      isNameSingleVowel,
      searchRoot
    );
    expect(mapItemsToPlainTextNames(itemsWithSingleVowel)).to.eql(["a", "e"]);

    // Test that applyToEachItem is applied for each item in order
    const foundNames = Array(0);
    jumpflowy.applyToEachItem(
      item => foundNames.push(item.getName()),
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

  /*
  function whenUsingStringToTags() {
    expect(WF.getItemTags).to.be.a("function");
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
  */

  function whenUsingDoesStringHaveTag() {
    expect(jumpflowy.doesStringHaveTag).to.be.a("function");

    expect(jumpflowy.doesStringHaveTag("#foo", null)).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#FoO", "#fOo")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", "#fool")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#fo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("foo", "#foo")).to.be(false);
    expect(jumpflowy.doesStringHaveTag("#foo", "#foo ")).to.be(true);
    expect(jumpflowy.doesStringHaveTag("#foo", " #foo")).to.be(true);
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

  function whenUsingDoesItemNameOrNoteMatch() {
    expect(jumpflowy.doesItemNameOrNoteMatch).to.be.a("function");

    const parentItem = getUniqueItemByNoteOrFail(
      "test/JumpFlowy/whenUsingDoesItemNameOrNoteMatch"
    );
    const item = getOnlyChildOf(parentItem);
    const fnToTest = jumpflowy.doesItemNameOrNoteMatch;

    expect(fnToTest(t => t === "someName", item)).to.be(true);
    expect(fnToTest(t => t === "someNote", item)).to.be(true);
    expect(fnToTest(t => t === "someName ", item)).to.be(false);
    expect(fnToTest(t => t === "someNote ", item)).to.be(false);
    expect(fnToTest(t => t === "wrong", item)).to.be(false);
  }

  function whenUsingDoesItemHaveTag() {
    expect(jumpflowy.doesItemHaveTag).to.be.a("function");

    const parentItem = getUniqueItemByNoteOrFail(
      "test/JumpFlowy/whenUsingDoesItemHaveTag"
    );
    const item = getOnlyChildOf(parentItem);

    expect(jumpflowy.doesItemHaveTag("#foo", item)).to.be(true);
    expect(jumpflowy.doesItemHaveTag("foo", item)).to.be(false);
    expect(jumpflowy.doesItemHaveTag("@bar", item)).to.be(true);
    expect(jumpflowy.doesItemHaveTag("bar", item)).to.be(false);
    expect(jumpflowy.doesItemHaveTag("#baz", item)).to.be(false);
    expect(jumpflowy.doesItemHaveTag("baz", item)).to.be(false);
  }

  function whenUsingItemToPlainTextName() {
    expect(jumpflowy.itemToPlainTextName).to.be.a("function");
    expect(WF.rootItem().getNameInPlainText).to.be.a("function");

    const item = getUniqueItemByNoteOrFail(
      "test/JumpFlowy/whenUsingItemToPlainTextName"
    );
    expect(jumpflowy.itemToPlainTextName(item)).to.be("applePie");
    const rootItem = WF.rootItem();
    expect(jumpflowy.itemToPlainTextName(rootItem)).to.be("Home");
  }

  function whenUsingItemToPlainTextNote() {
    expect(jumpflowy.itemToPlainTextNote).to.be.a("function");
    expect(WF.rootItem().getNoteInPlainText).to.be.a("function");

    const item = getUniqueItemByNoteOrFail(
      "test/JumpFlowy/whenUsingItemToPlainTextNote"
    );
    const child = item.getChildren()[0];
    expect(jumpflowy.itemToPlainTextNote(child)).to.be("bananaCake");
    const rootItem = WF.rootItem();
    expect(jumpflowy.itemToPlainTextNote(rootItem)).to.be("");
  }

  /** Tests for itemToLastModifiedSec and for assumptions related to it. */
  function whenUsingItemToLastModifiedSec() {
    expect(jumpflowy.itemToLastModifiedSec).to.be.a("function");

    const currentTime = jumpflowy.getCurrentTimeSec();

    function testWorkFlowyAssumptions(item) {
      if (item.getId() === WF.rootItem().getId()) {
        expect(item.getLastModifiedDate()).to.be(null);
      } else {
        expect(item.getLastModifiedDate()).to.be.a(Date);
      }
    }
    testWorkFlowyAssumptions(WF.rootItem());
    testWorkFlowyAssumptions(WF.rootItem().getChildren()[0]);

    function testItem(uuid) {
      const item = getUniqueItemByNoteOrFail(uuid);
      // The expected timestamp is the name of its first child item
      const expectedTimestampStr = item.getChildren()[0].getName();
      const expectedTimestamp = Number(expectedTimestampStr);
      const actualTimestamp = jumpflowy.itemToLastModifiedSec(item);
      expect(actualTimestamp).to.be(expectedTimestamp);
      expect(actualTimestamp).to.be.lessThan(currentTime + 1);
    }
    testItem("7685e7f0-122e-69ff-be9f-e03bcf7d84ca"); // Internal
    testItem("9c6ede17-831d-b04c-7a97-a825f0fd4bf0"); // Embedded

    function testRootItemJoinedDate() {
      const root = WF.rootItem();

      const child = root.getChildren()[0];
      const childLastMod = jumpflowy.itemToLastModifiedSec(child);
      expect(childLastMod).to.be.below(currentTime + 1);
    }
    testRootItemJoinedDate();
  }

  function whenUsingItemToTagArgsText() {
    expect(jumpflowy.itemToTagArgsText).to.be.a("function");

    const parentItem = getUniqueItemByNoteOrFail(
      "test/JumpFlowy/whenUsingItemToTagArgsText"
    );
    const item = getOnlyChildOf(parentItem);
    expect(jumpflowy.itemToTagArgsText("#foo", item)).to.be("a, b, c");
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
      whenUsingItemFunctions();
      whenUsingFindMatchingItemsAndApplyToEachItem();
      whenUsingGetCurrentTimeSec();
      //whenUsingStringToTags();
      whenUsingDoesStringHaveTag();
      whenUsingDoesItemNameOrNoteMatch();
      whenUsingDoesItemHaveTag();
      whenUsingItemToLastModifiedSec();
      whenUsingItemToTagArgsText();
      whenUsingItemToPlainTextName();
      whenUsingItemToPlainTextNote();
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
