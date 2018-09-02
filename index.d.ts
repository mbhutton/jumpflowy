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
  applyToEachItem(functionToApply: ItemHandler,
                  searchRoot: Item): void;

  cleanUp(): void;

  doesItemHaveTag(tagToMatch: string, item: Item): boolean;

  doesItemNameOrNoteMatch(textPredicate: TextPredicate,
                          item: Item): boolean;

  doesStringHaveTag(tagToMatch: string, s: string): boolean

  findMatchingItems(itemPredicate: ItemPredicate,
                    searchRoot: Item): Array<Item>;

  getCurrentTimeSec(): number;

  itemToLastModifiedSec(item: Item): number;

  itemToPlainTextName(item: Item): string;

  itemToPlainTextNote(item: Item): string;

  itemToTagArgsText(tagToMatch: string, item: Item): string;

  stringToTagArgsText(tagToMatch: string, s: string): string;
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

  isCompleted(): boolean;
}

//****************************
// Window object
//****************************

interface Window {
  IS_CHROME: boolean;

  IS_FIREFOX: boolean;

  IS_IOS: boolean;

  jumpflowy: JumpFlowy;
}

//****************************
// UMD pattern
//****************************

declare function define(dependencies: Array<any>, moduleFactory: any): void;

declare namespace define {
  const amd: boolean;
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
