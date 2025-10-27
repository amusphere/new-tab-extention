// 新しいタブが作成されたときの処理
chrome.tabs.onCreated.addListener((tab) => {
  // URLが指定されている場合（リンクを別タブで開いた場合など）はスキップ
  if (tab.url &&
      tab.url !== "chrome://newtab/" &&
      tab.url !== "about:blank" &&
      !tab.url.startsWith("chrome://newtab/")) {
    return;
  }

  // pendingUrlがある場合（読み込み中のURL）もスキップ
  if (tab.pendingUrl &&
      tab.pendingUrl !== "chrome://newtab/" &&
      tab.pendingUrl !== "about:blank" &&
      !tab.pendingUrl.startsWith("chrome://newtab/")) {
    return;
  }

  // 新規タブの場合のみリダイレクト
  if (tab.pendingUrl === "chrome://newtab/" ||
      tab.url === "chrome://newtab/" ||
      !tab.url ||
      tab.url === "about:blank") {

    // カスタムページにリダイレクト
    chrome.tabs.update(tab.id, {
      url: chrome.runtime.getURL("newtab.html")
    });
  }
});

// タブが更新されたときの処理（ワークスペース設定をオーバーライド）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url &&
      (changeInfo.url.includes("chrome://newtab/") ||
       changeInfo.url === "about:blank")) {

    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL("newtab.html")
    });
  }
});
