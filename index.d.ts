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

interface String {
  /** Removes the leading white space and line terminator characters from a string. */
  trimLeft(): string;

  /** Removes the trailing white space and line terminator characters from a string. */
  trimRight(): string;
}

//****************************
// JumpFlowy types
//****************************

declare const jumpflowy: JumpFlowy;

type TextPredicate = (s: string) => boolean;

type ItemPredicate = (item: Item) => boolean;

type ItemHandler = (item: Item) => void;

interface NameTreeModule {
  plainAndRichNameOrNoteToNameChain(itemNamePlain: string, itemNameRich: string): string | null;
  itemToNameChain(item: Item): string | null;
  sendToNameTree(): void;
  sendToNameTreeAndClearDateAndComplete(): void;
  reassembleNameTree(): void;
  validateAllNameTrees(): void;
}

interface DateEntry {}

interface DateInterpretation {}

interface DatesModule {
  clearDate(): void;
  clearFirstDateOnItem(item: Item): void;
  clearFirstDateOnRawString(s: string): string;
  doesRawStringHaveDates(s: string): boolean;
  failIfMultipleDates(i: Item): void;
  interpretDate(s: string, referenceDate: Date): [DateInterpretation?, string?];
  promptToFindByDateRange(): void;
  updateDate(): void;
}

interface JumpFlowy {
  nameTree: NameTreeModule;

  dates: DatesModule;

  addBookmark(): void;

  applyToEachItem(functionToApply: ItemHandler, searchRoot: Item): void;

  callAfterDocumentLoaded(callbackFn: () => void);

  createOrdinaryLink(): void;

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

  filterMapByKeys<K, V>(keyFilter: (K) => boolean, map: Map<K, V>): Map<K, V>;

  filterMapByValues<K, V>(valueFilter: (V) => boolean, map: Map<K, V>): Map<K, V>;

  findClosestCommonAncestor(itemA: Item, itemB: Item): Item;

  findItemsMatchingRegex(regExp: RegExp, searchRoot: Item): Array<Item>;

  findItemsWithSameText(searchRoot: Item): Map<string, Array<Item>>;

  findItemsWithTag(tag: string, searchRoot: Item): Array<Item>;

  findMatchingItems(itemPredicate: ItemPredicate, searchRoot: Item): Array<Item>;

  findRecentlyEditedItems(earliestModifiedSec: number, maxSize: number, searchRoot: Item): Array<Item>;

  findTopItemsByComparator<T>(isABetterThanB: (a: T, b: T) => boolean, maxSize: number, items: Iterable<T>): Array<T>;

  findTopItemsByScore(
    itemToScoreFn: (Item) => number,
    minScore: number,
    maxSize: number,
    searchRoot: Item
  ): Array<Item>;

  followItem(item: Item): void;

  followZoomedItem(): void;

  getAllBookmarkedItemsByBookmark(): Map<string, Item>;

  getTagsForFilteredItems(itemPredicate: ItemPredicate, searchRoot: Item): Set<string>;

  getCurrentTimeSec(): number;

  getZoomedItem(): Item;

  getZoomedItemAsLongId(): string;

  isRootItem(item: Item): boolean;

  isValidCanonicalCode(canonicalCode: string): void;

  itemsToVolatileSearchQuery(items: Array<Item>): string;

  itemToCombinedPlainText(item: Item): string;

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

  moveToBookmark(): void;

  openFirstLinkInFocusedItem(): void;

  openHere(url: string): void;

  openInNewTab(url: string): void;

  zoomToAndSearch(item: Item, searchQuery: string | null): void;

  promptToChooseItem(items: Array<Item>, promptMessage: string): Item;

  promptToExpandAndInsertAtCursor(): void;

  promptToAddBookmarkForCurrentItem(): void;

  promptToFindGlobalBookmarkThenFollow(): void;

  promptToFindLocalRegexMatchThenZoom(): void;

  promptToNormalLocalSearch(): void;

  promptToFindByLastChanged(): void;

  scatterDescendants(): void;

  showZoomedAndMostRecentlyEdited(): void;

  splitStringToSearchTerms(s: string): string;

  stringToTagArgsText(tagToMatch: string, s: string): string;

  todayAsYMDString(): string;

  toItemMultimapWithSingleKeys<K>(itemFunction: (Item) => K | null, searchRoot: Item): Map<K, Array<Item>>;

  toItemMultimapWithMultipleKeys<K>(itemFunction: (Item) => Array<K> | null, searchRoot: Item): Map<K, Array<Item>>;

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

  getNextVisibleSibling(ignoreSearch?: boolean): Item | null;

  getNote(): string | null;

  getNoteInPlainText(): string | null;

  getNumDescendants(): number;

  getParent(): Item;

  getPriority(): number;

  getUrl(): string;

  isCompleted(): boolean;

  isReadOnly(): boolean;

  // Temporary workaround for WF.createItem() return type
  projectid: string;

  isEmbedded(): boolean;
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

//****************************
// As a workaround, define more modern methods on in-built types here,
// as importing the related *.d.ts files directly causes errors.
//****************************

interface String {
  trimLeft(): string;

  trimRight(): string;
}
