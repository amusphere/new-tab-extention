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

// ランダムな背景画像を設定
function setRandomBackground() {
  // ランダムなIDを生成して毎回異なる画像を取得
  const randomId = Math.floor(Math.random() * 1000);
  const imageUrl = `https://picsum.photos/1920/1080?random=${randomId}`;

  // 画像を事前に読み込む
  const img = new Image();
  img.onload = () => {
    // 画像読み込み完了後に背景を設定してクラスを追加
    document.body.style.backgroundImage = `url('${imageUrl}')`;
    document.body.classList.add('loaded');
  };
  img.src = imageUrl;
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
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
