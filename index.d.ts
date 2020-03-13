//****************************************************************************
// This file is not a reference.
// It exists solely to help support TypeScript's static analysis.
//
// This file contains best effort type declarations for JumpFlowy,
// and WorkFlowy's window level variables, added as needed to get jumpflowy.user.js
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

interface NameTreeModule {
  plainAndRichNameOrNoteToNameChain(itemNamePlain: string, itemNameRich: string): string | null;
  itemToNameChain(item: Item): string | null;
  sendToNameTree(): void;
  sendToNameTreeAndClearDateAndComplete(): void;
  reassembleNameTree(): void;
  validateAllNameTrees(): void;
}

interface DateEntry {}

interface DateInterpretation {
  date: Date;
  description: string;
}

interface DatesModule {
  _updateDateOnActiveItemsOrFail(): void;
  clearDate(): void;
  clearFirstDateOnItem(item: Item): void;
  clearFirstDateOnRawString(s: string): string;
  dateToDateEntry(date: Date): DateEntry;
  doesRawStringHaveDates(s: string): boolean;
  failIfMultipleDates(i: Item): void;
  interpretDate(s: string, referenceDate: Date): [DateInterpretation?, string?];
  promptToFindByDateRange(): void;
  setFirstDateOnItem(item: Item, dateEntry: DateEntry): void;
  updateDate(): void;
}

interface ExperimentalUiDecoratorsModule {
  experimentalKeyMotion(): void;
  handleKeyEvent(keyEvent: KeyboardEvent): boolean;
  getItemElements(item: Item): ItemElements;
  overlayGutterCodes(drawOverElement: Element, s: string): Element;
  removeElementFromParent(childElement: Element): void;
}

interface ItemElements {}

interface JumpFlowy {
  nameTree: NameTreeModule;

  dates: DatesModule;

  experimentalUiDecorators: ExperimentalUiDecoratorsModule;

  addBookmark(): void;

  applyToEachItem(functionToApply: ItemHandler, searchRoot: Item): void;

  blurFocusedContent(): void;

  callAfterDocumentLoaded(callbackFn: () => void);

  combinationUpdateDateThenMoveToBookmark(): void;

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

  scheduleDescendants(): void;

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
// Window object
//****************************

interface Window {
  // From WorkFlowy
  blurFocusedContent: () => void;

  // From JumpFlowy
  jumpflowy: JumpFlowy;

  // From WorkFlowy
  WFEventListener: (eventName: string) => void;

  // From JumpFlowy add-browser-reload
  reloadJumpFlowy: (() => void) | null;
}
