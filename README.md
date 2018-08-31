# JumpFlowy

A Chrome/Firefox user script which adds search, navigation, and keyboard shortcut features to WorkFlowy.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Target audience](#target-audience)
- [Target platforms](#target-platforms)
- [Documentation and examples](#documentation-and-examples)
- [Getting started](#getting-started)
  - [Install the JumpFlowy user script](#install-the-jumpflowy-user-script)
  - [Configuration of triggers and actions](#configuration-of-triggers-and-actions)
    - [Keyboard shortcut triggers](#keyboard-shortcut-triggers)
    - [Bookmark triggers](#bookmark-triggers)
    - [Configuration Examples](#configuration-examples)
    - [Follow actions](#follow-actions)
    - [Suggestions for what to configure](#suggestions-for-what-to-configure)
- [Developing JumpFlowy](#developing-jumpflowy)
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

## Target platforms

- Chrome (macOS/Linux/Windows), via [Tampermonkey](https://tampermonkey.net/index.php)
- Firefox (macOS/Linux/Windows), via [Tampermonkey](https://tampermonkey.net/index.php)
- [HandyFlowy for iOS](https://itunes.apple.com/us/app/handyflowy/id1080279196?mt=8) (with a subset of features)
- Note: Greasemonkey is not supported

## Documentation and examples

The documentation and examples consist of:
- This README file
- A small example [JumpFlowy configuration](https://workflowy.com/s/mMo.Wdwdc5DDD3)

## Getting started

### Install the JumpFlowy user script

- Install [Tampermonkey](https://tampermonkey.net/index.php) in Chrome or Firefox.
- In your browser, open the [JumpFlowy user script](https://github.com/mbhutton/jumpflowy/raw/master/jumpflowy.user.js).
- Install the user script in Tampermonkey.
- Open/reload [WorkFlowy](https://workflowy.com/).

### Configuration of triggers and actions

Configuring JumpFlowy is mostly about binding triggers (e.g. keyboard shortcuts) to actions. You do this by adding an item to your WorkFlowy document, where a tag describes the trigger, and the note describes an (optional) _follow action_.

There are 2 types of trigger:
- keyboard shortcuts, e.g. `#shortcut(ctrl+shift+KeyF)`
- bookmarks, e.g. `#bm(home)`

The trigger takes us to the item which defined that trigger, and then JumpFlowy _follows_ that item, i.e. it performs some _follow action_ based on the contents of the item.

There are 3 types of _follow action_:
- Perform some named function (where the item's text is the name of that function, e.g. `promptToNormalLocalSearch`)
- Go to some other WorkFlowy item (where the item's text is the URL of that WorkFlowy item to go to, e.g. `https://workflowy.com`)
- Go to the item itself (where neither a named function nor WorkFlowy URL are found as defined above)

#### Keyboard shortcut triggers

To add a keyboard trigger, add e.g. `#shortcut(ctrl+shift+KeyF)` to the item you want to follow.

For the available key codes, see this Mozilla's [keyCode reference](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode).

Note: Currently, you'll need to log out and log in again to WorkFlowy (after saving your changes) in order for the keyboard shortcut to take effect. This is a known issue, and a fix is planned.

#### Bookmark triggers

To add a keyboard trigger, add e.g. `#bm(home)` to the item you want to follow to define a bookmark called `home`.

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

A good convention to follow is to put the trigger in the item's text, and the action as the item's note. However, the trigger (`#bm`/`#shortcut`) can be specified anywhere in the item's main text or note. The action must be either the only content in the item's main text, or the only content in the item's note.

#### Follow actions

When following an item, the follow action will be one of:
- Go to the item itself, i.e. zoom into it
- Go to some other item (specify the URL or this other item as this item's note)
- Perform some named function (specify the name of the function as this item's note)

The normal convention for specifying a named function to execute or a URL to follow is to put it as the only content in the item's text.
To be recognised by JumpFlowy, it must be the full text of either the item's main text or the item's note.

For a description of what each of these named functions do, find its comments in [`jumpflowy.user.js`](https://github.com/mbhutton/jumpflowy/blob/master/jumpflowy.user.js).

The available named functions:

- `clickAddButton`
- `dismissNotification`
- `editCurrentItem`
- `editParentOfFocusedItem`
- `logShortReport`
- `openFirstLinkInFocusedItem`
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

## Developing JumpFlowy

### Running the tests

To run the tests, see the instructions at the top of [add-browser-reload.user.js](https://github.com/mbhutton/jumpflowy/blob/master/devtools/add-browser-reload.user.js).

### Linting

- Some static type checking is performed through the use of `VS Code`, by using `JSDoc` function annotations and a `TypeScript` declaration file.
- Linting is done by by `ESLint`.
- `prettier` is used for formatting.

### Contributing

Pull requests and bug reports are very welcome.

## Versioning and backwards compatibility

At this early stage while jumpflowy is still under active development, expect some breaking changes to happen even at minor version changes.

## Authors

- **Matt Hutton** - *Initial work*

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The WorkFlowy team for creating such a great product
- [rawbytz](https://rawbytz.wordpress.com/) for proving what's possible on top of WorkFlowy
- Michinari Yamamoto for creating HandyFlowy, which makes it possible to extend WorkFlowy on mobile
