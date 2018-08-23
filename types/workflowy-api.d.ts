//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

declare namespace WF {

  function currentItem(): Item

  function getItemTags(item: Item): Array<{index: number, tag: string}>

  function rootItem(): Item

  function search(query: string)

  function starredItems(): Array<Item>

  function zoomTo(item: Item)

}
