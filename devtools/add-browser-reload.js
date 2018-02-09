/*
  A utility to semi-automate reloading of jumpflowy.js and integration tests,
  by providing a button, a keyboard shortcut and a function to reload both
  from a local web server.

  To use this:

  (1) Run this script once in the Chrome console to add the reload button.

  (2) At the root of the jumpflowy source tree, run e.g.:
      > (cd ~/git/jumpflowy && python3 -m http.server 17362)
      The port must match the port defined in this script.

  (3) To reload each time, either: type r() in the console, or press ctrl-r
      when focused on the WF doc, or click the reload scripts button.
  */

/*jshint esversion: 6 */
(function() {
  "use strict";

  const port = "17362";
  const hostPort = "http://localhost:" + port;

  function loadScript(hostPort, scriptPath) {
    const scriptElement = document.createElement("script");
    const fullPath = hostPort + scriptPath;
    scriptElement.setAttribute("src", fullPath);
    scriptElement.setAttribute("type", "text/javascript");
    document.head.appendChild(scriptElement);
    console.log("Reloaded " + scriptPath);
  }

  function reloadScripts() {
    console.log(`Reloading scripts (from ${hostPort})...`);
    loadScript(hostPort, "/jumpflowy.js");
    loadScript(hostPort, "/node_modules/expect.js/");
    loadScript(hostPort, "/tests/integration-tests.js");
    console.log("Reloaded scripts.");
  }

  function addReloadButtonAndShortcut() {
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

  addReloadButtonAndShortcut();
  addReloadFunction();
  console.log("Run the local web server in the JumpFlowy source root:");
  console.log("  (cd ~/git/jumpflowy && python3 -m http.server  " + port + ")");
})();
