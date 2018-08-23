//****************************************************************************
// Type declarations for the public WorkFlowy API, in TypeScript format
//****************************************************************************

declare namespace WF {

  function getItemTags(item: Item): Array<{index: number, tag: string}>

  function rootItem(): Item

  function starredItems(): Array<Item>

}
