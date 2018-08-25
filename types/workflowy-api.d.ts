//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

declare namespace WF {

  function currentItem(): Item

  function getItemById(id: string): Item

  function getItemNameTags(item: Item): Array<{index: number, tag: string}>

  function getItemNoteTags(item: Item): Array<{index: number, tag: string}>

  function hideMessage(): void

  function rootItem(): Item

  function search(query: string): void

  function starredItems(): Array<Item>

  function zoomTo(item: Item): void

}
