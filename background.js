// 存储源标签页信息
let sourceTab = null;

// 监听扩展图标的点击事件
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 保存源标签页信息
    sourceTab = tab;

    // 保存当前窗口的位置和大小
    const currentWindow = await chrome.windows.getCurrent();

    // 检查是否已经打开了控制面板
    const tabs = await chrome.tabs.query({});
    const existingPopup = tabs.find(t => t.url && t.url.includes('monitor.html'));

    if (existingPopup) {
      // 如果已经打开，就切换到该窗口
      const popup = await chrome.windows.get(existingPopup.windowId);
      if (popup) {
        await chrome.windows.update(popup.id, {
          focused: true,
          width: 850,
          height: 700,
          left: currentWindow.left + 50,
          top: currentWindow.top + 50
        });
        return;
      }
    }

    // 创建新的弹出窗口
    const newPopup = await chrome.windows.create({
      url: chrome.runtime.getURL('monitor.html'),
      type: 'popup',
      width: 850,
      height: 700,
      left: currentWindow.left + 50,
      top: currentWindow.top + 50
    });

    // 等待新窗口加载完成
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (info.status === 'complete' && tabId === newPopup.tabs[0].id) {
        // 发送源标签信息给新窗口
        chrome.tabs.sendMessage(tabId, {
          action: "initializeSourceTab",
          sourceTab: sourceTab
        });
        // 移除监听器
        chrome.tabs.onUpdated.removeListener(listener);
      }
    });
  } catch (error) {
    console.error('创建弹出窗口时发生错误:', error);
  }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSourceTab") {
    sendResponse({ sourceTab: sourceTab });
    return true;
  }
});

// 监听标签页关闭事件，清理数据
chrome.tabs.onRemoved.addListener((tabId) => {
  if (sourceTab && sourceTab.id === tabId) {
    sourceTab = null;
  }
});
