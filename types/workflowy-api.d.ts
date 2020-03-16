//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

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

declare namespace WF {
  function createItem(parent: Item, priority: number): Item | null;

  function clearSearch(): void;

  function completedVisible(): boolean;

  /**
   * Note: this *toggles* completeness.
   * @param item Item to toggle
   */
  function completeItem(item: Item);

  function currentItem(): Item;

  function currentSearchQuery(): string;

  function deleteItem(item: Item): void;

  function editGroup(callback: () => void);

  function editItemName(item: Item): void;

  function editItemNote(item: Item): void;

  function focusedItem(): Item;

  function getItemById(id: string): Item;

  function getItemNameTags(item: Item): Array<{ index: number; tag: string }>;

  function getItemNoteTags(item: Item): Array<{ index: number; tag: string }>;

  function getSelection(): Item[];

  function insertText(content: string);

  function hideMessage(): void;

  function moveItems(Items: Item[], newParent: Item, priority: number);

  function rootItem(): Item;

  function search(query: string): void;

  function setItemName(item: Item, content: string);

  function setItemNote(item: Item, content: string);

  function setSelection(items: Item[]);

  function showMessage(html: string, isError?: boolean);

  function toggleCompletedVisible(): void;

  function zoomTo(item: Item): void;
}
