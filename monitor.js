// 存储所有找到的视频链接
let allVideos = {
  mp4: new Set(),
  m3u8: new Set(),
  ts: new Set()
};

let monitoringInterval = null;
let monitoringTabId = null;

// 监听按钮点击事件
// 获取manifest.json中的作者信息
async function getManifestInfo() {
  const manifest = chrome.runtime.getManifest();
  return {
    author: manifest.author || '',
    email: manifest.email || ''
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  // 页面所有静态文案多语言填充
  document.getElementById('title').textContent = isZh ? '视频八爪鱼' : 'Octopus Video Sniffer';
  document.getElementById('urlInfo').textContent = isZh ? '当前未监控任何页面' : 'No page is being monitored';
  document.getElementById('startScraping').textContent = isZh ? '开始监控' : 'Start Monitoring';
  document.getElementById('stopScraping').textContent = isZh ? '停止监控' : 'Stop Monitoring';
  document.getElementById('exportJson').textContent = isZh ? '导出JSON' : 'Export JSON';
  document.getElementById('resetData').textContent = isZh ? '重置数据' : 'Reset Data';
  document.getElementById('status').textContent = isZh ? '状态: 未开始监控' : 'Status: Not started';
  document.getElementById('mp4Label').textContent = isZh ? 'MP4视频:' : 'MP4 Videos:';
  document.getElementById('m3u8Label').textContent = isZh ? 'M3U8视频:' : 'M3U8 Videos:';
  document.getElementById('tsLabel').textContent = isZh ? 'TS视频:' : 'TS Videos:';
  document.getElementById('totalLabel').textContent = isZh ? '总计:' : 'Total:';

  const startButton = document.getElementById('startScraping');
  const stopButton = document.getElementById('stopScraping');
  const exportButton = document.getElementById('exportJson');
  const resetButton = document.getElementById('resetData');
  const urlInfo = document.getElementById('urlInfo');
  startButton.disabled = true;  // 初始状态下禁用开始按钮

  // 获取并显示作者信息
  const manifestInfo = await getManifestInfo();
  const contactInfo = document.getElementById('contactInfo');
  if (manifestInfo.author || manifestInfo.email) {
    contactInfo.innerHTML = isZh
      ? `<p>作者: ${manifestInfo.author} | 联系方式: <a href="mailto:${manifestInfo.email}">${manifestInfo.email}</a></p><p>© ${new Date().getFullYear()} 视频八爪鱼 版权所有</p>`
      : `<p>Author: ${manifestInfo.author} | Contact: <a href="mailto:${manifestInfo.email}">${manifestInfo.email}</a></p><p>© ${new Date().getFullYear()} Video Octopus All rights reserved</p>`;
  }

  startButton.addEventListener('click', startMonitoring);
  stopButton.addEventListener('click', stopMonitoring);
  exportButton.addEventListener('click', exportToJson);
  resetButton.addEventListener('click', resetData);

  // 监听来自 background.js 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "initializeSourceTab" && request.sourceTab) {
      monitoringTabId = request.sourceTab.id;
      urlInfo.textContent = `${t('targetPage')}: ${request.sourceTab.url}`;
      startButton.disabled = false;
    }
  });

  // 检查是否已经有源标签页信息
  chrome.runtime.sendMessage({ action: "getSourceTab" }, response => {
    if (response && response.sourceTab) {
      monitoringTabId = response.sourceTab.id;
      urlInfo.textContent = `${t('targetPage')}: ${response.sourceTab.url}`;
      startButton.disabled = false;
    }
  });
});

