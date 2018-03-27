/*
Reimports JumpFlowy into HandyFlowy.

This utility assists in reimporting the JumpFlowy script
into HandyFlowy, by downloading the current version then adding
a temporary button which the user clicks to import the script.

The reason for the button is that import URLs don't work if
opened directly via an AJAX callback, but they do work if invoked
from a button click handler.

Caveat: opening a HandyFlowy import URL will always add a new version
of the script to the bottom of the extension scripts list rather than
finding and updating the previous version in place. An alert reminds the
user to remove the old version and to move the new version into place.
*/

//ESLint globals:
/* global webkit:false */

(function() {
  const baseUrl = "https://bitbucket.org/mbhutton/jumpflowy/raw/";
  const gitBranch = "master";
  const jumpflowyPath = "/jumpflowy.user.js";

  function showToast(text) {
    webkit.messageHandlers.Toast.postMessage(text);
  }

  function scriptToHandyFlowyImportUrl(scriptName, javascript) {
    const escapedName = encodeURIComponent(scriptName);
    const escapedScript = encodeURIComponent(javascript);
    return `handyflowy://import?name=${escapedName}&script=${escapedScript}`;
  }

  function importScriptIntoHandyFlowy(scriptName, javascript) {
    const importUrl = scriptToHandyFlowyImportUrl(scriptName, javascript);
    try {
      // Note: alert *before* opening the URL, to avoid crashing HandyFlowy
      alert("Afterwards, move new script and remove its older versions");
      open(importUrl);
    } catch (er) {
      alert("Failed to open import URL due to error: " + er.message);
    }
  }

  function addReimportIntoHandyFlowyButton(scriptName, javascript) {
    const button = document.createElement("button");
    const buttonText = "Reimport";
    button.innerHTML = `<div>${buttonText}</div>`;
    const header = document.getElementById("header");
    if (header !== null) {
      header.appendChild(button);
    } else {
      document.body.appendChild(button);
    }
    button.onclick = function() {
      button.remove();
      importScriptIntoHandyFlowy(scriptName, javascript);
    };
    showToast(`Click ${buttonText} button`);
  }

  function reimportIntoHandyFlowy() {
    const request = new XMLHttpRequest();
    const fullUrl = baseUrl + gitBranch + jumpflowyPath;
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        if (
          request.status === 200 &&
          (this.responseType === "" || request.responseType === "text")
        ) {
          addReimportIntoHandyFlowyButton("JumpFlowy", request.responseText);
        } else {
          alert(`HTTP request failed: ${request.status} ${request.statusText}`);
        }
      }
    };
    request.open("GET", fullUrl);
    request.send();
  }

  reimportIntoHandyFlowy();
})();
