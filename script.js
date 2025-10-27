let backgroundContainer = null;
let activeBackgroundLayer = null;
let lastBackgroundMeta = null;

const LAST_BACKGROUND_DATA_KEY = 'lastBackgroundDataUrl';
const LAST_BACKGROUND_META_KEY = 'lastBackgroundMeta';
const BACKGROUND_PINNED_KEY = 'backgroundPinned';
const MAX_BACKGROUND_LOAD_ATTEMPTS = 5;
const BACKGROUND_SWAP_DELAY_MS = 3000;
const BACKGROUND_WIDTH = 1280;
const BACKGROUND_HEIGHT = 720;
const BACKGROUND_ID_POOL_SIZE = 1000;
let reloadButton = null;
let pinButton = null;
let isBackgroundPinned = false;
let isBackgroundLoading = false;

let backgroundSwapTimeoutId = null;
const backgroundSwapReadyAt = performance.now() + BACKGROUND_SWAP_DELAY_MS;

function buildBackgroundUrl(imageId) {
  return `https://picsum.photos/id/${imageId}/${BACKGROUND_WIDTH}/${BACKGROUND_HEIGHT}`;
}

function pickRandomBackgroundId() {
  return Math.floor(Math.random() * BACKGROUND_ID_POOL_SIZE) + 1;
}

function getNextBackgroundId(previousId) {
  if (typeof previousId === 'number') {
    return (previousId % BACKGROUND_ID_POOL_SIZE) + 1;
  }
  return pickRandomBackgroundId();
}

function getCachedBackground() {
  try {
    const dataUrl = localStorage.getItem(LAST_BACKGROUND_DATA_KEY);
    const rawMeta = localStorage.getItem(LAST_BACKGROUND_META_KEY);
    const meta = rawMeta ? JSON.parse(rawMeta) : null;
    return { dataUrl, meta };
  } catch (error) {
    console.error('背景キャッシュの読み込みに失敗しました:', error);
    return { dataUrl: null, meta: null };
  }
}

function persistBackground(dataUrl, meta) {
  lastBackgroundMeta = meta ?? null;

  try {
    if (dataUrl) {
      localStorage.setItem(LAST_BACKGROUND_DATA_KEY, dataUrl);
    } else {
      localStorage.removeItem(LAST_BACKGROUND_DATA_KEY);
    }

    if (meta) {
      localStorage.setItem(LAST_BACKGROUND_META_KEY, JSON.stringify(meta));
    } else {
      localStorage.removeItem(LAST_BACKGROUND_META_KEY);
    }
  } catch (error) {
    console.error('背景キャッシュの保存に失敗しました:', error);
  }
}

function loadPinState() {
  try {
    isBackgroundPinned = localStorage.getItem(BACKGROUND_PINNED_KEY) === 'true';
  } catch (error) {
    console.error('ピン状態の読み込みに失敗しました:', error);
    isBackgroundPinned = false;
  }
}

function savePinState(pinned) {
  try {
    localStorage.setItem(BACKGROUND_PINNED_KEY, pinned ? 'true' : 'false');
  } catch (error) {
    console.error('ピン状態の保存に失敗しました:', error);
  }
}

function updateControlStates() {
  if (reloadButton) {
    const disabled = isBackgroundLoading || isBackgroundPinned;
    reloadButton.disabled = disabled;
    const label = '背景を更新';
    reloadButton.setAttribute('title', label);
    reloadButton.setAttribute('aria-label', label);
    reloadButton.classList.toggle('is-loading', isBackgroundLoading);
  }
  if (pinButton) {
    pinButton.classList.toggle('is-active', isBackgroundPinned);
    pinButton.setAttribute('aria-pressed', String(isBackgroundPinned));
    const label = isBackgroundPinned ? '背景の固定を解除' : '背景を固定';
    pinButton.setAttribute('title', label);
    pinButton.setAttribute('aria-label', label);
  }
}

function ensureBackgroundContainer() {
  if (!backgroundContainer) {
    backgroundContainer = document.getElementById('backgroundContainer');
  }
  return backgroundContainer;
}

// 時刻と日付を更新する関数
function updateTime() {
  const now = new Date();

  // 時刻の表示
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('time').textContent = `${hours}:${minutes}`;

  // 日付の表示
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[now.getDay()];

  document.getElementById('date').textContent =
    `${year}年${month}月${date}日（${weekday}）`;
}

// 検索機能
function setupSearch() {
  const searchInput = document.getElementById('searchInput');

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();

      if (!query) return;

      // URLかどうかを判定
      const urlPattern = /^(https?:\/\/|www\.)/i;
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;

      if (urlPattern.test(query)) {
        // URLの場合
        const url = query.startsWith('http') ? query : `https://${query}`;
        window.location.href = url;
      } else if (domainPattern.test(query)) {
        // ドメイン名の場合
        window.location.href = `https://${query}`;
      } else {
        // 検索クエリの場合
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
      }
    }
  });

  // フォーカスを自動的に当てる
  searchInput.focus();
}

