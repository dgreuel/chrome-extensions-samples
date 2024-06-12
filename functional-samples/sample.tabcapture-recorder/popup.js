let capturing = chrome.tabs.captureVisibleTab();
capturing.then(onCaptured, onError);
function onCaptured() {
  console.log(capturing);
}
function onError(error) {
  console.log(`Error: ${error}`);
}
