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

  (5) To reload each time, either: type r() in the console, or press ctrl-r
      when focused on the WF doc, or click the reload scripts button.

  (6) To clean up:
      - Stop the ngrok tunnel
      - Stop the HTTP server
      - Reload WorkFlowy
      - Reload HandyFlowy

*/

/* eslint-disable no-console */

(function() {
  "use strict";

  const IS_MAC_OS = window.IS_MAC_OS;
  const IS_CHROME = window.IS_CHROME;
  const IS_MOBILE = window.IS_MOBILE;

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
    // Add button
    var button = document.createElement("button");
    button.innerHTML = "<div>Reload scripts</div>";
    const header = document.getElementById("header");
    if (header !== null) {
      header.appendChild(button);
    } else {
      document.body.appendChild(button);
    }
    button.onclick = reloadScripts;
  }

  function addShortcut() {
    // Add keyboard shortcut ctrl-r (only appropriate on macOS)
    if (IS_MAC_OS) {
      const keyEventHandler = function(keyEvent) {
        if (
          keyEvent.ctrlKey &&
          !keyEvent.shiftKey &&
          !keyEvent.altKey &&
          !keyEvent.metaKey &&
          keyEvent.code === "KeyR"
        ) {
          reloadScripts();
          keyEvent.stopPropagation();
          keyEvent.preventDefault();
        }
      };
      document.addEventListener("keydown", keyEventHandler);
    } else {
      console.log("Not macOS, so not adding ctrl-r reloading shortcut.");
    }
  }

  function addReloadFunction() {
    // Only appropriate in a browser
    if (IS_CHROME) {
      window.r = reloadScripts;
    }
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

  if (IS_CHROME) {
    hostPort = "http://localhost:17362";

    addReloadButton();
    addShortcut();
    addReloadFunction();
  } else if (IS_MOBILE) {
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
