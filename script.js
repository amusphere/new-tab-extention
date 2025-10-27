let backgroundContainer = null;
let activeBackgroundLayer = null;
const LAST_BACKGROUND_KEY = 'lastBackgroundUrl';
const MAX_BACKGROUND_LOAD_ATTEMPTS = 5;
const BACKGROUND_SWAP_DELAY_MS = 3000;

let backgroundSwapTimeoutId = null;
const backgroundSwapReadyAt = performance.now() + BACKGROUND_SWAP_DELAY_MS;

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

function setStoredBackground() {
  try {
    const storedUrl = localStorage.getItem(LAST_BACKGROUND_KEY);
    if (storedUrl) {
      showBackgroundImage(storedUrl, { immediate: true });
    }
  } catch (error) {
    console.error('背景画像の復元に失敗しました:', error);
  }
}

function getRandomBackgroundUrl() {
  const imageId = Math.floor(Math.random() * 1000) + 1;
  return `https://picsum.photos/id/${imageId}/1920/1080`;
}

function setRandomBackground(attempt = 1) {
  const imageUrl = getRandomBackgroundUrl();

  // 画像を事前に読み込む
  const img = new Image();
  img.onload = () => {
    scheduleBackgroundSwap(() => {
      showBackgroundImage(imageUrl);
      try {
        localStorage.setItem(LAST_BACKGROUND_KEY, imageUrl);
      } catch (error) {
        console.error('背景画像の保存に失敗しました:', error);
      }
    });
  };
  img.onerror = (error) => {
    console.error('背景画像の取得に失敗しました:', error);
    if (attempt < MAX_BACKGROUND_LOAD_ATTEMPTS) {
      setRandomBackground(attempt + 1);
    }
  };
  img.src = imageUrl;
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  ensureBackgroundContainer();
  setStoredBackground();
  setRandomBackground();
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
