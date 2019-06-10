//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

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

  function insertText(content: string);

  function hideMessage(): void;

  function moveItems(Items: Item[], newParent: Item, priority: number);

  function rootItem(): Item;

  function search(query: string): void;

  function setItemName(item: Item, content: string);

  function setItemNote(item: Item, content: string);

  function showMessage(html: string, isError?: boolean);

  function toggleCompletedVisible(): void;

  function zoomTo(item: Item): void;
}