// 多语言支持
const lang = (navigator.language || navigator.userLanguage).toLowerCase();
const isZh = lang.startsWith('zh');
const texts = {
  zh: {
    notSupportM3u8: '浏览器不支持 m3u8 预览',
    hlsFail: '❌ 加载 hls.js 失败',
    hlsFailDetail: '❌ 加载 hls.js 失败，请检查网络或刷新页面',
    notSupportPreview: '不支持预览',
    error: '错误',
    statusMonitoring: '状态: 正在监控中... (总计: {count} 个链接)',
    statusStopped: '状态: 已停止监控',
    statusReset: '状态: 已重置数据',
    statusResetContinue: '状态: 已重置数据，继续监控中...',
    targetPage: '目标页面'
  },
  en: {
    notSupportM3u8: 'Browser does not support m3u8 preview',
    hlsFail: '❌ Failed to load hls.js',
    hlsFailDetail: '❌ Failed to load hls.js, please check your network or refresh the page',
    notSupportPreview: 'Preview not supported',
    error: 'Error',
    statusMonitoring: 'Status: Monitoring... (Total: {count} links)',
    statusStopped: 'Status: Monitoring stopped',
    statusReset: 'Status: Data reset',
    statusResetContinue: 'Status: Data reset, monitoring continues...',
    targetPage: 'Target Page'
  }
};
function t(key, params) {
  let str = (isZh ? texts.zh : texts.en)[key] || key;
  if (params) {
    Object.keys(params).forEach(k => {
      str = str.replace(`{${k}}`, params[k]);
    });
  }
  return str;
}

async function startMonitoring() {
  if (!monitoringTabId) return;
  document.getElementById('startScraping').disabled = true;
  document.getElementById('stopScraping').disabled = false;
  document.getElementById('status').textContent = t('statusMonitoring', { count: 0 });
  // 立即执行一次抓取
  await scrapeAndUpdate();
  // 设置定期抓取
  monitoringInterval = setInterval(scrapeAndUpdate, 5000); // 每5秒抓取一次
}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  document.getElementById('startScraping').disabled = false;
  document.getElementById('stopScraping').disabled = true;
  document.getElementById('status').textContent = t('statusStopped');
}

async function scrapeAndUpdate() {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: monitoringTabId },
      function: scrapeVideo
    });
    const videos = result[0].result;
    videos.mp4.forEach(url => allVideos.mp4.add(url));
    videos.m3u8.forEach(url => allVideos.m3u8.add(url));
    updateDisplay();
  } catch (error) {
    document.getElementById('result').innerHTML = `${t('error')}: ${error.message}`;
    stopMonitoring();
  }
}

function updateDisplay() {
  const displayVideos = {
    mp4: Array.from(allVideos.mp4),
    m3u8: Array.from(allVideos.m3u8),
    ts: Array.from(allVideos.ts)
  };
  document.getElementById('result').innerHTML = JSON.stringify(displayVideos, null, 2);
  const mp4Count = displayVideos.mp4.length;
  const m3u8Count = displayVideos.m3u8.length;
  const tsCount = displayVideos.ts.length;
  const totalCount = mp4Count + m3u8Count + tsCount;
  document.getElementById('mp4Count').textContent = mp4Count;
  document.getElementById('m3u8Count').textContent = m3u8Count;
  document.getElementById('tsCount').textContent = tsCount;
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('status').textContent = t('statusMonitoring', { count: totalCount });

  // 更新视频列表
  const videoListContainer = document.getElementById('videoList');
  videoListContainer.innerHTML = '';

  let index = 1;
  // MP4列表
  displayVideos.mp4.forEach(url => {
    addVideoItem(videoListContainer, index++, 'mp4', url);
  });
  // M3U8列表
  displayVideos.m3u8.forEach(url => {
    addVideoItem(videoListContainer, index++, 'm3u8', url);
  });
  // TS列表
  displayVideos.ts.forEach(url => {
    addVideoItem(videoListContainer, index++, 'ts', url);
  });
}

function addVideoItem(container, index, type, url) {
  const item = document.createElement('div');
  item.className = 'video-item';
  const number = document.createElement('div');
  number.className = 'video-number';
  number.textContent = index;
  const typeSpan = document.createElement('div');
  typeSpan.className = `video-type ${type}`;
  typeSpan.textContent = type === 'mp4' ? 'MP4' : (type === 'm3u8' ? 'M3U8' : 'TS');
  const preview = document.createElement('div');
  preview.className = 'video-preview';
  if (type === 'mp4') {
    const video = document.createElement('video');
    video.src = url;
    video.preload = 'metadata';
    video.muted = true;
    video.controls = true;
    preview.appendChild(video);
  } else if (type === 'm3u8') {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.controls = true;
    video.width = 320;
    video.height = 180;
    preview.appendChild(video);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else {
      if (!window.Hls) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('hls.js');
        script.onload = () => {
          if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
          } else {
            preview.textContent = t('notSupportM3u8');
          }
        };
        script.onerror = () => {
          preview.textContent = t('hlsFailDetail');
          preview.style.color = 'red';
          preview.style.fontWeight = 'bold';
        };
        document.body.appendChild(script);
      } else if (window.Hls.isSupported()) {
        const hls = new window.Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
      } else {
        preview.textContent = t('notSupportM3u8');
      }
    }
  } else {
    preview.textContent = t('notSupportPreview');
  }
  const link = document.createElement('div');
  link.className = 'video-link';
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.textContent = url;
  link.appendChild(a);
  // 添加操作区域
  const actions = document.createElement('div');
  actions.className = 'video-actions';
  // 如果是MP4文件，添加下载按钮
  if (type === 'mp4') {
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = isZh ? '⬇️ 下载' : '⬇️ Download';
    downloadBtn.onclick = (e) => {
      e.preventDefault();
      const filename = url.split('/').pop().split('?')[0] || (isZh ? 'video.mp4' : 'video.mp4');
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
      });
    };
    actions.appendChild(downloadBtn);
  }
  item.appendChild(number);
  item.appendChild(typeSpan);
  item.appendChild(preview);
  item.appendChild(link);
  item.appendChild(actions);
  container.appendChild(item);
}

