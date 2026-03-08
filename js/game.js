const Game = (() => {

  // ── 初期状態を生成 ─────────────────────────────────────────
  // firstTurn: 0 or 1
  // 後手は壁+1本のハンデ
  function createState(nameA, nameB, firstTurn = 0) {
    const secondTurn = 1 - firstTurn;
    const walls = [CFG.MAX_WALLS, CFG.MAX_WALLS];
    walls[secondTurn] += 1;   // 後手に +1本
    return {
      players: [
        { name: nameA, col: 3, row: 0, wallsLeft: walls[0] }, // A = 上 → ゴール row6
        { name: nameB, col: 3, row: 6, wallsLeft: walls[1] }, // B = 下 → ゴール row0
      ],
      walls: { h: [], v: [] },  // h[]: {c, r, owner}  v[]: {c, r, owner}
      turn: firstTurn,  // 0=A, 1=B（ランダム先手）
      over: false,
      winner: null // 0 or 1
    };
  }

  // ── 壁キー ─────────────────────────────────────────────────
  function wk(c, r) { return `${c},${r}`; }

  function wallSets(state) {
    return {
      h: new Set(state.walls.h.map(w => wk(w.c, w.r))),
      v: new Set(state.walls.v.map(w => wk(w.c, w.r))),
    };
  }

  function blockedByWall(ws, col, row, dir) {
    if (dir === 'up') {
      // 上に移動 = row と row-1 の境を越える
      // その境を塞ぐ水平壁: hKey(col, row-1) か hKey(col-1, row-1)
      return ws.h.has(wk(col, row - 1)) || ws.h.has(wk(col - 1, row - 1));
    }
    if (dir === 'down') {
      return ws.h.has(wk(col, row)) || ws.h.has(wk(col - 1, row));
    }
    if (dir === 'left') {
      // 左に移動 = col と col-1 の境を越える
      // その境を塞ぐ垂直壁: vKey(col-1, row) か vKey(col-1, row-1)
      return ws.v.has(wk(col - 1, row)) || ws.v.has(wk(col - 1, row - 1));
    }
    if (dir === 'right') {
      return ws.v.has(wk(col, row)) || ws.v.has(wk(col, row - 1));
    }
    return false;
  }

  function canStep(state, col, row, dir) {
    const { COLS, ROWS } = CFG;
    if (dir === 'up'    && row === 0)        return false;
    if (dir === 'down'  && row === ROWS - 1) return false;
    if (dir === 'left'  && col === 0)        return false;
    if (dir === 'right' && col === COLS - 1) return false;
    return !blockedByWall(wallSets(state), col, row, dir);
  }

  const DIR_DELTA = {
    up:    [  0, -1 ],
    down:  [  0,  1 ],
    left:  [ -1,  0 ],
    right: [  1,  0 ],
  };

  // ── 隣接セル列挙（BFS用・コマ無視） ───────────────────────
  function neighbors(state, col, row) {
    const result = [];
    for (const [dir, [dc, dr]] of Object.entries(DIR_DELTA)) {
      if (canStep(state, col, row, dir)) {
        result.push({ col: col + dc, row: row + dr });
      }
    }
    return result;
  }

  // ── BFS: goalRow に到達できるか ────────────────────────────
  function hasPath(state, startCol, startRow, goalRow) {
    const visited = new Set([wk(startCol, startRow)]);
    const queue   = [{ col: startCol, row: startRow }];
    while (queue.length) {
      const { col, row } = queue.shift();
      if (row === goalRow) return true;
      for (const nb of neighbors(state, col, row)) {
        const k = wk(nb.col, nb.row);
        if (!visited.has(k)) { visited.add(k); queue.push(nb); }
      }
    }
    return false;
  }

  // ── 合法移動先を取得（跳び越し・貫通なし） ───────────────
  function legalMoves(state, pIdx) {
    const me    = state.players[pIdx];
    const other = state.players[1 - pIdx];
    const result = [];

    for (const [dir, [dc, dr]] of Object.entries(DIR_DELTA)) {
      if (!canStep(state, me.col, me.row, dir)) continue;
      const nc = me.col + dc;
      const nr = me.row + dr;
      // 相手コマがいるマスには移動不可
      if (nc === other.col && nr === other.row) continue;
      result.push({ col: nc, row: nr });
    }
    return result;
  }

  // ── 壁設置の合法判定 ───────────────────────────────────────
  function canPlaceWall(state, c, r, dir) {
    const { COLS, ROWS } = CFG;
    // 盤外チェック（壁は2マス分なので -1）
    if (c < 0 || r < 0 || c >= COLS - 1 || r >= ROWS - 1) return false;

    const ws = wallSets(state);

    if (dir === 'h') {
      // 重複: 同じ起点 or 1マス右にずれた水平壁
      if (ws.h.has(wk(c, r)) || ws.h.has(wk(c + 1, r))) return false;
      // 垂直壁との交差（同じ起点の垂直壁）
      if (ws.v.has(wk(c, r))) return false;
    } else {
      // 重複: 同じ起点 or 1マス下にずれた垂直壁
      if (ws.v.has(wk(c, r)) || ws.v.has(wk(c, r + 1))) return false;
      // 水平壁との交差
      if (ws.h.has(wk(c, r))) return false;
    }

    // 仮置きして経路確認
    const tmp = deepCloneState(state);
    if (dir === 'h') tmp.walls.h.push({ c, r });
    else             tmp.walls.v.push({ c, r });

    const p0 = tmp.players[0];
    const p1 = tmp.players[1];
    return (
      hasPath(tmp, p0.col, p0.row, ROWS - 1) &&
      hasPath(tmp, p1.col, p1.row, 0)
    );
  }

  // ── 状態のディープコピー ───────────────────────────────────
  function deepCloneState(state) {
    return {
      players: state.players.map(p => ({ ...p })),
      walls: {
        h: state.walls.h.map(w => ({ ...w })),
        v: state.walls.v.map(w => ({ ...w })),
      },
      turn      : state.turn,
      firstTurn : state.firstTurn ?? 0,
      over      : state.over,
      winner    : state.winner,
    };
  }

  // ── アクション適用 ──────────
  function applyMove(state, pIdx, col, row) {
    const next = deepCloneState(state);
    next.players[pIdx].col = col;
    next.players[pIdx].row = row;

    // 勝利チェック
    const goalRow = pIdx === 0 ? CFG.ROWS - 1 : 0;
    if (row === goalRow) {
      next.over   = true;
      next.winner = pIdx;
    } else {
      next.turn = 1 - pIdx;
    }
    return next;
  }

  function applyWall(state, pIdx, c, r, dir) {
    const next = deepCloneState(state);
    if (dir === 'h') next.walls.h.push({ c, r, owner: pIdx });
    else next.walls.v.push({ c, r, owner: pIdx });
    next.players[pIdx].wallsLeft--;
    next.turn = 1 - pIdx;
    return next;
  }

  // ── 公開API ───────────────────────────────────────────────
  return {
    createState,
    legalMoves,
    canPlaceWall,
    applyMove,
    applyWall,
    deepCloneState,
    hasPath,
    wk,
  };

})();