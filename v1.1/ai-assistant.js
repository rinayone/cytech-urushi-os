/* ============================================
   CTU v1.1 Admin — AI Assistant Popup
   業務アシスタントKANAME (移動可能ポップアップ)
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'kn-popup-state';
  const SNAP_THRESHOLD = 110;
  const MARGIN = 16;
  const HEADER_HEIGHT = 84; // header + top margin

  // ペルソナ別の挨拶・サジェスト・応答シナリオ
  const personaConfig = {
    hr: {
      name: '田中 美咲',
      role: 'HR担当',
      initial: '展開', // 展開 or 最小化
      greeting: 'おはようございます、田中さん。<br>今日のフォロー対象は<strong>3名</strong>です。重点的に確認したい人を教えてください。',
      suggestions: [
        { label: '今日の重要な3名', key: 'today-priority' },
        { label: '離脱しそうな人', key: 'churn-risk' },
        { label: 'スカウト候補TOP3', key: 'scout-top' },
        { label: '今月の数字まとめて', key: 'monthly-summary' },
      ],
      scenarios: {
        'today-priority': {
          reply: '<strong>佐藤 一郎</strong>さん、<strong>田中 美穂</strong>さん、<strong>鈴木 花子</strong>さんの3名です。佐藤さんは20日更新がなく要確認です。',
          action: { label: '社員一覧で見る', target: 'employee-list', icon: 'arrow_outward' },
        },
        'churn-risk': {
          reply: 'AIが学習停滞を検知した<strong>3名</strong>がいます。今すぐフォローアップを推奨します。',
          action: { label: 'アラートを確認', target: 'alert-banner', icon: 'arrow_outward' },
        },
        'scout-top': {
          reply: '条件達成済みの候補者は現在<strong>3名</strong>。<strong>N.Sさん</strong>（マッチスコア92）が最有力です。',
          action: { label: '選考タブで見る', target: '__nav-selection', icon: 'open_in_new' },
        },
        'monthly-summary': {
          reply: '全体学習進捗 <strong>64%</strong>（前月比+5%）／テスト平均 <strong>78点</strong>／離脱判定 <strong>3名</strong>／Score出力 <strong>12件</strong>です。',
          action: { label: '分析タブで見る', target: '__nav-analytics', icon: 'open_in_new' },
        },
      },
      fallback: '少々お待ちください。「今日の重要な3名」「離脱しそうな人」「スカウト候補TOP3」「今月の数字まとめて」のような質問がよく聞かれます。',
    },
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function buildPopup(personaKey) {
    const persona = personaConfig[personaKey] || personaConfig.hr;

    const popup = document.createElement('div');
    popup.className = 'kn-popup';
    popup.id = 'kn-popup';
    popup.setAttribute('role', 'complementary');
    popup.setAttribute('aria-label', 'KANAME業務アシスタント');

    popup.innerHTML = `
      <div class="kn-head" id="kn-head">
        <div class="kn-orb"></div>
        <div class="kn-title">
          <div class="nm">KANAME 業務アシスタント</div>
          <div class="sub">${persona.role}向けモード</div>
        </div>
        <div class="kn-actions">
          <button class="kn-btn" id="kn-minimize" title="最小化"><span class="material-symbols-outlined">remove</span></button>
        </div>
      </div>
      <div class="kn-body" id="kn-body">
        <div class="kn-msg ai">
          <div class="av"></div>
          <div class="bubble">${persona.greeting}</div>
        </div>
      </div>
      <div class="kn-foot">
        <div class="kn-suggest" id="kn-suggest">
          ${persona.suggestions.map(s => `<button class="kn-chip" data-key="${s.key}">${s.label}</button>`).join('')}
        </div>
        <div class="kn-input-row">
          <input class="kn-input" id="kn-input" placeholder="質問を入力 ( 例: 学習者は何人？ )">
          <button class="kn-send" id="kn-send" title="送信"><span class="material-symbols-outlined">arrow_upward</span></button>
        </div>
      </div>
      <div class="kn-mini" title="KANAMEに聞く">
        <div class="kn-mini-orb"><span class="material-symbols-outlined">chat</span></div>
      </div>
    `;

    // snap zones overlay
    const snap = document.createElement('div');
    snap.className = 'kn-snap';
    snap.id = 'kn-snap';
    snap.innerHTML = `
      <div class="zone tl" data-corner="tl"></div>
      <div class="zone tr" data-corner="tr"></div>
      <div class="zone bl" data-corner="bl"></div>
      <div class="zone br" data-corner="br"></div>
    `;

    document.body.appendChild(popup);
    document.body.appendChild(snap);

    return { popup, snap, persona };
  }

  function applyState(popup, state) {
    if (!state) {
      // default: bottom right
      popup.style.right = MARGIN + 'px';
      popup.style.bottom = MARGIN + 'px';
      popup.style.left = 'auto';
      popup.style.top = 'auto';
      return;
    }
    if (state.minimized) popup.classList.add('minimized');
    if (state.width) popup.style.width = state.width + 'px';
    if (state.height) popup.style.height = state.height + 'px';
    if (state.corner) {
      const cornerStyles = {
        tl: { top: HEADER_HEIGHT, left: MARGIN, right: 'auto', bottom: 'auto' },
        tr: { top: HEADER_HEIGHT, right: MARGIN, left: 'auto', bottom: 'auto' },
        bl: { bottom: MARGIN, left: MARGIN, right: 'auto', top: 'auto' },
        br: { bottom: MARGIN, right: MARGIN, left: 'auto', top: 'auto' },
      };
      const s = cornerStyles[state.corner] || cornerStyles.br;
      Object.entries(s).forEach(([k, v]) => {
        popup.style[k] = (typeof v === 'number') ? v + 'px' : v;
      });
    } else if (state.x != null && state.y != null) {
      popup.style.left = state.x + 'px';
      popup.style.top = state.y + 'px';
      popup.style.right = 'auto';
      popup.style.bottom = 'auto';
    }
  }

  function getCornerForPosition(rect) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const left = cx < w / 2;
    const top = cy < h / 2;
    if (top && left) return 'tl';
    if (top && !left) return 'tr';
    if (!top && left) return 'bl';
    return 'br';
  }

  function snapTo(popup, corner) {
    popup.classList.add('snapping');
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    // clear all
    popup.style.left = popup.style.right = popup.style.top = popup.style.bottom = 'auto';
    if (corner === 'tl') {
      popup.style.left = MARGIN + 'px';
      popup.style.top = HEADER_HEIGHT + 'px';
    } else if (corner === 'tr') {
      popup.style.right = MARGIN + 'px';
      popup.style.top = HEADER_HEIGHT + 'px';
    } else if (corner === 'bl') {
      popup.style.left = MARGIN + 'px';
      popup.style.bottom = MARGIN + 'px';
    } else {
      popup.style.right = MARGIN + 'px';
      popup.style.bottom = MARGIN + 'px';
    }
    setTimeout(() => popup.classList.remove('snapping'), 250);
    return { width: w, height: h, corner };
  }

  function setupDrag(popup, snap, onSettle) {
    const head = popup.querySelector('.kn-head');
    let dragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function onDown(e) {
      // ignore clicks on action buttons
      if (e.target.closest('.kn-btn')) return;
      // can't drag minimized via header (use whole popup)
      if (popup.classList.contains('minimized')) return;
      const rect = popup.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      // freeze position to absolute coords
      popup.style.left = startLeft + 'px';
      popup.style.top = startTop + 'px';
      popup.style.right = 'auto';
      popup.style.bottom = 'auto';
      dragging = true;
      popup.classList.add('dragging');
      snap.classList.add('show');
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = popup.offsetWidth;
      const h = popup.offsetHeight;
      const newLeft = clamp(startLeft + dx, 4, window.innerWidth - w - 4);
      const newTop = clamp(startTop + dy, 4, window.innerHeight - h - 4);
      popup.style.left = newLeft + 'px';
      popup.style.top = newTop + 'px';

      // highlight active snap zone
      const rect = popup.getBoundingClientRect();
      const corner = getCornerForPosition(rect);
      snap.querySelectorAll('.zone').forEach(z => z.classList.toggle('active', z.dataset.corner === corner));
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      popup.classList.remove('dragging');
      snap.classList.remove('show');
      snap.querySelectorAll('.zone').forEach(z => z.classList.remove('active'));

      // mark as just-dragged so subsequent click doesn't toggle minimize
      popup.dataset.justDragged = '1';
      setTimeout(() => { delete popup.dataset.justDragged; }, 200);

      // snap to nearest corner
      const rect = popup.getBoundingClientRect();
      const corner = getCornerForPosition(rect);
      const settled = snapTo(popup, corner);
      if (onSettle) onSettle(settled);
    }

    head.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    // also enable dragging via the popup body when minimized (drag the FAB)
    popup.addEventListener('mousedown', (e) => {
      if (!popup.classList.contains('minimized')) return;
      if (e.target.closest('.kn-btn')) return;
      const rect = popup.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      popup.style.left = startLeft + 'px';
      popup.style.top = startTop + 'px';
      popup.style.right = 'auto';
      popup.style.bottom = 'auto';
      dragging = true;
      popup.classList.add('dragging');
      snap.classList.add('show');
      e.preventDefault();
    });
  }

  function appendMessage(body, html, who, action) {
    const msg = document.createElement('div');
    msg.className = `kn-msg ${who}`;
    const av = document.createElement('div');
    av.className = 'av';
    if (who === 'user') av.textContent = '田'; // 田中の頭文字
    msg.appendChild(av);

    const bubbleWrap = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = html;
    bubbleWrap.appendChild(bubble);

    if (action) {
      const btn = document.createElement('button');
      btn.className = 'ai-action';
      btn.dataset.target = action.target;
      btn.innerHTML = `<span class="material-symbols-outlined">${action.icon || 'arrow_outward'}</span>${action.label}`;
      btn.addEventListener('click', () => triggerHighlight(action.target));
      bubbleWrap.appendChild(btn);
    }
    msg.appendChild(bubbleWrap);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function triggerHighlight(target) {
    if (target && target.startsWith('__nav-')) {
      // navigation hook (not in scope for Phase 1; just notify)
      const id = target.replace('__nav-', '');
      const tabNames = { selection: '選考', analytics: '分析', curriculum: 'カリキュラム' };
      const label = tabNames[id] || id;
      console.info('[KANAME] navigate to', id);
      alert('準備中：' + label + ' タブは Phase 2 で実装予定');
      return;
    }
    const el = document.querySelector('[data-ai-target="' + target + '"]');
    if (!el) return;
    // scroll into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // remove old highlight if any, then re-trigger animation
    el.classList.remove('adm-highlight');
    void el.offsetWidth;
    el.classList.add('adm-highlight');
    setTimeout(() => el.classList.remove('adm-highlight'), 1900);
  }

  function handleSuggest(persona, key, body) {
    const sc = persona.scenarios[key];
    // user message (use the chip label)
    const chipLabel = persona.suggestions.find(s => s.key === key)?.label || key;
    appendMessage(body, chipLabel, 'user');
    setTimeout(() => {
      if (sc) {
        appendMessage(body, sc.reply, 'ai', sc.action);
      } else {
        appendMessage(body, persona.fallback, 'ai');
      }
    }, 380);
  }

  function handleFreeText(persona, text, body) {
    appendMessage(body, escapeHtml(text), 'user');
    // simple keyword routing for demo
    const t = text.toLowerCase();
    let key = null;
    if (/学習者|何人|人数|登録/.test(text)) key = 'monthly-summary';
    else if (/離脱|停滞|やめ|辞め/.test(text)) key = 'churn-risk';
    else if (/スカウト|候補|採用/.test(text)) key = 'scout-top';
    else if (/今日|重要|フォロー/.test(text)) key = 'today-priority';

    setTimeout(() => {
      const sc = key ? persona.scenarios[key] : null;
      if (sc) appendMessage(body, sc.reply, 'ai', sc.action);
      else appendMessage(body, persona.fallback, 'ai');
    }, 420);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function init() {
    const personaKey = document.body.dataset.persona || 'hr';
    const { popup, snap, persona } = buildPopup(personaKey);
    const state = loadState();

    // apply initial state (or persona default)
    if (state) {
      applyState(popup, state);
    } else {
      // default per persona: 展開 or 最小化
      if (persona.initial === '最小化') popup.classList.add('minimized');
      applyState(popup, null);
      // save initial corner
      saveState({ corner: 'br', minimized: persona.initial === '最小化' });
    }

    setupDrag(popup, snap, (settled) => {
      const cur = loadState() || {};
      saveState({ ...cur, corner: settled.corner, width: settled.width, height: settled.height });
    });

    // minimize / restore
    const minBtn = popup.querySelector('#kn-minimize');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.classList.add('minimized');
      const cur = loadState() || {};
      saveState({ ...cur, minimized: true });
    });
    popup.addEventListener('click', (e) => {
      if (popup.classList.contains('minimized')
          && !popup.classList.contains('dragging')
          && !popup.dataset.justDragged) {
        popup.classList.remove('minimized');
        const cur = loadState() || {};
        saveState({ ...cur, minimized: false });
      }
    });

    // suggest chips
    const body = popup.querySelector('#kn-body');
    popup.querySelectorAll('.kn-chip').forEach(chip => {
      chip.addEventListener('click', () => handleSuggest(persona, chip.dataset.key, body));
    });

    // input
    const input = popup.querySelector('#kn-input');
    const send = popup.querySelector('#kn-send');
    function submit() {
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      handleFreeText(persona, t, body);
    }
    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

    // observe resize for save
    let resizeTimer = null;
    new ResizeObserver(() => {
      if (popup.classList.contains('minimized')) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const cur = loadState() || {};
        saveState({ ...cur, width: popup.offsetWidth, height: popup.offsetHeight });
      }, 400);
    }).observe(popup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