// 最近開いたサイトを取得して表示
async function displayRecentSites() {
  const recentSitesContainer = document.getElementById('recentSites');

  try {
    // 過去7日間の履歴を取得
    const weekAgo = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
    const historyItems = await chrome.history.search({
      text: '',
      startTime: weekAgo,
      maxResults: 100
    });

    // URLごとに訪問回数をカウント
    const urlMap = new Map();
    historyItems.forEach(item => {
      if (item.url && !item.url.startsWith('chrome://') &&
          !item.url.startsWith('chrome-extension://')) {
        try {
          const url = new URL(item.url);
          const domain = url.hostname;
          const existing = urlMap.get(domain);

          if (!existing || item.lastVisitTime > existing.lastVisitTime) {
            urlMap.set(domain, {
              url: item.url,
              title: item.title || domain,
              domain: domain,
              lastVisitTime: item.lastVisitTime,
              visitCount: (existing?.visitCount || 0) + (item.visitCount || 1)
            });
          }
        } catch (e) {
          // 無効なURLはスキップ
        }
      }
    });

    // 訪問回数でソート
    const sortedSites = Array.from(urlMap.values())
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 8); // 上位8件を表示

    // 表示
    recentSitesContainer.innerHTML = '';
    sortedSites.forEach(site => {
      const shortcut = document.createElement('a');
      shortcut.href = site.url;
      shortcut.className = 'shortcut-item';

      const icon = document.createElement('div');
      icon.className = 'shortcut-icon';
      // ドメインの最初の文字を大文字で表示
      icon.textContent = site.domain.charAt(0).toUpperCase();

      const name = document.createElement('div');
      name.className = 'shortcut-name';
      name.textContent = site.title.length > 20
        ? site.title.substring(0, 20) + '...'
        : site.title;

      shortcut.appendChild(icon);
      shortcut.appendChild(name);
      recentSitesContainer.appendChild(shortcut);
    });
  } catch (error) {
    console.error('履歴の取得に失敗しました:', error);
    recentSitesContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6);">履歴を読み込めませんでした</p>';
  }
}

function showBackgroundImage(imageUrl, { immediate = false } = {}) {
  const container = ensureBackgroundContainer();

  if (!container) {
    document.body.style.backgroundImage = `url('${imageUrl}')`;
    document.body.classList.add('loaded');
    activeBackgroundLayer = null;
    return;
  }

  const nextLayer = document.createElement('div');
  nextLayer.className = 'background-image';
  nextLayer.style.backgroundImage = `url('${imageUrl}')`;
  container.appendChild(nextLayer);

  if (immediate) {
    nextLayer.classList.add('is-visible');
    if (activeBackgroundLayer) {
      activeBackgroundLayer.remove();
    }
  } else {
    requestAnimationFrame(() => {
      nextLayer.classList.add('is-visible');
    });

    if (activeBackgroundLayer) {
      const previousLayer = activeBackgroundLayer;
      previousLayer.addEventListener('transitionend', () => {
        previousLayer.remove();
      }, { once: true });
      previousLayer.classList.remove('is-visible');
    }
  }

  activeBackgroundLayer = nextLayer;
  document.body.classList.add('loaded');
}

function scheduleBackgroundSwap(action) {
  if (!activeBackgroundLayer) {
    action();
    return;
  }

  const now = performance.now();

  if (now >= backgroundSwapReadyAt) {
    action();
    return;
  }

  if (backgroundSwapTimeoutId) {
    clearTimeout(backgroundSwapTimeoutId);
  }

  const delay = Math.max(0, backgroundSwapReadyAt - now);
  backgroundSwapTimeoutId = window.setTimeout(() => {
    backgroundSwapTimeoutId = null;
    action();
  }, delay);
}

async function setStoredBackground() {
  try {
    const { dataUrl, meta } = getCachedBackground();
    if (dataUrl) {
      lastBackgroundMeta = meta ?? null;
      showBackgroundImage(dataUrl, { immediate: true });
      return true;
    }
  } catch (error) {
    console.error('背景画像の復元に失敗しました:', error);
  }
  return false;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function setRandomBackground(attempt = 1) {
  if (isBackgroundPinned || isBackgroundLoading) {
    return;
  }

  isBackgroundLoading = true;
  updateControlStates();

  const candidateId = getNextBackgroundId(lastBackgroundMeta?.id);
  const imageUrl = buildBackgroundUrl(candidateId);
  let shouldRetry = false;

  try {
    const response = await fetch(imageUrl, {
      cache: 'no-store',
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch background: ${response.status}`);
    }

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    const meta = {
      id: candidateId,
      fetchedAt: Date.now()
    };

    if (isBackgroundPinned) {
      return;
    }

    persistBackground(dataUrl, meta);
    scheduleBackgroundSwap(() => {
      if (isBackgroundPinned) {
        return;
      }
      showBackgroundImage(dataUrl);
    });
  } catch (error) {
    console.error('背景画像の取得に失敗しました:', error);
    if (attempt < MAX_BACKGROUND_LOAD_ATTEMPTS) {
      shouldRetry = true;
    }
  } finally {
    isBackgroundLoading = false;
    updateControlStates();
  }

  if (shouldRetry && !isBackgroundPinned) {
    return setRandomBackground(attempt + 1);
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  ensureBackgroundContainer();

  reloadButton = document.getElementById('reloadButton');
  pinButton = document.getElementById('pinButton');

  loadPinState();
  updateControlStates();

  if (pinButton) {
    pinButton.addEventListener('click', () => {
      isBackgroundPinned = !isBackgroundPinned;
      savePinState(isBackgroundPinned);
      updateControlStates();

      if (!isBackgroundPinned) {
        setRandomBackground().catch((error) => {
          console.error('背景画像の再取得に失敗しました:', error);
        });
      }
    });
  }

  if (reloadButton) {
    reloadButton.addEventListener('click', () => {
      setRandomBackground().catch((error) => {
        console.error('背景画像の再取得に失敗しました:', error);
      });
    });
  }

  (async () => {
    await setStoredBackground();
    updateControlStates();
    try {
      await setRandomBackground();
    } catch (error) {
      console.error('背景画像の設定に失敗しました:', error);
    }
  })();

  updateTime();
  setupSearch();
  displayRecentSites();

  // 1秒ごとに時刻を更新
  setInterval(updateTime, 1000);

  // 確実にフォーカスを当てる
  setTimeout(() => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.focus();
    }
  }, 100);
});
