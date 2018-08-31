//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

declare namespace WF {

  function createItem(parent: Item, priority: number): ?Item

  function clearSearch(): void

  function currentItem(): Item

  function currentSearchQuery(): string

  function editItemName(item: Item): void

  function editItemNote(item: Item): void

  function focusedItem(): Item

  function getItemById(id: string): Item

  function getItemNameTags(item: Item): Array<{index: number, tag: string}>

  function getItemNoteTags(item: Item): Array<{index: number, tag: string}>

  function insertText(content: string)

  function hideMessage(): void

  function rootItem(): Item

  function search(query: string): void

  function starredItems(): Array<Item>

  function zoomTo(item: Item): void

}
