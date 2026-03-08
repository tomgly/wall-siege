const Network = (() => {

  let _supabase = null;
  let _channel  = null;
  let _roomCode = "";
  let _myIndex  = -1;   // 0=ホスト(上), 1=ゲスト(下), -1=観戦

  // コールバック
  let _onOpponentJoined  = null;  // (opponentName, firstTurn) => void
  let _onGameAction      = null;  // (action) => void
  let _onOpponentLeft    = null;  // () => void
  let _onSpectateSync    = null;  // (gameState, nameA, nameB) => void

  // ── Supabase 初期化 ────────────────────────────────────────
  function init() {
    _supabase = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  }

  // ── ランダムルームコード生成 ────────────────
  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // ── ルーム作成 ───────────────
  async function createRoom(playerName) {
    _roomCode = generateRoomCode();
    _myIndex  = 0;
    await _joinChannel(playerName);
    return _roomCode;
  }

  // ── ルーム参加 ─────────
  async function joinRoom(roomCode, playerName) {
    _roomCode = roomCode.toUpperCase().trim();
    _myIndex  = 1;
    await _joinChannel(playerName);
    return _myIndex;
  }

  // ── 観戦参加 ───────────────────────────────
  async function spectateRoom(roomCode) {
    _roomCode = roomCode.toUpperCase().trim();
    _myIndex  = -1;
    await _joinChannel(null);
    // 観戦者が入ったことをチャンネルに知らせ、ホストに状態送信を促す
    await _channel.send({
      type: 'broadcast',
      event: 'spectator_join',
      payload: {}
    });
  }

  // ── チャンネル接続・イベント登録 ──────────────────────────
  async function _joinChannel(playerName) {
    if (_channel) {
      await _supabase.removeChannel(_channel);
    }

    const channelName = `room:${_roomCode}`;
    _channel = _supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    // ── イベント受信 ─────────────────────────────────────────

    // 相手が参加してきた
    _channel.on('broadcast', { event: 'player_join' }, ({ payload }) => {
      if (_onOpponentJoined) _onOpponentJoined(payload.name, null);
    });

    // ホストがゲストの参加を承認して返す
    _channel.on('broadcast', { event: 'join_ack' }, ({ payload }) => {
      if (_onOpponentJoined) _onOpponentJoined(payload.hostName, payload.firstTurn);
    });

    // ゲームアクション
    _channel.on('broadcast', { event: 'game_action' }, ({ payload }) => {
      if (_onGameAction) _onGameAction(payload);
    });

    // 相手が切断
    _channel.on('broadcast', { event: 'player_leave' }, () => {
      if (_onOpponentLeft) _onOpponentLeft();
    });

    // 観戦者向けに現在の状態を受信
    _channel.on('broadcast', { event: 'state_sync' }, ({ payload }) => {
      if (_myIndex === -1 && _onSpectateSync) {
        _onSpectateSync(payload.state, payload.nameA, payload.nameB);
      }
    });

    // 観戦者が参加してきた → ホストが state_sync を送る
    _channel.on('broadcast', { event: 'spectator_join' }, () => {
      if (_myIndex === 0) {
        // ホスト側: ui.js の _onSpectatorJoined コールバックを呼ぶ
        if (_onSpectatorJoined) _onSpectatorJoined();
      }
    });

    // ── 接続確立 ─────────────────────────────────────────────
    await new Promise((resolve, reject) => {
      _channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR') reject(new Error('チャンネル接続失敗'));
      });
    });

    // ゲストなら参加通知を送る
    if (_myIndex === 1) {
      await _channel.send({
        type: 'broadcast',
        event: 'player_join',
        payload: { name: playerName }
      });
    }
  }

  // ── ゲスト参加承認 ────────────────────────
  async function ackJoin(hostName, firstTurn) {
    await _channel.send({
      type: 'broadcast',
      event: 'join_ack',
      payload: { hostName, firstTurn }
    });
  }

  // ── 観戦者に現在の状態を送信 ──────────────
  async function sendStateSync(state, nameA, nameB) {
    if (!_channel) return;
    await _channel.send({
      type: 'broadcast',
      event: 'state_sync',
      payload: { state, nameA, nameB }
    });
  }

  // ── ゲームアクション送信 ──────────────────────────────────
  async function sendAction(action) {
    if (!_channel) return;
    await _channel.send({
      type: 'broadcast',
      event: 'game_action',
      payload: action
    });
  }

  // ── 切断通知 ──────────────────────────────────────────────
  async function leave() {
    if (!_channel) return;
    await _channel.send({
      type: 'broadcast',
      event: 'player_leave',
      payload: {}
    }).catch(() => {});
    await _supabase.removeChannel(_channel);
    _channel = null;
  }

  // ── コールバック設定 ──────────────────────────────────────
  let _onSpectatorJoined = null;
  function onOpponentJoined(fn)  { _onOpponentJoined  = fn; }
  function onGameAction(fn)      { _onGameAction      = fn; }
  function onOpponentLeft(fn)    { _onOpponentLeft    = fn; }
  function onSpectateSync(fn)    { _onSpectateSync    = fn; }
  function onSpectatorJoined(fn) { _onSpectatorJoined = fn; }

  // ── ゲッター ──────────────────────────────────────────────
  function getMyIndex()  { return _myIndex;  }
  function getRoomCode() { return _roomCode; }

  return {
    init,
    createRoom,
    joinRoom,
    spectateRoom,
    ackJoin,
    sendStateSync,
    sendAction,
    leave,
    onOpponentJoined,
    onGameAction,
    onOpponentLeft,
    onSpectateSync,
    onSpectatorJoined,
    getMyIndex,
    getRoomCode,
  };

})();