function exportToJson() {
  const displayVideos = {
    mp4: Array.from(allVideos.mp4),
    m3u8: Array.from(allVideos.m3u8)
  };

  const blob = new Blob([JSON.stringify(displayVideos, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // const filename = `videos-${timestamp}.json`;
  const filename = `videos.json`;


  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

function resetData() {
  // 清空所有数据
  allVideos = {
    mp4: new Set(),
    m3u8: new Set(),
    ts: new Set()
  };

  // 更新JSON显示
  document.getElementById('result').innerHTML = JSON.stringify({
    mp4: [],
    m3u8: [],
    ts: []
  }, null, 2);

  // 清空视频列表
  document.getElementById('videoList').innerHTML = '';

  // 重置计数器
  document.getElementById('mp4Count').textContent = '0';
  document.getElementById('m3u8Count').textContent = '0';
  document.getElementById('tsCount').textContent = '0';
  document.getElementById('totalCount').textContent = '0';

  // 更新状态
  document.getElementById('status').textContent = t('statusReset');

  // 如果正在监控，保持监控状态
  if (monitoringInterval) {
    document.getElementById('status').textContent = t('statusResetContinue');
  }
}

function scrapeVideo() {
  return new Promise((resolve) => {
    const videos = {
      mp4: [],
      m3u8: [],
      ts: []
    };

    // 寻找video标签
    const videoElements = document.getElementsByTagName('video');
    for (const video of videoElements) {
      const src = video.src;
      if (src) {
        if (src.includes('.mp4')) {
          videos.mp4.push(src);
        } else if (src.includes('.m3u8')) {
          videos.m3u8.push(src);
        } else if (src.includes('.ts')) {
          videos.ts.push(src);
        }
      }

      // 检查source标签
      const sources = video.getElementsByTagName('source');
      for (const source of sources) {
        const src = source.src;
        if (src) {
          if (src.includes('.mp4')) {
            videos.mp4.push(src);
          } else if (src.includes('.m3u8')) {
            videos.m3u8.push(src);
          } else if (src.includes('.ts')) {
            videos.ts.push(src);
          }
        }
      }
    }

    // 搜索页面中的视频相关脚本
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
      const content = script.textContent;
      if (content) {
        // 查找可能包含视频URL的JSON数据
        const matches = content.match(/"(?:url|src)":"([^"]*\.(?:mp4|m3u8|ts))[^"]*"/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.split('"')[3];
            if (url.includes('.mp4')) {
              videos.mp4.push(url);
            } else if (url.includes('.m3u8')) {
              videos.m3u8.push(url);
            } else if (url.includes('.ts')) {
              videos.ts.push(url);
            }
          });
        }

        // 查找其他可能的视频URL模式
        const urlMatches = content.match(/https?:\/\/[^\s<>"']+?\.(?:mp4|m3u8|ts)(?:[^\s<>"']*)/g);
        if (urlMatches) {
          urlMatches.forEach(url => {
            if (url.includes('.mp4')) {
              videos.mp4.push(url);
            } else if (url.includes('.m3u8')) {
              videos.m3u8.push(url);
            } else if (url.includes('.ts')) {
              videos.ts.push(url);
            }
          });
        }
      }
    }

    resolve(videos);
  });
}
