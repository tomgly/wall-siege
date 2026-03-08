const CFG = Object.freeze({

  // ── Supabase ────────────────────────────────────────────────
  SUPABASE_URL : "%%SUPABASE_URL%%",
  SUPABASE_KEY : "%%SUPABASE_KEY%%",

  // ── ボード ──────────────────────────────────────────────────
  COLS      : 7,
  ROWS      : 7,
  MAX_WALLS : 5,

  // ── Canvas描画 ──────────────────────────────────────────────
  CELL   : 72,   // 1マスのピクセルサイズ
  PAD    : 32,   // 盤面の外側余白
  WALL_T : 9,    // 壁の太さ

  // ── 色 ──────────────────────────────────────────────────────
  // 自分
  COLOR_ME   : "#00e5ff",
  GLOW_ME    : "rgba(0,229,255,0.55)",
  WALL_ME    : "#0077aa",
  WALL_ME_GL : "rgba(0,180,255,0.5)",

  // 相手
  COLOR_OPP   : "#ff4d6d",
  GLOW_OPP    : "rgba(255,77,109,0.55)",
  WALL_OPP    : "#aa0030",
  WALL_OPP_GL : "rgba(255,60,80,0.5)",

  // ボード
  BG_CELL     : "#0b0b14",
  BG_CANVAS   : "#080810",
  GRID_LINE   : "rgba(255,255,255,0.045)",
  GRID_BORDER : "rgba(255,255,255,0.12)",
  GOAL_ME     : "rgba(0,229,255,0.07)",
  GOAL_OPP    : "rgba(255,77,109,0.07)",
  HIGHLIGHT   : "rgba(0,229,255,0.18)",
  HIGHLIGHT_BORDER : "rgba(0,229,255,0.7)",
  WALL_PREVIEW_OK  : "rgba(255,77,109,0.45)",
  WALL_PREVIEW_NG  : "rgba(255,80,80,0.18)",
});