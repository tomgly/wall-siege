const Network = (() => {

  let _supabase = null;
  let _channel  = null;
  let _roomCode = "";
  let _myIndex  = -1;

  // コールバック
  let _onOpponentJoined = null;  // (opponentName) => void
  let _onGameAction     = null;  // (action) => void
  let _onOpponentLeft   = null;  // () => void

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
      if (_onOpponentJoined) _onOpponentJoined(payload.name);
    });

    // ホストがゲストの参加を承認して返す
    _channel.on('broadcast', { event: 'join_ack' }, ({ payload }) => {
      if (_onOpponentJoined) _onOpponentJoined(payload.hostName);
    });

    // ゲームアクション
    _channel.on('broadcast', { event: 'game_action' }, ({ payload }) => {
      if (_onGameAction) _onGameAction(payload);
    });

    // 相手が切断
    _channel.on('broadcast', { event: 'player_leave' }, () => {
      if (_onOpponentLeft) _onOpponentLeft();
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
  async function ackJoin(hostName) {
    await _channel.send({
      type: 'broadcast',
      event: 'join_ack',
      payload: { hostName }
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
  function onOpponentJoined(fn) { _onOpponentJoined = fn; }
  function onGameAction(fn)     { _onGameAction     = fn; }
  function onOpponentLeft(fn)   { _onOpponentLeft   = fn; }

  // ── ゲッター ──────────────────────────────────────────────
  function getMyIndex()  { return _myIndex;  }
  function getRoomCode() { return _roomCode; }

  return {
    init,
    createRoom,
    joinRoom,
    ackJoin,
    sendAction,
    leave,
    onOpponentJoined,
    onGameAction,
    onOpponentLeft,
    getMyIndex,
    getRoomCode,
  };

})();