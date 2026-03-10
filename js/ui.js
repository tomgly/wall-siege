const UI = (() => {

  // ── 状態 ──────────────────────────────────────────────────
  let gameState   = null;
  let myIndex     = -1;
  let inputMode   = 'move';   // 'move' | 'wall-h' | 'wall-v'
  let highlights  = [];
  let wallPreview = null;
  let myTurn      = false;
  let playerNames = ['', ''];
  let _gameStarted = false;   // ゲームが開始済みかどうか

  const canvas = document.getElementById('game-canvas');

  // ── 初期化 ────────────────────────────────────────────────
  function init() {
    Network.init();
    Render.init(canvas);
    // 名前キャッシュを復元
    const savedName = localStorage.getItem('ws_player_name');
    if (savedName) document.getElementById('input-name').value = savedName;
    _bindLobbyEvents();
    _bindCanvasEvents();
    _bindNetworkEvents();
    _applyUrlParams();
  }

  // ── URLパラメータを読んでコードを自動入力 ────────────────
  function _applyUrlParams() {
    const params = new URLSearchParams(location.search);
    const code   = params.get('code');
    if (code) {
      document.getElementById('input-room-code').value = code.toUpperCase();
    }
    showScreen('screen-lobby');
  }

  // ── URLを更新 ───────────────────────────
  function _setUrl(code) {
    const params = new URLSearchParams();
    if (code) params.set('code', code);
    history.replaceState(null, '', '?' + params.toString());
  }

  function _clearUrl() {
    history.replaceState(null, '', location.pathname);
  }

  // ─────────────────────────────────────────────────────────
  //  画面切替
  // ─────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.body.classList.toggle('no-scroll', id === 'screen-game');
  }

  function setStatus(html) {
    document.getElementById('status-text').innerHTML = html;
    const ws = document.getElementById('waiting-status-text');
    if (ws) ws.innerHTML = html;
  }

  function setModeBtn(mode) {
    document.getElementById('btn-mode-move').classList.toggle('mode-active', mode === 'move');
    document.getElementById('btn-mode-wallh').classList.toggle('mode-active', mode === 'wall-h');
    document.getElementById('btn-mode-wallv').classList.toggle('mode-active', mode === 'wall-v');
  }

  function updatePlayerInfo() {
    if (!gameState) return;

    const p0 = gameState.players[0];
    const p1 = gameState.players[1];

    document.getElementById('sente-name').textContent = p0.name || '---';
    document.getElementById('gote-name').textContent  = p1.name || '---';
    document.getElementById('sente-walls').textContent = p0.wallsLeft;
    document.getElementById('gote-walls').textContent  = p1.wallsLeft;

    // ラベル: 先手/後手 + （あなた）or（相手）
    const myIsP0 = myIndex === 0;
    const myIsP1 = myIndex === 1;
    if (myIndex === -1) {
      document.getElementById('sente-label').textContent = '先手';
      document.getElementById('gote-label').textContent  = '後手';
    } else {
      document.getElementById('sente-label').textContent = '先手（' + (myIsP0 ? 'あなた' : '相手') + '）';
      document.getElementById('gote-label').textContent  = '後手（' + (myIsP1 ? 'あなた' : '相手') + '）';
    }

    // ターンハイライト
    document.getElementById('sente-panel').classList.toggle('panel-active', gameState.turn === 0);
    document.getElementById('gote-panel').classList.toggle('panel-active',  gameState.turn === 1);

    // 壁ボタン: 観戦・自分のターン以外は無効
    const isSpectator = myIndex === -1;
    const myP = myIndex === -1 ? null : gameState.players[myIndex];
    document.getElementById('btn-mode-wallh').disabled = isSpectator || myP.wallsLeft <= 0 || !myTurn;
    document.getElementById('btn-mode-wallv').disabled = isSpectator || myP.wallsLeft <= 0 || !myTurn;
    document.getElementById('btn-mode-move').disabled  = isSpectator || !myTurn;
  }

  // ─────────────────────────────────────────────────────────
  //  ロビーイベント
  // ─────────────────────────────────────────────────────────
  function _bindLobbyEvents() {

    // ── ルーム作成 ──────────────────────────────────────────
    document.getElementById('btn-create').addEventListener('click', async () => {
      const name = document.getElementById('input-name').value.trim();
      if (!name) { _flashError('input-name', '名前を入力してください'); return; }

      playerNames[0] = name;
      localStorage.setItem('ws_player_name', name);
      _setLoading('btn-create', true);

      try {
        const code = await Network.createRoom(name);
        myIndex = 0;
        _gameStarted = false;
        _setUrl(code);
        document.getElementById('room-code-display').textContent = code;
        showScreen('screen-waiting');
        setStatus('相手の参加を待っています…');
      } catch (e) {
        console.error(e);
        alert('ルーム作成に失敗しました。Supabase設定を確認してください。\n' + e.message);
      } finally {
        _setLoading('btn-create', false);
      }
    });

    // ── ルーム参加 ──────────────────────────────────────────
    document.getElementById('btn-join').addEventListener('click', async () => {
      const name = document.getElementById('input-name').value.trim();
      const code = document.getElementById('input-room-code').value.trim();
      if (!name) { _flashError('input-name', '名前を入力してください'); return; }
      if (!code) { _flashError('input-room-code', 'ルームコードを入力してください'); return; }

      playerNames[1] = name;
      localStorage.setItem('ws_player_name', name);
      _setLoading('btn-join', true);
      _setUrl(code);

      try {
        myIndex = await Network.joinRoom(code, name);
        // join_ack または room_full を待つ
      } catch (e) {
        console.error(e);
        alert('参加に失敗しました: ' + e.message);
        _setLoading('btn-join', false);
      }
    });

    // ── 観戦 ────────────────────────────────────────────────
    document.getElementById('btn-spectate').addEventListener('click', async () => {
      const code = document.getElementById('input-room-code').value.trim();
      if (!code) { _flashError('input-room-code', 'ルームコードを入力してください'); return; }

      _setLoading('btn-spectate', true);
      _setUrl(code);
      try {
        await Network.spectateRoom(code);
        myIndex = -1;
        showScreen('screen-waiting');
        setStatus('観戦を待っています…');
      } catch (e) {
        console.error(e);
        alert('観戦に失敗しました: ' + e.message);
        _setLoading('btn-spectate', false);
      }
    });

    // ── ルームコードコピー ───────────────────────────────────
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = document.getElementById('room-code-display').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btn-copy-code');
        btn.textContent = 'コピーしました！';
        setTimeout(() => { btn.textContent = 'コードをコピー'; }, 2000);
      });
    });

    // ── リンクコピー ────────────────────────────────────────
    document.getElementById('btn-copy-link').addEventListener('click', () => {
      const code = document.getElementById('room-code-display').textContent;
      const url  = `${location.origin}${location.pathname}?code=${code}`;
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('btn-copy-link');
        btn.textContent = 'コピーしました！';
        setTimeout(() => { btn.textContent = 'リンクをコピー'; }, 2000);
      });
    });

    // ── モードボタン ────────────────────────────────────────
    document.getElementById('btn-mode-move').addEventListener('click',  () => setInputMode('move'));
    document.getElementById('btn-mode-wallh').addEventListener('click', () => setInputMode('wall-h'));
    document.getElementById('btn-mode-wallv').addEventListener('click', () => setInputMode('wall-v'));

    // ── リスタート ─────────────────────────────────────────
    document.getElementById('btn-restart').addEventListener('click', () => {
      Network.leave();
      _clearUrl();
      document.getElementById('result-overlay').classList.remove('show');
      gameState    = null;
      myIndex      = -1;
      inputMode    = 'move';
      highlights   = [];
      wallPreview  = null;
      playerNames  = ['', ''];
      _gameStarted = false;
      document.getElementById('input-room-code').value = '';
      showScreen('screen-lobby');
    });
  }

  // ─────────────────────────────────────────────────────────
  //  ネットワークイベント
  // ─────────────────────────────────────────────────────────
  function _bindNetworkEvents() {

    // ゲスト参加通知 → ホストに届く
    Network.onOpponentJoined(async (opponentName, firstTurn) => {
      if (myIndex === 0) {
        // ホスト側
        if (_gameStarted) {
          // すでにゲーム中 → 満員通知して観戦に誘導
          await Network.sendRoomFull();
          // 観戦者として state_sync を送る
          return;
        }
        // 正常な参加 → ゲーム開始
        playerNames[1] = opponentName;
        const ft = Math.random() < 0.5 ? 0 : 1;
        await Network.ackJoin(playerNames[0], ft);
        _gameStarted = true;
        _startGame(playerNames[0], playerNames[1], ft);
      } else {
        // ゲスト: ホスト名と先手情報が届いた → ゲーム開始
        playerNames[0] = opponentName;
        _gameStarted = true;
        _startGame(playerNames[0], playerNames[1], firstTurn);
        _setLoading('btn-join', false);
      }
    });

    // 3人目以降: 満員のため観戦モードに強制移行
    Network.onForcedSpectate(() => {
      myIndex = -1;
      _setLoading('btn-join', false);
      showScreen('screen-waiting');
      setStatus('満員のため観戦モードに切り替えました…');
    });

    // 観戦者が参加 → ホストが現在の状態を送信
    Network.onSpectatorJoined(() => {
      if (!gameState || myIndex !== 0) return;
      Network.sendStateSync(gameState, playerNames[0], playerNames[1]);
    });

    // 観戦者: 状態を受信してゲーム画面へ
    Network.onSpectateSync((state, nameA, nameB) => {
      gameState = Game.deepCloneState(state);
      myIndex   = -1;
      inputMode = 'move';
      playerNames[0] = nameA;
      playerNames[1] = nameB;
      showScreen('screen-game');
      updatePlayerInfo();
      _updateTurnStatus();
      Render.draw(gameState, myIndex, highlights, null);
      _setLoading('btn-spectate', false);
    });

    // 相手のアクションを受信
    Network.onGameAction((action) => {
      _applyRemoteAction(action);
    });

    // 相手が切断
    Network.onOpponentLeft(() => {
      // 観戦者 or ゲーム未開始 or 終了済みは無視
      if (myIndex === -1 || !gameState || gameState.over) return;
      Network.leave();
      _clearUrl();
      _gameStarted = false;
      document.getElementById('result-title').textContent = '相手が切断しました';
      document.getElementById('result-sub').textContent   = 'ロビーに戻ります';
      document.getElementById('result-overlay').style.setProperty('--result-color', 'var(--red)');
      document.getElementById('result-overlay').classList.add('show');
    });
  }

  // ─────────────────────────────────────────────────────────
  //  ゲーム開始
  // ─────────────────────────────────────────────────────────
  function _startGame(nameA, nameB, firstTurn = 0) {
    gameState = Game.createState(nameA, nameB, firstTurn);
    myIndex   = Network.getMyIndex();
    inputMode = 'move';

    showScreen('screen-game');
    _refreshHighlights();
    updatePlayerInfo();
    _updateTurnStatus();
    Render.draw(gameState, myIndex, highlights, wallPreview);
  }

  // ─────────────────────────────────────────────────────────
  //  Canvas マウス/タッチイベント
  // ─────────────────────────────────────────────────────────
  function _bindCanvasEvents() {

    // ── マウス ────────────────────────────────────────────
    canvas.addEventListener('mousemove', (e) => {
      if (!gameState || !myTurn || gameState.over) return;
      const { x, y } = _canvasPos(e);
      _onHover(x, y);
    });

    canvas.addEventListener('mouseleave', () => {
      wallPreview = null;
      if (gameState) Render.draw(gameState, myIndex, highlights, wallPreview);
    });

    canvas.addEventListener('click', (e) => {
      if (!gameState || !myTurn || gameState.over) return;
      const { x, y } = _canvasPos(e);
      _onClick(x, y);
    });

    // ── タッチ（ドラッグでプレビュー、ボタンで確定） ────────
    let touchStart = null;
    const DRAG_THRESHOLD = 18;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!gameState || !myTurn || gameState.over) return;
      const t = e.touches[0];
      touchStart = _canvasPosByClient(t.clientX, t.clientY);
      Render.draw(gameState, myIndex, highlights, wallPreview);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!gameState || !myTurn || gameState.over || !touchStart) return;
      const t = e.touches[0];
      const cur = _canvasPosByClient(t.clientX, t.clientY);
      const dx = cur.x - touchStart.x;
      const dy = cur.y - touchStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DRAG_THRESHOLD || gameState.players[myIndex].wallsLeft <= 0) {
        Render.draw(gameState, myIndex, highlights, wallPreview);
        return;
      }

      const dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      const hit = Render.xyWallHit(touchStart.x, touchStart.y, dir);
      if (hit) {
        const valid = Game.canPlaceWall(gameState, hit.c, hit.r, dir);
        wallPreview = { ...hit, dir, valid };
      } else {
        wallPreview = null;
      }
      _updateTouchBtns();
      Render.draw(gameState, myIndex, highlights, wallPreview);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!gameState || !myTurn || gameState.over || !touchStart) return;
      const t = e.changedTouches[0];
      const cur = _canvasPosByClient(t.clientX, t.clientY);
      const dx = cur.x - touchStart.x;
      const dy = cur.y - touchStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 短タップ → 移動
      if (dist < DRAG_THRESHOLD) {
        _onClick(touchStart.x, touchStart.y);
      }
      touchStart = null;
    }, { passive: false });

    // ── タッチ用ボタン ────────────────────────────────────

    // 移動モードに戻る
    document.getElementById('btn-touch-move').addEventListener('click', () => {
      wallPreview = null;
      inputMode = 'move';
      _updateTouchBtns();
      _refreshHighlights();
      Render.draw(gameState, myIndex, highlights, null);
    });

    // 壁設置確定
    document.getElementById('btn-touch-place').addEventListener('click', () => {
      if (!wallPreview || !wallPreview.valid) return;
      const { c, r, dir } = wallPreview;
      wallPreview = null;
      _updateTouchBtns();
      _doWall(c, r, dir);
    });

    // キャンセル → プレビュー破棄 & 移動モードへ
    document.getElementById('btn-touch-cancel').addEventListener('click', () => {
      wallPreview = null;
      inputMode = 'move';
      _updateTouchBtns();
      _refreshHighlights();
      Render.draw(gameState, myIndex, highlights, null);
    });
  }

  function _canvasPos(e) {
    return _canvasPosByClient(e.clientX, e.clientY);
  }

  function _canvasPosByClient(clientX, clientY) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  // ── ホバー ────────────────────────────────────────────────
  function _onHover(x, y) {
    if (inputMode === 'move') {
      wallPreview = null;
    } else {
      const dir = inputMode === 'wall-h' ? 'h' : 'v';
      const hit = Render.xyWallHit(x, y, dir);
      if (hit) {
        const valid = gameState.players[myIndex].wallsLeft > 0 && Game.canPlaceWall(gameState, hit.c, hit.r, dir);
        wallPreview = { ...hit, dir, valid };
      } else {
        wallPreview = null;
      }
    }
    Render.draw(gameState, myIndex, highlights, wallPreview);
  }

  // ── クリック ─────────────────────────────────────────────
  function _onClick(x, y) {
    if (inputMode === 'move') {
      const cell = Render.xyCellHit(x, y);
      if (!cell) return;
      const isHighlighted = highlights.some(h => h.col === cell.col && h.row === cell.row);
      if (!isHighlighted) return;
      _doMove(cell.col, cell.row);
    } else {
      const dir = inputMode === 'wall-h' ? 'h' : 'v';
      const hit = Render.xyWallHit(x, y, dir);
      if (!hit) return;
      if (gameState.players[myIndex].wallsLeft <= 0) {
        setStatus('壁が残っていません');
        return;
      }
      if (!Game.canPlaceWall(gameState, hit.c, hit.r, dir)) {
        setStatus('ここには壁を置けません');
        return;
      }
      _doWall(hit.c, hit.r, dir);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  アクション実行
  // ─────────────────────────────────────────────────────────
  function _doMove(col, row) {
    gameState = Game.applyMove(gameState, myIndex, col, row);
    Network.sendAction({ type: 'move', col, row });
    _afterAction();
  }

  function _doWall(c, r, dir) {
    gameState = Game.applyWall(gameState, myIndex, c, r, dir);
    Network.sendAction({ type: 'wall', c, r, dir });
    inputMode = 'move';
    setModeBtn('move');
    wallPreview = null;
    _updateTouchBtns();
    _afterAction();
  }

  // ── タッチ用ボタン状態更新 ────────────────────────────────
  function _updateTouchBtns() {
    const hasPreview = !!wallPreview;
    const canPlace   = hasPreview && wallPreview.valid;
    const placeBtn   = document.getElementById('btn-touch-place');
    const cancelBtn  = document.getElementById('btn-touch-cancel');
    if (!placeBtn) return;
    placeBtn.disabled  = !canPlace;
    cancelBtn.disabled = !hasPreview;
    placeBtn.classList.toggle('preview-ready',  canPlace);
    cancelBtn.classList.toggle('preview-ready', hasPreview);
  }

  // ─────────────────────────────────────────────────────────
  //  リモートアクション受信
  // ─────────────────────────────────────────────────────────
  function _applyRemoteAction(action) {
    if (!gameState || gameState.over) return;
    const actorIndex = myIndex === -1 ? gameState.turn : 1 - myIndex;

    if (action.type === 'move') {
      gameState = Game.applyMove(gameState, actorIndex, action.col, action.row);
    } else if (action.type === 'wall') {
      gameState = Game.applyWall(gameState, actorIndex, action.c, action.r, action.dir);
    }
    _afterAction();
  }

  // ─────────────────────────────────────────────────────────
  //  アクション後の処理
  // ─────────────────────────────────────────────────────────
  function _afterAction() {
    if (gameState.over) {
      _refreshHighlights();
      updatePlayerInfo();
      Render.draw(gameState, myIndex, highlights, null);
      _showWinOverlay();
      return;
    }

    _refreshHighlights();
    updatePlayerInfo();
    _updateTurnStatus();
    Render.draw(gameState, myIndex, highlights, null);
  }

  function _refreshHighlights() {
    myTurn = myIndex !== -1 && (gameState.turn === myIndex);
    highlights = (myTurn && !gameState.over && inputMode === 'move')
      ? Game.legalMoves(gameState, myIndex)
      : [];
    if (!myTurn) { wallPreview = null; _updateTouchBtns(); }
  }

  function _updateTurnStatus() {
    myTurn = myIndex !== -1 && (gameState.turn === myIndex);
    if (myIndex === -1) {
      const turnName = gameState.players[gameState.turn].name || `Player ${gameState.turn}`;
      setStatus(`観戦中 — ${turnName} のターン`);
      canvas.style.cursor = 'default';
    } else if (myTurn) {
      setStatus('あなたのターン');
      canvas.style.cursor = 'pointer';
    } else {
      setStatus('相手のターン…');
      canvas.style.cursor = 'default';
    }
  }

  // ─────────────────────────────────────────────────────────
  //  入力モード切替
  // ─────────────────────────────────────────────────────────
  function setInputMode(mode) {
    if (!myTurn || !gameState || gameState.over) return;
    inputMode = mode;
    setModeBtn(mode);
    wallPreview = null;
    _refreshHighlights();
    Render.draw(gameState, myIndex, highlights, wallPreview);
  }

  // ─────────────────────────────────────────────────────────
  //  勝利オーバーレイ
  // ─────────────────────────────────────────────────────────
  function _showWinOverlay() {
    const winner     = gameState.winner;
    const winnerName = gameState.players[winner].name || `Player ${winner}`;
    const isSpectator = myIndex === -1;
    const isMyWin    = winner === myIndex;

    if (isSpectator) {
      document.getElementById('result-title').textContent = winnerName;
      document.getElementById('result-sub').textContent   = 'の勝ち！';
      document.getElementById('result-overlay').style.setProperty('--result-color', winner === 0 ? 'var(--cyan)' : 'var(--red)');
    } else {
      document.getElementById('result-title').textContent = isMyWin ? '🎉 勝利！' : '😞 敗北…';
      document.getElementById('result-sub').textContent   = `${winnerName} の勝ち！`;
      document.getElementById('result-overlay').style.setProperty('--result-color', isMyWin ? 'var(--cyan)' : 'var(--red)');
    }

    document.getElementById('result-overlay').classList.add('show');
  }

  function showResultOverlay(isWin) {
    document.getElementById('result-overlay').classList.add('show');
  }

  // ─────────────────────────────────────────────────────────
  //  ユーティリティ
  // ─────────────────────────────────────────────────────────
  function _flashError(inputId, msg) {
    const el = document.getElementById(inputId);
    el.placeholder = msg;
    el.classList.add('input-error');
    setTimeout(() => {
      el.placeholder = '';
      el.classList.remove('input-error');
    }, 2000);
  }

  function _setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = loading ? '接続中…' : btn.dataset.originalText;
  }

  return { init };

})();

// ── エントリポイント ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => UI.init());