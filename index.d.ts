//****************************************************************************
// This file is not a reference.
// It exists solely to help support TypeScript's static analysis.
//
// This file contains best effort type declarations for JumpFlowy,
// WorkFlowy, and third party packages, added as needed to get jumpflowy.user.js
// and the integration tests to pass type checks.
//
// The authoritative type definitions for JumpFlowy itself are
// annotated in JSDoc on the functions definitions in jumpflowy.user.js.
//****************************************************************************

//****************************
// JumpFlowy types
//****************************

declare const jumpflowy: JumpFlowy;

type TextPredicate = (s: string) => boolean;

type ItemPredicate = (item: Item) => boolean;

type ItemHandler = (item: Item) => void;

interface JumpFlowy {
  applyToEachItem(functionToApply: ItemHandler, searchRoot: Item): void;

  callAfterDocumentLoaded(callbackFn: () => void);

  createItemAtTopOfCurrent(): void;

  cleanUp(): void;

  dateToYMDString(Date): string;

  deleteFocusedItemIfNoChildren(): void;

  dismissNotification(): void;

  doesItemHaveTag(tagToMatch: string, item: Item): boolean;

  doesItemNameOrNoteMatch(textPredicate: TextPredicate, item: Item): boolean;

  doesStringHaveTag(tagToMatch: string, s: string): boolean;

  editCurrentItem(): void;

  editParentOfFocusedItem(): void;

  expandAbbreviation(abbreviation: string): string;

  findClosestCommonAncestor(itemA: Item, itemB: Item): Item;

  findItemsMatchingRegex(regExp: RegExp, searchRoot: Item): Array<Item>;

  findItemsWithTag(tag: string, searchRoot: Item): Array<Item>;

  findMatchingItems(
    itemPredicate: ItemPredicate,
    searchRoot: Item
  ): Array<Item>;

  findRecentlyEditedItems(
    earliestModifiedSec: number,
    maxSize: number,
    searchRoot: Item
  ): Array<Item>;

  findTopItemsByComparator<T>(
    isABetterThanB: (a: T, b: T) => boolean,
    maxSize: number,
    items: Iterable<T>
  ): Array<T>;

  findTopItemsByScore(
    itemToScoreFn: (Item) => number,
    minScore: number,
    maxSize: number,
    searchRoot: Item
  ): Array<Item>;

  followItem(item: Item): void;

  followZoomedItem(): void;

  getCurrentTimeSec(): number;

  getZoomedItem(): Item;

  getZoomedItemAsLongId(): string;

  isRootItem(item: Item): boolean;

  isValidCanonicalCode(canonicalCode: string): void;

  itemsToVolatileSearchQuery(items: Array<Item>): string;

  itemToHashSegment(item: Item): string;

  itemToLastModifiedSec(item: Item): number;

  itemToPathAsItems(item: Item): Array<Item>;

  itemToPlainTextName(item: Item): string;

  itemToPlainTextNote(item: Item): string;

  itemToTagArgsText(tagToMatch: string, item: Item): string;

  itemToTags(item: Item): Array<string>;

  itemToVolatileSearchQuery(item: Item): string;

  keyDownEventToCanonicalCode(keyEvent: KeyboardEvent): string;

  logElapsedTime(startDate: Date, message: string): void;

  logShortReport(): void;

  markFocusedAndDescendantsNotComplete(): void;

  openFirstLinkInFocusedItem(): void;

  openHere(url: string): void;

  openInNewTab(url: string): void;

  zoomToAndSearch(item: Item, searchQuery: string | null): void;

  promptToChooseItem(items: Array<Item>): Item;

  promptToExpandAndInsertAtCursor(): void;

  promptToAddBookmarkForCurrentItem(): void;

  promptToFindGlobalBookmarkThenFollow(): void;

  promptToFindLocalRegexMatchThenZoom(): void;

  promptToNormalLocalSearch(): void;

  showZoomedAndMostRecentlyEdited(): void;

  splitStringToSearchTerms(s: string): string;

  stringToTagArgsText(tagToMatch: string, s: string): string;

  todayAsYMDString(): string;

  validRootUrls: Array<string>;

  workFlowyUrlToHashSegmentAndSearchQuery(url: string): [string, string];
}

//****************************
// WorkFlowy types
//****************************

interface Item {
  childrenAreInSameTree(item: Item);

  getAncestors(): Array<Item>;

  getChildren(): Array<Item>;

  getId(): string;

  getLastModifiedDate(): Date;

  getName(): string | null;

  getNameInPlainText(): string | null;

  getNote(): string | null;

  getNoteInPlainText(): string | null;

  getNumDescendants(): number;

  getParent(): Item;

  getUrl(): string;

  isCompleted(): boolean;
}

//****************************
// Window object
//****************************

interface Window {
  jumpflowy: JumpFlowy;

  WFEventListener: (eventName: string) => void;
}

//****************************
// Types from other packages
//****************************

declare namespace webkit.MessageHandlers.Toast {
  function postMessage(m: string): void;
}

declare namespace expect {
  function fail(s: string): void;
}
