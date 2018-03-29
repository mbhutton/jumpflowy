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

type NodePredicate = (node: ProjectRef) => boolean;

type NodeHandler = (node: ProjectRef) => void;

interface JumpFlowy {
  applyToEachNode(functionToApply: NodeHandler,
                  searchRoot: ProjectRef): void;

  doesNodeHaveTag(tagToMatch: string, node: ProjectRef): boolean;

  doesNodeNameOrNoteMatch(textPredicate: TextPredicate,
                          node: ProjectRef): boolean;

  doesStringHaveTag(tagToMatch: string, s: string): boolean;

  findMatchingNodes(nodePredicate: NodePredicate,
                    searchRoot: ProjectRef): Array<ProjectRef>;

  getCurrentTimeSec(): number;

  getRootNode(): ProjectRef;

  nodeToLastModifiedSec(node: ProjectRef): number;

  nodeToPlainTextName(node: ProjectRef): string;

  nodeToPlainTextNote(node: ProjectRef): string;

  stringToTags(s: string): Array<string>;

  nursery: Nursery;
}

interface Nursery {
  cleanUp(): void;

  nodeToTagArgsText(tagToMatch: string, node: ProjectRef): string;

  stringToTagArgsText(tagToMatch: string, s: string): string;
}

//****************************
// WorkFlowy types
//****************************

interface ProjectRef {
  getAncestors(): Array<ProjectRef>;

  getChildren(): Array<ProjectRef>;

  getName(): string | null;

  getNote(): string | null;

  getNumDescendants(): number;

  getProjectId(): string;

  getProjectTree(): ProjectTree;

  getProjectTreeObject(): ProjectTreeObject;
}

interface ProjectTree {
  getRootProjectReference(): ProjectRef;

  dateJoinedTimestampInSeconds: number;

  getProjectReferenceByProjectId(projectId: string): ProjectRef;
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

interface Tagging {
  forEachTagInString(s: string,
                     f: LocationAndTagHandler,
                     setToFalse: boolean): void;
}

declare const tagging: Tagging;

interface LocationHistoryEntry {
  _zoomedProjectId: string;
}

declare namespace location_history {
  function getCurrentLocation(): LocationHistoryEntry;
}

//****************************
// Window object
//****************************

interface Window {
  getStarredLocations(): string;

  IS_CHROME: boolean;

  IS_FIREFOX: boolean;

  IS_IOS: boolean;

  tagging: Tagging;

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
