// ==UserScript==
// @name         Add JumpFlowy reload button
// @namespace    https://github.com/mbhutton/jumpflowy
// @version      0.1.0.11
// @description  Add button to reload JumpFlowy scripts from localhost server
// @author       Matt Hutton
// @match        https://workflowy.com/*
// @match        https://beta.workflowy.com/*
// @match        https://dev.workflowy.com/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/mbhutton/jumpflowy/raw/master/devtools/add-browser-reload.user.js
// ==/UserScript==

// ESLint globals:
/* global toastr:false */ // Others

/*
  A utility to assist reloading of jumpflowy.user.js and integration tests,
  by providing a button, a keyboard shortcut and a function to reload both
  from a local web server.

  To set up:

  (1) At the root of the jumpflowy source tree, run e.g.:
      > (cd ~/git/jumpflowy && python3 -m http.server 17362)
      The port must match the port used elsewhere in this script.

  (2) Disable cache in Chrome dev tools under the Network tab.

  (3) Run this script once in the Chrome developer console to add the
      reload button, if not already installed as a user script in Tampermonkey.

  To reload and run the integration tests each time, either:

  (A) Type reloadJumpFlowy() in the console, or
  (B) Press ctrl-r when focused on the WF doc, or
  (C) Click the reload button.

  To clean up:

  (1) Stop the HTTP server
  (2) Re-enable Chrome's cache
  (3) Close and reload WorkFlowy tab in Chrome

*/

(function() {
  "use strict";

  let hostPort;

  function loadScript(fullPath) {
    const scriptElement = document.createElement("script");
    scriptElement.src = fullPath;
    scriptElement.type = "text/javascript";
    document.head.appendChild(scriptElement);
  }

  function loadCss(fullPath) {
    const linkElement = document.createElement("link");
    linkElement.href = fullPath;
    linkElement.type = "text/css";
    linkElement.rel = "stylesheet";
    document.head.appendChild(linkElement);
  }

  async function pause(ms) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  async function reloadScripts() {
    // Load toastr first to show a progress notification
    loadScript(hostPort + "/node_modules/jquery/dist/jquery.min.js");
    await pause(200);
    loadCss(hostPort + "/node_modules/toastr/build/toastr.css");
    await pause(100);
    loadScript(hostPort + "/node_modules/toastr/toastr.js");
    await pause(100);

    showInfo(`Reloading scripts from ${hostPort}`);

    loadScript(hostPort + "/node_modules/expect.js/index.js");
    await pause(100);
    loadScript(hostPort + "/jumpflowy.user.js");
    await pause(100);
    loadScript(hostPort + "/tests/integration-tests.js");
    console.log("Reloaded scripts.");
  }

  function addReloadButton() {
    const button = document.createElement("button");
    button.innerHTML = "<div>Reload scripts</div>";
    const header = document.getElementById("header");
    if (header !== null) {
      header.appendChild(button);
    } else {
      document.body.appendChild(button);
    }
    button.onclick = reloadScripts;
  }

  // Adds keyboard shortcut ctrl-r (only appropriate on macOS)
  function addShortcut() {
    const keyEventHandler = function(keyEvent) {
      if (
        keyEvent.ctrlKey &&
        !keyEvent.shiftKey &&
        !keyEvent.altKey &&
        !keyEvent.metaKey &&
        keyEvent.code === "KeyR"
      ) {
        keyEvent.stopPropagation();
        keyEvent.preventDefault();
        reloadScripts();
      }
    };
    document.addEventListener("keydown", keyEventHandler);
    console.log("Added ctrl-r shortcut for reloading.");
  }

  function addReloadFunction() {
    window.reloadJumpFlowy = reloadScripts;
    console.log("Added reloadJumpFlowy() function to global scope.");
  }

  function toastrIfAvailable(message, methodName) {
    if (typeof toastr !== "undefined" && toastr !== null) {
      if (typeof toastr[methodName] === "function") {
        toastr[methodName](message);
      } else {
        toastr.info(`${methodName}: ${message}`);
        const errorMessage = "Invalid toastr level: " + methodName;
        toastr.error(errorMessage);
        console.error(errorMessage);
      }
    }
  }

  function showInfo(message) {
    console.info(message);
    toastrIfAvailable(message, "info");
  }

  const USER_AGENT = navigator.userAgent;
  const IS_MOBILE =
    USER_AGENT.includes("iPhone") || USER_AGENT.includes("Android");
  if (IS_MOBILE) {
    alert("This script isn't supported on mobile");
  } else {
    hostPort = "http://127.0.0.1:17362";

    addReloadButton();
    addReloadFunction();

    // Wait a while before adding the reload shortcut,
    // as IS_MAC_OS isn't set immediately.
    setTimeout(() => {
      if (USER_AGENT.includes("Mac OS X")) {
        addShortcut();
      } else {
        console.log("Not macOS, so not adding ctrl-r reloading shortcut.");
      }
    }, 4000);
  }
})();
