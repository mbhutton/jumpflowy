//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

declare namespace WF {
  function createItem(parent: Item, priority: number): Item | null;

  function clearSearch(): void;

  /**
   * Note: this *toggles* completeness.
   * @param item Item to toggle
   */
  function completeItem(item: Item);

  function currentItem(): Item;

  function currentSearchQuery(): string;

  function editGroup(callback: () => void);

  function editItemName(item: Item): void;

  function editItemNote(item: Item): void;

  function focusedItem(): Item;

  function getItemById(id: string): Item;

  function getItemNameTags(item: Item): Array<{ index: number; tag: string }>;

  function getItemNoteTags(item: Item): Array<{ index: number; tag: string }>;

  function insertText(content: string);

  function hideMessage(): void;

  function rootItem(): Item;

  function search(query: string): void;

  function showMessage(html: string, isError?: boolean);

  function zoomTo(item: Item): void;
}
