const Render = (() => {

  let canvas, ctx;
  let W, H;

  function init(canvasEl) {
    canvas = canvasEl;
    const { COLS, ROWS, CELL, PAD } = CFG;
    W = COLS * CELL + PAD * 2;
    H = ROWS * CELL + PAD * 2;
    canvas.width  = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
  }

  function fitCanvas() {
    const { COLS, ROWS, CELL, PAD } = CFG;
    const rawW = COLS * CELL + PAD * 2;
    const rawH = ROWS * CELL + PAD * 2;
    const maxW = Math.min(window.innerWidth  - 32, 560);
    const maxH = Math.min(window.innerHeight - 280, 560);
    const scale = Math.min(maxW / rawW, maxH / rawH, 1);
    canvas.style.width  = (rawW * scale) + 'px';
    canvas.style.height = (rawH * scale) + 'px';
  }

  // ── 座標変換 ───────────────────────────────────────────────
  function cellToXY(col, row) {
    return {
      x: CFG.PAD + col * CFG.CELL,
      y: CFG.PAD + row * CFG.CELL,
    };
  }

  // canvas座標 → グリッドセル
  function xyCellHit(cx, cy) {
    const { PAD, CELL, COLS, ROWS } = CFG;
    const col = Math.floor((cx - PAD) / CELL);
    const row = Math.floor((cy - PAD) / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  // canvas座標 → 壁の交点（c, r） ＋ dir 判定
  // 壁モードでは「マス境界に近い位置」を認識する
  function xyWallHit(cx, cy, wallDir) {
    const { PAD, CELL, COLS, ROWS } = CFG;
    if (wallDir === 'h') {
      // 水平壁: 行境界に近い列・行を返す
      const c = Math.floor((cx - PAD) / CELL);
      const r = Math.floor((cy - PAD) / CELL - 0.5); // 境界基準
      if (c < 0 || c >= COLS - 1 || r < 0 || r >= ROWS - 1) return null;
      return { c, r };
    } else {
      const c = Math.floor((cx - PAD) / CELL - 0.5);
      const r = Math.floor((cy - PAD) / CELL);
      if (c < 0 || c >= COLS - 1 || r < 0 || r >= ROWS - 1) return null;
      return { c, r };
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  メイン描画
  // ─────────────────────────────────────────────────────────────
  function draw(state, myIndex, highlights, wallPreview) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawBg();
    drawGoalZones(state, myIndex);
    drawGrid();
    if (highlights && highlights.length) drawHighlights(highlights);
    if (wallPreview) drawWallPreview(wallPreview);
    drawWalls(state, myIndex);
    drawPieces(state, myIndex);
  }

  // ── 背景 ───────────────────────────────────────────────────
  function drawBg() {
    ctx.fillStyle = CFG.BG_CANVAS;
    ctx.fillRect(0, 0, W, H);
  }

  // ── ゴールゾーン ───────────────────────────────────────────
  function drawGoalZones(state, myIndex) {
    const { COLS, ROWS, CELL, PAD } = CFG;
    const boardW    = COLS * CELL;
    const firstTurn = state?.firstTurn ?? 0;


    // 先手のゴール色=SENTE、後手のゴール色=GOTE
    const p0Color = firstTurn === 0 ? CFG.GOAL_SENTE : CFG.GOAL_GOTE;
    const p1Color = firstTurn === 1 ? CFG.GOAL_SENTE : CFG.GOAL_GOTE;

    ctx.fillStyle = p1Color;  // 上端 = players[1] のゴール
    ctx.fillRect(PAD, PAD, boardW, CELL);
    ctx.fillStyle = p0Color;  // 下端 = players[0] のゴール
    ctx.fillRect(PAD, PAD + (ROWS - 1) * CELL, boardW, CELL);

    ctx.font = '600 9px "Space Mono", monospace';
    ctx.letterSpacing = '0.1em';

    const senteAlpha = firstTurn === 0 ? 'rgba(0,229,255,0.3)' : 'rgba(255,77,109,0.3)';
    const goteAlpha  = firstTurn === 1 ? 'rgba(0,229,255,0.3)' : 'rgba(255,77,109,0.3)';

    // 下端ラベル
    ctx.fillStyle = firstTurn === 0 ? senteAlpha : goteAlpha;
    ctx.fillText('先手のゴール', PAD + 4, PAD + (ROWS - 1) * CELL + 14);
    // 上端ラベル
    ctx.fillStyle = firstTurn === 1 ? senteAlpha : goteAlpha;    ctx.fillText('後手のゴール', PAD + 4, PAD + 14);
  }

  // ── グリッド ───────────────────────────────────────────────
  function drawGrid() {
    const { COLS, ROWS, CELL, PAD } = CFG;
    ctx.strokeStyle = CFG.GRID_LINE;
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(PAD + c * CELL, PAD);
      ctx.lineTo(PAD + c * CELL, PAD + ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(PAD,             PAD + r * CELL);
      ctx.lineTo(PAD + COLS * CELL, PAD + r * CELL);
      ctx.stroke();
    }
    // 外枠
    ctx.strokeStyle = CFG.GRID_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, COLS * CELL, ROWS * CELL);
  }

  // ── 移動ハイライト ─────────────────────────────────────────
  function drawHighlights(cells) {
    const { CELL, PAD } = CFG;
    for (const { col, row } of cells) {
      const x = PAD + col * CELL;
      const y = PAD + row * CELL;
      const m = 3;

      ctx.fillStyle = CFG.HIGHLIGHT;
      ctx.fillRect(x + m, y + m, CELL - m * 2, CELL - m * 2);

      ctx.strokeStyle = CFG.HIGHLIGHT_BORDER;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + m, y + m, CELL - m * 2, CELL - m * 2);

      // 角の菱形マーカー
      ctx.fillStyle = CFG.HIGHLIGHT_BORDER;
      const s = 4;
      [[x+m+4, y+m+4], [x+CELL-m-8, y+m+4], [x+m+4, y+CELL-m-8], [x+CELL-m-8, y+CELL-m-8]]
        .forEach(([px, py]) => ctx.fillRect(px, py, s, s));
    }
  }

  // ── 壁プレビュー ───────────────────────────────────────────
  function drawWallPreview({ c, r, dir, valid }) {
    const { CELL, PAD, WALL_T } = CFG;
    ctx.fillStyle = valid ? CFG.WALL_PREVIEW_OK : CFG.WALL_PREVIEW_NG;
    if (dir === 'h') {
      ctx.fillRect(
        PAD + c * CELL,
        PAD + (r + 1) * CELL - WALL_T / 2,
        CELL * 2,
        WALL_T
      );
    } else {
      ctx.fillRect(
        PAD + (c + 1) * CELL - WALL_T / 2,
        PAD + r * CELL,
        WALL_T,
        CELL * 2
      );
    }
  }

  // ── 壁 ─────────────────────────────────────────────────────
  // 先手の壁=青、後手の壁=赤 で統一
  function drawWalls(state, myIndex) {
    const { CELL, PAD, WALL_T } = CFG;
    const firstTurn = state.firstTurn ?? 0;

    function wallStyle(owner) {
      const isSente = owner === firstTurn;
      return isSente ? { color: CFG.WALL_SENTE,    shadow: CFG.WALL_SENTE_GL } : { color: CFG.WALL_GOTE,     shadow: CFG.WALL_GOTE_GL  };
    }

    for (const { c, r, owner } of state.walls.h) {
      const { color, shadow } = wallStyle(owner);
      const x = PAD + c * CELL;
      const y = PAD + (r + 1) * CELL;
      ctx.save();
      ctx.shadowColor = shadow;
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = color;
      ctx.fillRect(x, y - WALL_T / 2, CELL * 2, WALL_T);
      ctx.restore();
    }

    for (const { c, r, owner } of state.walls.v) {
      const { color, shadow } = wallStyle(owner);
      const x = PAD + (c + 1) * CELL;
      const y = PAD + r * CELL;
      ctx.save();
      ctx.shadowColor = shadow;
      ctx.shadowBlur  = 10;
      ctx.fillStyle   = color;
      ctx.fillRect(x - WALL_T / 2, y, WALL_T, CELL * 2);
      ctx.restore();
    }
  }

  // ── コマ ───────────────────────────────────────────────────
  // 先手 = シアン、後手 = 赤 で統一
  function drawPieces(state, myIndex) {
    const firstTurn = state.firstTurn ?? 0;
    state.players.forEach((p, idx) => {
      const isSente = idx === firstTurn;
      const color = isSente ? CFG.COLOR_SENTE : CFG.COLOR_GOTE;
      const glow  = isSente ? CFG.GLOW_SENTE  : CFG.GLOW_GOTE;
      const isTurn = state.turn === idx;
      drawPiece(p.col, p.row, color, glow, isTurn);
    });
  }

  function drawPiece(col, row, color, glowColor, active) {
    const { CELL, PAD } = CFG;
    const cx = PAD + col * CELL + CELL / 2;
    const cy = PAD + row * CELL + CELL / 2;
    const r  = CELL * 0.28;

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = active ? 28 : 12;

    // 外リング
    ctx.strokeStyle = color;
    ctx.lineWidth   = active ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // 塗り
    const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 1, cx, cy, r - 2);
    grad.addColorStop(0, color + 'ee');
    grad.addColorStop(1, color + '33');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.fill();

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  //  公開API
  // ─────────────────────────────────────────────────────────────
  return { init, draw, xyCellHit, xyWallHit, fitCanvas };

})();