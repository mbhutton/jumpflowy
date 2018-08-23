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

type NodePredicate = (node: Item) => boolean;

type NodeHandler = (node: Item) => void;

interface JumpFlowy {
  applyToEachNode(functionToApply: NodeHandler,
                  searchRoot: Item): void;

  doesNodeHaveTag(tagToMatch: string, node: Item): boolean;

  doesNodeNameOrNoteMatch(textPredicate: TextPredicate,
                          node: Item): boolean;

  findMatchingNodes(nodePredicate: NodePredicate,
                    searchRoot: Item): Array<Item>;

  getCurrentTimeSec(): number;

  nodeToLastModifiedSec(node: Item): number;

  nodeToPlainTextName(node: Item): string;

  nodeToPlainTextNote(node: Item): string;

  nursery: Nursery;
}

interface Nursery {
  cleanUp(): void;

  nodeToTagArgsText(tagToMatch: string, node: Item): string;

  stringToTagArgsText(tagToMatch: string, s: string): string;
}

//****************************
// WorkFlowy types
//****************************

interface Item {
  getAncestors(): Array<Item>;

  getChildren(): Array<Item>;

  getName(): string | null;

  getNameInPlainText(): string | null;

  getNote(): string | null;

  getNoteInPlainText(): string | null;

  getNumDescendants(): number;

  getProjectId(): string;

  getProjectTree(): ProjectTree;

  getProjectTreeObject(): ProjectTreeObject;
}

interface ProjectTree {
  getRootProjectReference(): Item;

  dateJoinedTimestampInSeconds: number;

  getProjectReferenceByProjectId(projectId: string): Item;
}

interface ProjectTreeObject {}

declare namespace project_tree {
  function getMainProjectTree(): ProjectTree;
}

declare namespace global_project_tree_object {
  function getLastModified(t: ProjectTreeObject): number;

  function getNameInPlainText(t: ProjectTreeObject): string;

  function getNoteInPlainText(t: ProjectTreeObject): string;
}

declare namespace project_ids {
  function truncateProjectId(s: string): string;
}

declare namespace date_time {
  function getCurrentTimeInMS(): number;
}

type LocationAndTagHandler = (spanStart: number, tagFound: string) => void;

interface LocationHistoryEntry {
  _zoomedProjectId: string;
}

declare namespace location_history {
  function getCurrentLocation(): LocationHistoryEntry;

  function createLocation(zoomedProjectId: string, searchQuery: string | null);
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

interface KeyCode {
  ENTER: number;
}

interface JQueryUi {
  keyCode: KeyCode;
}

// Extend JQuery definition
interface JQueryStatic {
  ui: JQueryUi;
}

declare namespace expect {
  function fail(s: string): void;
}
