// ==UserScript==
// @name         Add JumpFlowy reload button
// @namespace    https://bitbucket.org/mbhutton/jumpflowy
// @version      0.1.0.2
// @description  Add button to reload JumpFlowy scripts from localhost server
// @author       Matt Hutton
// @match        https://workflowy.com*
// @grant        none
// @run-at       document-end
// @downloadURL  https://bitbucket.org/mbhutton/jumpflowy/raw/master/devtools/add-browser-reload.js
// ==/UserScript==

/*
  A utility to semi-automate reloading of jumpflowy.js and integration tests,
  by providing a button, a keyboard shortcut and a function to reload both
  from a local web server.

  To use this:

  (1) At the root of the jumpflowy source tree, run e.g.:
      > (cd ~/git/jumpflowy && python3 -m http.server 17362)
      The port must match the port used elsewhere in this script.

  (2) Run ngrok http 17362, and note the generated ngrok URL.

  (3) Run this script once in the Chrome console to add the reload button.

  (4) Run the script once in HandyFlowy to do the same.

  (5) To reload each time, either: type reloadJumpFlowy() in the console,
      or press ctrl-r when focused on the WF doc,
      or click the reload scripts button.

  (6) To clean up:
      - Stop the ngrok tunnel
      - Stop the HTTP server
      - Reload WorkFlowy
      - Reload HandyFlowy

*/

/* eslint-disable no-console */

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
    loadCss(hostPort + "/node_modules/toastr/build/toastr.css");
    await pause(100);
    loadScript(hostPort + "/node_modules/toastr/toastr.js");
    await pause(100);

    showInfo(`Reloading scripts from ${hostPort}`);

    loadScript(hostPort + "/node_modules/expect.js/index.js");
    await pause(100);
    loadScript(hostPort + "/jumpflowy.js");
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
    if (typeof window.toastr !== "undefined" && window.toastr !== null) {
      if (typeof window.toastr[methodName] === "function") {
        window.toastr[methodName](message);
      } else {
        window.toastr.info(`${methodName}: ${message}`);
        const errorMessage = "Invalid toastr level: " + methodName;
        window.toastr.error(errorMessage);
        console.error(errorMessage);
      }
    }
  }

  function showInfo(message) {
    console.info(message);
    toastrIfAvailable(message, "info");
  }

  if (window.IS_CHROME) {
    hostPort = "http://localhost:17362";

    addReloadButton();
    addReloadFunction();

    // Wait a while before adding the reload shortcut,
    // as window.IS_MAC_OS isn't set immediately.
    setTimeout(() => {
      if (window.IS_MAC_OS) {
        addShortcut();
      } else {
        console.log("Not macOS, so not adding ctrl-r reloading shortcut.");
      }
    }, 4000);
  } else if (window.IS_MOBILE) {
    // HandyFlowy
    const rawAnswer = prompt("Reload from which ngrok URL?");
    if (rawAnswer !== null && rawAnswer !== "") {
      const answer = rawAnswer.trim();
      if (answer.match("^https://[0-9a-f]+\\.ngrok\\.io$")) {
        hostPort = answer;
        addReloadButton();
      } else {
        alert("Invalid choice of URL: " + answer);
      }
    }
  }
})();
