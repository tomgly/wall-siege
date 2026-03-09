const CFG = Object.freeze({

  // ── Supabase ────────────────────────────────────────────────
  SUPABASE_URL : "https://tpkeypzlbckjjkeepwkt.supabase.co",
  SUPABASE_KEY : "sb_publishable_2_L2UyBcEZ9RarUN89OORw_j2fbVteP",

  // ── ボード ──────────────────────────────────────────────────
  COLS      : 7,
  ROWS      : 7,
  MAX_WALLS : 5,

  // ── Canvas描画 ──────────────────────────────────────────────
  CELL   : 72,   // 1マスのピクセルサイズ
  PAD    : 32,   // 盤面の外側余白
  WALL_T : 9,    // 壁の太さ

  // ── 色 ──────────────────────────────────────────────────────
  // 先手
  COLOR_SENTE   : "#00e5ff",
  GLOW_SENTE    : "rgba(0,229,255,0.55)",
  WALL_SENTE    : "#1166cc",
  WALL_SENTE_GL : "rgba(0,150,255,0.7)",
  GOAL_SENTE    : "rgba(0,229,255,0.07)",

  // 後手
  COLOR_GOTE   : "#ff4d6d",
  GLOW_GOTE    : "rgba(255,77,109,0.55)",
  WALL_GOTE    : "#cc1133",
  WALL_GOTE_GL : "rgba(255,60,80,0.7)",
  GOAL_GOTE    : "rgba(255,77,109,0.07)",

  // ボード
  BG_CELL     : "#0b0b14",
  BG_CANVAS   : "#080810",
  GRID_LINE   : "rgba(255,255,255,0.045)",
  GRID_BORDER : "rgba(255,255,255,0.12)",
  HIGHLIGHT   : "rgba(0,229,255,0.18)",
  HIGHLIGHT_BORDER : "rgba(0,229,255,0.7)",
  WALL_PREVIEW_OK  : "rgba(255,77,109,0.45)",
  WALL_PREVIEW_NG  : "rgba(255,80,80,0.18)",
});