**Note: _This library / user script is currently broken._ It was based on non-public APIs which have changed.**

# JumpFlowy

An unofficial JavaScript library for WorkFlowy, and a Chrome/Firefox user script which adds search, navigation, and keyboard shortcut features to WorkFlowy.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Target audience](#target-audience)
- [Target platforms](#target-platforms)
- [Documentation and examples](#documentation-and-examples)
- [Getting started as a user script user](#getting-started-as-a-user-script-user)
  - [Install the JumpFlowy user script](#install-the-jumpflowy-user-script)
  - [Configuration of triggers and actions](#configuration-of-triggers-and-actions)
    - [Keyboard shortcut triggers](#keyboard-shortcut-triggers)
    - [Bookmark triggers](#bookmark-triggers)
    - [Configuration Examples](#configuration-examples)
    - [Follow actions](#follow-actions)
    - [Suggestions for what to configure](#suggestions-for-what-to-configure)
- [How to use JumpFlowy as a library](#how-to-use-jumpflowy-as-a-library)
    - [Suggestions for getting started](#suggestions-for-getting-started)
    - [From within your own user script](#from-within-your-own-user-script)
    - [As a UMD (Universal Module Definition) module](#as-a-umd-universal-module-definition-module)
- [Functions](#functions)
    - [Functions in the core `jumpflowy` namespace](#functions-in-the-core-jumpflowy-namespace)
    - [Functions in the `jumpflowy.nursery` namespace](#functions-in-the-jumpflowynursery-namespace)
- [Running the tests](#running-the-tests)
- [Linting](#linting)
- [Contributing](#contributing)
- [Versioning and backwards compatibility](#versioning-and-backwards-compatibility)
- [Authors](#authors)
- [License](#license)
- [Acknowledgments](#acknowledgments)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Target audience

- WorkFlowy users who need more search and navigation capabilities
- JavaScript developers who want to write extensions, bookmarklets, and user-scripts for WorkFlowy

## Target platforms

- Chrome (macOS/Linux/Windows), via [Tampermonkey](https://tampermonkey.net/index.php)
- Firefox (macOS/Linux/Windows), via [Tampermonkey](https://tampermonkey.net/index.php)
- [HandyFlowy for iOS](https://itunes.apple.com/us/app/handyflowy/id1080279196?mt=8) (with a subset of features)
- Note: Greasemonkey is not supported

## Documentation and examples

The documentation and examples consist of:
- This README file
- The documentation on the functions in the `jumpflowy.user.js` file,
  written in JSDoc annotation format with descriptions and type annotations
- A small example [JumpFlowy configuration](https://workflowy.com/s/mMo.Wdwdc5DDD3)
- The example user scripts in the [examples](https://github.com/mbhutton/jumpflowy/tree/master/examples) folder

## Getting started as a user script user

### Install the JumpFlowy user script

- Install [Tampermonkey](https://tampermonkey.net/index.php) in Chrome or Firefox.
- In your browser, open the [JumpFlowy user script](https://github.com/mbhutton/jumpflowy/raw/master/jumpflowy.user.js).
- Install the user script in Tampermonkey.
- Open/reload [WorkFlowy](https://workflowy.com/).

### Configuration of triggers and actions

Configuring JumpFlowy is mostly about binding triggers (e.g. keyboard shortcuts) to actions. You do this by adding a node to your WorkFlowy document, where a tag describes the trigger, and the note describes an (optional) _follow action_.

There are 2 types of trigger:
- keyboard shortcuts, e.g. `#shortcut(ctrl+shift+KeyF)`
- bookmarks, e.g. `#bm(home)`

The trigger takes us to the node which defined that trigger, and then JumpFlowy _follows_ that node, i.e. it performs some _follow action_ based on the contents of the node.

There are 3 types of _follow action_:
- Perform some named function (where the node's text is the name of that function, e.g. `promptToNormalLocalSearch`)
- Go to some other WorkFlowy node (where the node's text is the URL of that WorkFlowy node to go to, e.g. `https://workflowy.com`)
- Go to the node itself (where neither a named function nor WorkFlowy URL are found as defined above)

#### Keyboard shortcut triggers

To add a keyboard trigger, add e.g. `#shortcut(ctrl+shift+KeyF)` to the node you want to follow.

For the available key codes, see this Mozilla's [keyCode reference](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode).

Note: Currently, you'll need to log out and log in again to WorkFlowy (after saving your changes) in order for the keyboard shortcut to take effect. This is a known issue, and a fix is planned.

#### Bookmark triggers

To add a keyboard trigger, add e.g. `#bm(home)` to the node you want to follow to define a bookmark called `home`.

#### Configuration Examples

See this [example configuration](https://workflowy.com/s/mMo.Wdwdc5DDD3).

To use the above configuration as a starting point:
- Install the JumpFlowy user script.
- Copy the configuration section below it into your own WorkFlowy document.
- Edit the configuration according to your needs.
- Log out and in again (a fix is planned, you won't need to do this in future)

This example binds the keyboard shortcut `ctrl+shift+KeyF` to a WorkFlowy search:
- Text: `#shortcut(ctrl+shift+KeyF)`
- Note: `promptToNormalLocalSearch`

This example binds the keyboard shortcut `ctrl+KeyJ` to a bookmark search:
- Text: `#shortcut(ctrl+KeyJ)`
- Note: `promptToFindGlobalBookmarkThenFollow`

This example binds the bookmark `hm` to the root/home of the document.
- Text: `#bm(hm)`
- Note: `https://workflowy.com/`

With the above configuration enabled, you could press `ctrl+KeyJ` to trigger the bookmark search, then type `hm`, `ENTER` to find and follow the `hm` bookmark, which would take you to the root/home of the document.

A good convention to follow is to put the trigger in the node's text, and the action as the node's note. However, the trigger (`#bm`/`#shortcut`) can be specified anywhere in the node's main text or note. The action must be either the only content in the node's main text, or the only content in the node's note.

#### Follow actions

When following a node, the follow action will be one of:
- Go to the node itself, i.e. zoom into it
- Go to some other node (specify the URL or this other node as this node's note)
- Perform some named function (specify the name of the function as this node's note)

The normal convention for specifying a named function to execute or a URL to follow is to put it as the only content in the node's text.
To be recognised by JumpFlowy, it must be the full text of either the node's main text or the node's note.

For a description of what each of these named functions do, find its comments in [`jumpflowy.user.js`](https://github.com/mbhutton/jumpflowy/blob/master/jumpflowy.user.js).

The available named functions:

- `clickAddButton`
- `clickSaveButton`
- `dismissNotification`
- `logShortReport`
- `promptToExpandAndInsertAtCursor`
- `promptToFindGlobalBookmarkThenFollow`
- `promptToFindLocalRegexMatchThenZoom`
- `promptToNormalLocalSearch`
- `showZoomedAndMostRecentlyEdited`

#### Suggestions for what to configure

As a general guide:
- Bind `promptToFindGlobalBookmarkThenFollow` to a convenient key combination, to enable bookmark support.
- Add lots of named bookmarks (`#bm(name)`) to frequently visited locations in your document, updating these as needed.
- Add a handful of keyboard shortcuts (`#shortcut(...)`) to frequently visited locations which don't change (e.g. top level 'work' or 'personal' sections).
- Add bookmarks or shortcuts for some subset of the named functions, just those which seem useful to you.

## How to use JumpFlowy as a library

#### Suggestions for getting started

- Open up the developer console in Chrome/Firefox, and experiment with the functions in the `jumpflowy` and `jumpflowy.nursery` namespaces.
  - Try typing these in the console:
    - `jumpflowy.getRootNode().getNumDescendants()`
    - `zoomed = jumpflowy.nursery.getZoomedNode(); jumpflowy.nodeToPlainTextName(zoomed);`
- Create and add your own user script using Tampermonkey, optionally using one of the example scripts as a starting point.

#### From within your own user script

The easiest way to build your own features on top of JumpFlowy is to write your own Tampermonkey user script, and *@require* the full `jumpflowy.user.js` script.
See the user scripts in the [examples](https://github.com/mbhutton/jumpflowy/tree/master/examples) folder.

#### As a UMD (Universal Module Definition) module

JumpFlowy's implementation follows the UMD pattern. As such, it should be possible to import it as a module using a JavaScript module loader.
Disclaimer: JumpFlowy has not yet been tested/used as a module in this way. Please get in touch (e.g. via a Github issue) if you run into any issues when trying this.

## Functions

See the function comments in [`jumpflowy.user.js`](https://github.com/mbhutton/jumpflowy/blob/master/jumpflowy.user.js) for descriptions, parameter types and returns types for these functions.

#### Functions in the core `jumpflowy` namespace

These are the core functions, which are least likely to change.

- `applyToEachNode`
- `doesNodeHaveTag`
- `doesNodeNameOrNoteMatch`
- `doesStringHaveTag`
- `findMatchingNodes`
- `getCurrentTimeSec`
- `getRootNode`
- `nodeToLastModifiedSec`
- `nodeToPlainTextName`
- `nodeToPlainTextNote`
- `stringToTags`

#### Functions in the `jumpflowy.nursery` namespace

These are newer functions, which are more likely to change than those in the core package.

- `callAfterProjectLoaded`
- `cleanUp`
- `clickAddButton`
- `clickSaveButton`
- `dateToYMDString`
- `dismissNotification`
- `expandAbbreviation`
- `findClosestCommonAncestor`
- `findNodesMatchingRegex`
- `findNodesWithTag`
- `findRecentlyEditedNodes`
- `findTopItemsByComparator`
- `findTopNodesByScore`
- `followNode`
- `followZoomedNode`
- `getNodeByLongIdOrInvalid`
- `getZoomedNode`
- `getZoomedNodeAsLongId`
- `insertTextAtCursor`
- `isRootNode`
- `isValidCanonicalCode`
- `keyDownEventToCanonicalCode`
- `logElapsedTime`
- `logShortReport`
- `nodeToPathAsNodes`
- `nodeToTagArgsText`
- `nodeToVolatileSearchQuery`
- `nodesToVolatileSearchQuery`
- `openHere`
- `openInNewTab`
- `openNodeHere`
- `promptToChooseNode`
- `promptToExpandAndInsertAtCursor`
- `promptToFindGlobalBookmarkThenFollow`
- `promptToFindLocalRegexMatchThenZoom`
- `promptToNormalLocalSearch`
- `registerFunctionForKeyDownEvent`
- `showZoomedAndMostRecentlyEdited`
- `splitStringToSearchTerms`
- `stringToTagArgsText`
- `todayAsYMDString`

## Running the tests

To run the tests, see the instructions at the top of [add-browser-reload.user.js](https://github.com/mbhutton/jumpflowy/blob/master/devtools/add-browser-reload.user.js).

## Linting

- Some static type checking is performed through the use of `VS Code`, by using `JSDoc` function annotations and a `TypeScript` declaration file.
- Linting is done by by `ESLint`.
- `prettier` is used for formatting.

## Contributing

Pull requests and bug reports are very welcome.

## Versioning and backwards compatibility

At this stage, expect some breaking changes to happen even at minor version changes, especially within the `jumpflowy.nursery` namespace. The functions within the `jumpflowy` namespace however are more stable, and less likely to change.

If you need a stable library, then either depend on a release tag, or raise a Github issue stating which nursery function you need to be stabilised.

Released versions are available as [tags in this repository](https://github.com/mbhutton/jumpflowy/tags).

## Authors

- **Matt Hutton** - *Initial work*

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The WorkFlowy team for creating such a great product
- [rawbytz](https://rawbytz.wordpress.com/) for proving what's possible on top of WorkFlowy
- Michinari Yamamoto for creating HandyFlowy, which makes it possible to extend WorkFlowy on mobile
- [Timdown](https://jsfiddle.net/user/timdown/fiddles/) for the JavaScript example of replacing selected text
