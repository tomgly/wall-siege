const UI = (() => {

  // ── 状態 ──────────────────────────────────────────────────
  let gameState   = null;
  let myIndex     = -1;
  let inputMode   = 'move';   // 'move' | 'wall-h' | 'wall-v'
  let highlights  = [];
  let wallPreview = null;
  let myTurn      = false;
  let playerNames = ['', ''];

  const canvas = document.getElementById('game-canvas');

  // ── 初期化 ────────────────────────────────────────────────
  function init() {
    Network.init();
    Render.init(canvas);
    _bindLobbyEvents();
    _bindCanvasEvents();
    _bindNetworkEvents();
    showScreen('screen-lobby');
  }

  // ─────────────────────────────────────────────────────────
  //  画面切替
  // ─────────────────────────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function setStatus(html) {
    document.getElementById('status-text').innerHTML = html;
  }

  function setModeBtn(mode) {
    document.getElementById('btn-mode-move').classList.toggle('mode-active', mode === 'move');
    document.getElementById('btn-mode-wallh').classList.toggle('mode-active', mode === 'wall-h');
    document.getElementById('btn-mode-wallv').classList.toggle('mode-active', mode === 'wall-v');
  }

  function updatePlayerInfo() {
    if (!gameState) return;
    const me  = gameState.players[myIndex];
    const opp = gameState.players[1 - myIndex];

    document.getElementById('my-name').textContent    = me.name  || 'あなた';
    document.getElementById('opp-name').textContent   = opp.name || '相手';
    document.getElementById('my-walls').textContent   = me.wallsLeft;
    document.getElementById('opp-walls').textContent  = opp.wallsLeft;

    document.getElementById('my-panel').classList.toggle('panel-active',  myTurn);
    document.getElementById('opp-panel').classList.toggle('panel-active', !myTurn);

    // 壁ボタン: 壁0なら無効化
    document.getElementById('btn-mode-wallh').disabled = me.wallsLeft <= 0 || !myTurn;
    document.getElementById('btn-mode-wallv').disabled = me.wallsLeft <= 0 || !myTurn;
    document.getElementById('btn-mode-move').disabled  = !myTurn;
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
      _setLoading('btn-create', true);

      try {
        const code = await Network.createRoom(name);
        myIndex = 0;

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
      _setLoading('btn-join', true);

      try {
        myIndex = await Network.joinRoom(code, name);
        // join_ack を待つ
      } catch (e) {
        console.error(e);
        alert('参加に失敗しました: ' + e.message);
        _setLoading('btn-join', false);
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

    // ── モードボタン ────────────────────────────────────────
    document.getElementById('btn-mode-move').addEventListener('click',  () => setInputMode('move'));
    document.getElementById('btn-mode-wallh').addEventListener('click', () => setInputMode('wall-h'));
    document.getElementById('btn-mode-wallv').addEventListener('click', () => setInputMode('wall-v'));

    // ── リスタート ─────────────────────────────────────────
    document.getElementById('btn-restart').addEventListener('click', () => {
      Network.leave();
      document.getElementById('result-overlay').classList.remove('show');
      gameState  = null;
      myIndex    = -1;
      inputMode  = 'move';
      highlights = [];
      wallPreview = null;
      playerNames = ['', ''];
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
        // ホスト: 先手をランダム決定して承認と一緒に送る
        playerNames[1] = opponentName;
        const ft = Math.random() < 0.5 ? 0 : 1;
        await Network.ackJoin(playerNames[0], ft);
        _startGame(playerNames[0], playerNames[1], ft);
      } else {
        // ゲスト: ホスト名と先手情報が届いた → ゲーム開始
        playerNames[0] = opponentName;
        _startGame(playerNames[0], playerNames[1], firstTurn);
        _setLoading('btn-join', false);
      }
    });

    // 相手のアクションを受信
    Network.onGameAction((action) => {
      _applyRemoteAction(action);
    });

    // 相手が切断
    Network.onOpponentLeft(() => {
      if (!gameState || gameState.over) return;
      setStatus('⚡ 相手が切断しました');
      document.getElementById('result-title').textContent = '相手が切断しました';
      document.getElementById('result-sub').textContent   = '接続が切れました';
      showResultOverlay(false);
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
  //  Canvas マウスイベント
  // ─────────────────────────────────────────────────────────
  function _bindCanvasEvents() {

    canvas.addEventListener('mousemove', (e) => {
      if (!gameState || !myTurn || gameState.over) return;
      const { x, y } = _canvasPos(e);
      _onHover(x, y);
    });

    canvas.addEventListener('mouseleave', () => {
      wallPreview = null;
      Render.draw(gameState, myIndex, highlights, wallPreview);
    });

    canvas.addEventListener('click', (e) => {
      if (!gameState || !myTurn || gameState.over) return;
      const { x, y } = _canvasPos(e);
      _onClick(x, y);
    });
  }

  function _canvasPos(e) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
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
        const valid = gameState.players[myIndex].wallsLeft > 0 &&
                      Game.canPlaceWall(gameState, hit.c, hit.r, dir);
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
    _afterAction();
  }

  // ─────────────────────────────────────────────────────────
  //  リモートアクション受信
  // ─────────────────────────────────────────────────────────
  function _applyRemoteAction(action) {
    if (!gameState || gameState.over) return;
    const oppIndex = 1 - myIndex;

    if (action.type === 'move') {
      gameState = Game.applyMove(gameState, oppIndex, action.col, action.row);
    } else if (action.type === 'wall') {
      gameState = Game.applyWall(gameState, oppIndex, action.c, action.r, action.dir);
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
    myTurn = (gameState.turn === myIndex);
    highlights = (myTurn && !gameState.over && inputMode === 'move')
      ? Game.legalMoves(gameState, myIndex)
      : [];
  }

  function _updateTurnStatus() {
    myTurn = (gameState.turn === myIndex);
    if (myTurn) {
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
    const winner = gameState.winner;
    const isMyWin = winner === myIndex;
    const winnerName = gameState.players[winner].name;

    document.getElementById('result-title').textContent = isMyWin ? '🎉 勝利！' : '😞 敗北…';
    document.getElementById('result-sub').textContent   = `${winnerName} の勝ち！`;

    const overlay = document.getElementById('result-overlay');
    overlay.classList.add('show');
    overlay.style.setProperty('--result-color', isMyWin ? 'var(--cyan)' : 'var(--red)');
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