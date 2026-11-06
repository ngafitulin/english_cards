/* Шакал — движок правил (классическая версия, 117 клеток). Чистая логика без DOM. */
(function (root) {
  'use strict';
  const N = 13;
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const U=[-1,0],D=[1,0],L=[0,-1],R=[0,1],UL=[-1,-1],UR=[-1,1],DL=[1,-1],DR=[1,1];

  const SIDES = {
    S: { r: 12, c: 6, fwd: [-1, 0], axis: 'c' },
    W: { r: 6, c: 0, fwd: [0, 1], axis: 'r' },
    N: { r: 0, c: 6, fwd: [1, 0], axis: 'c' },
    E: { r: 6, c: 12, fwd: [0, -1], axis: 'r' },
  };
  const TEAM_INFO = {
    S: { name: 'Красные', color: '#e0484d', ink: '#fff' },
    W: { name: 'Жёлтые', color: '#eab308', ink: '#1d1a16' },
    N: { name: 'Чёрные', color: '#26262b', ink: '#fff' },
    E: { name: 'Белые', color: '#f4f4f5', ink: '#1d1a16' },
  };
  const MODES = {
    '2x1': { label: '2 игрока, по 1 команде', players: 2, teams: [['S',0],['N',1]] },
    '2x2': { label: '2 игрока, по 2 команды (как в правилах)', players: 2, teams: [['S',0],['W',1],['N',0],['E',1]] },
    'p3':  { label: '3 игрока', players: 3, teams: [['S',0],['W',1],['N',2]] },
    'p4':  { label: '4 игрока, каждый за себя', players: 4, teams: [['S',0],['W',1],['N',2],['E',3]] },
    '2v2': { label: '4 игрока, двое на двое', players: 4, teams: [['S',0],['W',1],['N',2],['E',3]], alliance: true },
  };
  const TILE = {
    empty:   { name: 'Пустая клетка', d: 'Ничего не происходит.' },
    arrow:   { name: 'Стрелка', d: 'Пират сразу идёт по стрелке. Если стрелок несколько — выбирает любую. Стрелка в воду — пират плывёт.' },
    horse:   { name: 'Конь', d: 'Пират сразу прыгает ходом шахматного коня.' },
    ice:     { name: 'Лёд', d: 'Пират сразу повторяет свой предыдущий ход (в т.ч. ход конём).' },
    croc:    { name: 'Крокодил', d: 'Пират возвращается на клетку, с которой пришёл.' },
    cannibal:{ name: 'Людоед', d: 'Пират погибает.' },
    trap:    { name: 'Капкан', d: 'Пират застревает, пока на клетку не придёт свой (или союзный) пират.' },
    rum:     { name: 'Бочонок рома', d: 'Пират пропускает следующий ход своей команды.' },
    maze:    { name: 'Вертушка', d: 'Цифра — сколько ходов идти через клетку. Бить можно только того, кто на один шаг впереди.' },
    fort:    { name: 'Крепость', d: 'Здесь пирата нельзя побить. Нельзя войти с монетой или если внутри враг.' },
    revive:  { name: 'Крепость с аборигенкой', d: 'Как крепость. Пират здесь может потратить ход и воскресить погибшего товарища.' },
    chest:   { name: 'Сундук', d: 'Монеты. Пират уносит по одной.' },
    balloon: { name: 'Воздушный шар', d: 'Сразу уносит пирата (с монетой) на его корабль.' },
    plane:   { name: 'Самолёт', d: 'Один раз за игру переносит пирата на любую клетку острова или на корабль.' },
    cannon:  { name: 'Пушка', d: 'Выстреливает пирата в море по направлению ствола. Свой корабль — с монетой на борт, чужой — гибель.' },
  };
  const MAZE_NAMES = { 2: 'Джунгли', 3: 'Пустыня', 4: 'Болото', 5: 'Горы' };

  const inGrid = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const isLand = (r, c) => r >= 1 && r <= 11 && c >= 1 && c <= 11 && !((r === 1 || r === 11) && (c === 1 || c === 11));
  const isWater = (r, c) => inGrid(r, c) && !isLand(r, c);
  const rotCW = ([dr, dc]) => [dc, -dr];

  function rnd(n, rng) { return Math.floor((rng || Math.random)() * n); }
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1, rng); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function buildDeck(rng) {
    const d = [], add = (n, f) => { for (let i = 0; i < n; i++) d.push(f()); };
    add(40, () => ({ type: 'empty', v: rnd(4, rng) }));
    const kinds = [[U], [UR], [L, R], [UR, DL], [UL, UR, D], [U, R, D, L], [UL, UR, DL, DR]];
    kinds.forEach(k => add(3, () => {
      let dirs = k.map(x => x.slice());
      const rot = rnd(4, rng);
      for (let i = 0; i < rot; i++) dirs = dirs.map(rotCW);
      return { type: 'arrow', dirs };
    }));
    add(2, () => ({ type: 'horse' }));
    add(4, () => ({ type: 'rum' }));
    [[2, 5], [3, 4], [4, 2], [5, 1]].forEach(([n, k]) => add(k, () => ({ type: 'maze', n })));
    add(6, () => ({ type: 'ice' }));
    add(3, () => ({ type: 'trap' }));
    add(4, () => ({ type: 'croc' }));
    add(1, () => ({ type: 'cannibal' }));
    add(2, () => ({ type: 'fort' }));
    add(1, () => ({ type: 'revive' }));
    [[1, 5], [2, 5], [3, 3], [4, 2], [5, 1]].forEach(([n, k]) => add(k, () => ({ type: 'chest', n })));
    add(2, () => ({ type: 'balloon' }));
    add(1, () => ({ type: 'plane', used: false }));
    add(2, () => ({ type: 'cannon', dir: [U, R, D, L][rnd(4, rng)] }));
    return d;
  }

  function newGame(modeKey, names, rng) {
    const M = MODES[modeKey];
    if (!M) throw new Error('bad mode');
    const deck = shuffle(buildDeck(rng), rng);
    const cells = Array.from({ length: N }, () => Array(N).fill(null));
    let k = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (isLand(r, c)) {
      const t = deck[k++]; t.rev = false; t.coins = t.type === 'chest' ? t.n : 0; cells[r][c] = t;
    }
    const teams = M.teams.map(([pos, pl]) => ({
      pos, player: pl, side: M.alliance ? pl % 2 : pl,
      ship: { r: SIDES[pos].r, c: SIDES[pos].c }, score: 0,
    }));
    const pirates = [];
    teams.forEach((t, ti) => { for (let i = 0; i < 3; i++) pirates.push({
      id: pirates.length, team: ti, r: t.ship.r, c: t.ship.c, loc: 'ship', shipT: ti, trapped: false, step: 0, drunk: -1, coin: false }); });
    const S = {
      v: 1, mode: modeKey, names: (names || []).slice(0, M.players), teams, cells, pirates,
      turn: 0, turnNo: 0, pending: null, lost: 0, total: 37, over: false, log: [], seq: 0, last: null,
    };
    for (let i = 0; i < M.players; i++) if (!S.names[i]) S.names[i] = 'Игрок ' + (i + 1);
    log(S, 'Начало игры! Первыми ходят ' + teamName(S, 0) + '.');
    return S;
  }

  // ---------- helpers ----------
  function log(S, m) { S.log.unshift(m); if (S.log.length > 40) S.log.length = 40; }
  function teamName(S, ti) { return TEAM_INFO[S.teams[ti].pos].name; }
  function friendly(S, a, b) { return S.teams[a].side === S.teams[b].side; }
  function shipAt(S, r, c) { return S.teams.findIndex(t => t.ship.r === r && t.ship.c === c); }
  function cell(S, r, c) { return isLand(r, c) ? S.cells[r][c] : null; }
  function coinsLeft(S) { let n = 0; for (const row of S.cells) for (const t of row) if (t) n += t.coins; return n; }
  function alive(p) { return p.loc !== 'dead'; }
  function drunkBlocked(S, p) { return p.drunk >= 0 && S.turnNo <= p.drunk + S.teams.length; }
  function canMove(S, p) { return alive(p) && !p.trapped && !drunkBlocked(S, p); }
  function enemiesOn(S, p, r, c, step) {
    return S.pirates.filter(q => q.loc === 'land' && q.r === r && q.c === c && !friendly(S, q.team, p.team) &&
      (step == null || q.step === step));
  }
  function isFortLike(t) { return t.type === 'fort' || t.type === 'revive'; }
  function landStep(t) { return t.type === 'maze' ? 1 : null; }

  function canEnter(S, p, r, c) {
    const carry = !!p.coin, t = S.cells[r][c];
    if (t.rev && isFortLike(t)) {
      if (carry) return false;
      return enemiesOn(S, p, r, c, null).length === 0;
    }
    if (carry) {
      if (!t.rev) return false;
      if (enemiesOn(S, p, r, c, landStep(t)).length) return false;
    }
    return true;
  }

  function hasCoin(p) { return !!p.coin; }

  // Список клеток, куда может пойти пират (обычный ход)
  function dests(S, p) {
    if (S.over || S.pending || p.team !== S.turn || !canMove(S, p)) return [];
    const carry = !!p.coin;
    const out = [];
    if (p.loc === 'ship') {
      const st = S.teams[p.shipT], sd = SIDES[st.pos];
      const r = st.ship.r + sd.fwd[0], c = st.ship.c + sd.fwd[1];
      if (isLand(r, c) && canEnter(S, p, r, c)) out.push({ r, c });
      return out;
    }
    if (p.loc === 'water') {
      for (const [dr, dc] of DIRS) {
        const r = p.r + dr, c = p.c + dc;
        if (!isWater(r, c)) continue;
        const st = shipAt(S, r, c);
        if (st >= 0) { if (friendly(S, st, p.team)) out.push({ r, c }); continue; }
        out.push({ r, c });
      }
      return out;
    }
    const t = S.cells[p.r][p.c];
    if (t.type === 'maze' && p.step < t.n) {
      if (!(carry && enemiesOn(S, p, p.r, p.c, p.step + 1).length)) out.push({ r: p.r, c: p.c, maze: true });
      return out;
    }
    for (const [dr, dc] of DIRS) {
      const r = p.r + dr, c = p.c + dc;
      if (isLand(r, c)) { if (canEnter(S, p, r, c)) out.push({ r, c }); }
      else { const st = shipAt(S, r, c); if (st >= 0 && friendly(S, st, p.team)) out.push({ r, c }); }
    }
    if (t.type === 'plane' && !t.used) {
      const near = new Set(out.map(o => o.r + ',' + o.c));
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if ((r === p.r && c === p.c) || near.has(r + ',' + c)) continue;
        if (isLand(r, c)) { if (canEnter(S, p, r, c)) out.push({ r, c, fly: true }); }
        else { const st = shipAt(S, r, c); if (st >= 0 && friendly(S, st, p.team)) out.push({ r, c, fly: true }); }
      }
    }
    return out;
  }

  function shipMoves(S, ti) {
    if (S.over || S.pending || ti !== S.turn) return [];
    const T = S.teams[ti];
    if (!S.pirates.some(p => p.team === ti && p.loc === 'ship' && p.shipT === ti)) return [];
    const ax = SIDES[T.pos].axis, out = [];
    for (const d of [-1, 1]) {
      const r = T.ship.r + (ax === 'r' ? d : 0), c = T.ship.c + (ax === 'c' ? d : 0);
      const v = ax === 'r' ? r : c;
      if (v >= 2 && v <= 10) out.push({ r, c });
    }
    return out;
  }

  function canRevive(S, p) {
    if (S.over || S.pending || p.team !== S.turn || !canMove(S, p) || p.loc !== 'land') return false;
    const t = S.cells[p.r][p.c];
    return t.type === 'revive' && S.pirates.some(q => q.team === p.team && !alive(q));
  }

  function hasAction(S, ti) {
    const save = S.turn; S.turn = ti;
    const ok = S.pirates.some(p => p.team === ti && (dests(S, p).length || canRevive(S, p))) || shipMoves(S, ti).length > 0;
    S.turn = save;
    return ok;
  }

  // ---------- действия ----------
  // a: {k:'move',pid,r,c} | {k:'choose',r,c} | {k:'ship',r,c} | {k:'revive',pid}
  // seat: номер игрока, от которого пришло действие (null = локальная игра, без проверки)
  function act(S, seat, a) {
    if (!a || typeof a !== 'object') return 'Неверное действие';
    if (S.over) return 'Игра окончена';
    if (seat != null && S.teams[S.turn].player !== seat) return 'Сейчас не ваш ход';
    if (S.pending) {
      if (a.k !== 'choose') return 'Сначала закончите ход';
      const o = S.pending.opts.find(x => x.r === a.r && x.c === a.c);
      if (!o) return 'Туда нельзя';
      const ctx = S.pending.ctx, p = S.pirates[ctx.pid];
      const isPlane = S.pending.plane;
      S.pending = null;
      S.seq++;
      if (o.stay) { endMove(S, ctx, 'stay'); return null; }
      if (isPlane) { const t = S.cells[p.r][p.c]; t.used = true; log(S, '✈ Самолёт улетел — больше не работает'); }
      land(S, ctx, o.r, o.c, o.vec || [o.r - p.r, o.c - p.c]);
      return null;
    }
    if (a.k === 'move') {
      const p = S.pirates[a.pid];
      if (!p || p.team !== S.turn) return 'Это не ваш пират';
      const d = dests(S, p).find(x => x.r === a.r && x.c === a.c);
      if (!d) return 'Туда нельзя';
      S.seq++;
      startMove(S, p, d);
      return null;
    }
    if (a.k === 'ship') {
      const m = shipMoves(S, S.turn).find(x => x.r === a.r && x.c === a.c);
      if (!m) return 'Корабль туда не плывёт';
      S.seq++;
      moveShip(S, S.turn, m.r, m.c);
      return null;
    }
    if (a.k === 'revive') {
      const p = S.pirates[a.pid];
      if (!p || !canRevive(S, p)) return 'Нельзя воскресить';
      const dead = S.pirates.find(q => q.team === p.team && !alive(q));
      Object.assign(dead, { loc: 'land', r: p.r, c: p.c, trapped: false, step: 0, drunk: -1 });
      log(S, '🏯 Аборигенка воскресила пирата (' + teamName(S, p.team) + ')');
      S.seq++;
      S.last = { pid: dead.id, path: [[p.r, p.c]] };
      nextTurn(S);
      return null;
    }
    return 'Неизвестное действие';
  }

  function startMove(S, p, d) {
    const ctx = { pid: p.id, start: { r: p.r, c: p.c, loc: p.loc, shipT: p.shipT, step: p.step }, depth: 0, seen: {} };
    S.last = { pid: p.id, path: [[p.r, p.c]] };
    if (d.maze) {
      p.step++;
      S.last.path.push([p.r, p.c]);
      enemiesOn(S, p, p.r, p.c, p.step).forEach(q => sendHome(S, q));
      endMove(S, ctx, 'stay');
      return;
    }
    if (p.loc === 'land') {
      const t = S.cells[p.r][p.c];
      if (t.type === 'plane' && !t.used && d.fly) { t.used = true; log(S, '✈ Самолёт улетел — больше не работает'); }
    }
    land(S, ctx, d.r, d.c, [d.r - p.r, d.c - p.c]);
  }

  function clamp(v) { return Math.max(0, Math.min(N - 1, v)); }

  function land(S, ctx, r, c, vec) {
    const p = S.pirates[ctx.pid];
    if (++ctx.depth > 60) return die(S, ctx, 'заплутал и пропал');
    r = clamp(r); c = clamp(c);
    S.last.path.push([r, c]);
    const prevPos = { r: p.r, c: p.c, loc: p.loc, shipT: p.shipT, step: p.step };
    if (!isLand(r, c)) {
      const st = shipAt(S, r, c);
      if (st >= 0) {
        if (friendly(S, st, p.team)) return board(S, ctx, st);
        return die(S, ctx, 'погиб у вражеского корабля');
      }
      p.loc = 'water'; p.r = r; p.c = c; p.step = 0; p.trapped = false;
      if (p.coin) { p.coin = false; S.lost++; log(S, '🌊 Монета утонула вместе с пиратом'); }
      S.pirates.filter(q => q !== p && q.loc === 'water' && q.r === r && q.c === c && !friendly(S, q.team, p.team))
        .forEach(q => { q.loc = 'dead'; log(S, '🌊 Пирата (' + teamName(S, q.team) + ') побили в воде'); });
      log(S, '🌊 Пират (' + teamName(S, p.team) + ') плывёт');
      return endMove(S, ctx, 'water');
    }
    const t = S.cells[r][c];
    const key = r + ',' + c + ',' + vec[0] + ',' + vec[1];
    if (ctx.seen[key]) return die(S, ctx, 'попал в замкнутый круг и пропал');
    ctx.seen[key] = 1;
    if (!t.rev) { t.rev = true; log(S, teamName(S, p.team) + ' открыли: ' + tileName(t)); }
    p.loc = 'land'; p.r = r; p.c = c; p.step = t.type === 'maze' ? 1 : 0; p.trapped = false;
    if (isFortLike(t)) {
      if (p.coin) return die(S, ctx, 'не смог войти в крепость с монетой');
      if (enemiesOn(S, p, r, c, null).length) return die(S, ctx, 'не пустили в крепость');
    } else {
      enemiesOn(S, p, r, c, landStep(t)).forEach(q => sendHome(S, q));
    }
    switch (t.type) {
      case 'arrow':
        return branch(S, ctx, t.dirs.map(dd => ({ r: r + dd[0], c: c + dd[1], vec: dd })), false);
      case 'horse':
        return branch(S, ctx, KN.filter(([a, b]) => inGrid(r + a, c + b)).map(([a, b]) => ({ r: r + a, c: c + b, vec: [a, b] })), false);
      case 'ice':
        return land(S, ctx, r + vec[0], c + vec[1], vec);
      case 'croc': {
        log(S, '🐊 Крокодил прогнал пирата назад');
        const s = ctx.start;
        if (prevPos.r === s.r && prevPos.c === s.c) {
          Object.assign(p, { r: s.r, c: s.c, loc: s.loc, shipT: s.shipT, step: s.step });
          if (s.loc === 'ship') { const sh = S.teams[s.shipT].ship; p.r = sh.r; p.c = sh.c; }
          return endMove(S, ctx, s.loc === 'ship' ? 'back-ship' : 'stay');
        }
        return land(S, ctx, prevPos.r, prevPos.c, [-vec[0], -vec[1]]);
      }
      case 'cannibal':
        return die(S, ctx, 'съеден людоедом');
      case 'trap': {
        const mates = S.pirates.filter(q => q !== p && q.loc === 'land' && q.r === r && q.c === c && q.trapped && friendly(S, q.team, p.team));
        if (mates.length) { mates.forEach(q => q.trapped = false); log(S, '⛓ Пирата вызволили из капкана'); }
        else { p.trapped = true; log(S, '⛓ Пират (' + teamName(S, p.team) + ') попал в капкан'); }
        return endMove(S, ctx, 'stay');
      }
      case 'rum':
        p.drunk = S.turnNo; log(S, '🍺 Пират (' + teamName(S, p.team) + ') напился и пропустит ход');
        return endMove(S, ctx, 'stay');
      case 'balloon':
        log(S, '🎈 Шар унёс пирата на корабль');
        return board(S, ctx, p.team);
      case 'plane': {
        if (t.used) return endMove(S, ctx, 'stay');
        const opts = [{ r, c, stay: true }];
        for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) {
          if (rr === r && cc === c) continue;
          if (isLand(rr, cc)) { if (canEnter(S, p, rr, cc)) opts.push({ r: rr, c: cc }); }
          else { const st = shipAt(S, rr, cc); if (st >= 0 && friendly(S, st, p.team)) opts.push({ r: rr, c: cc }); }
        }
        S.pending = { ctx, opts, plane: true };
        return;
      }
      case 'cannon': {
        let rr = r, cc = c;
        do { rr += t.dir[0]; cc += t.dir[1]; } while (isLand(rr, cc));
        log(S, '💥 Пушка выстрелила пиратом');
        return land(S, ctx, rr, cc, t.dir);
      }
      default:
        return endMove(S, ctx, 'stay');
    }
  }

  function branch(S, ctx, opts) {
    opts = opts.filter(o => inGrid(o.r, o.c));
    if (!opts.length) return endMove(S, ctx, 'stay');
    if (opts.length === 1) return land(S, ctx, opts[0].r, opts[0].c, opts[0].vec);
    S.pending = { ctx, opts, plane: false };
  }

  function board(S, ctx, st) {
    const p = S.pirates[ctx.pid], sh = S.teams[st].ship;
    if (p.coin) { p.coin = false; S.teams[p.team].score++; log(S, '🪙 ' + teamName(S, p.team) + ' доставили монету!'); }
    Object.assign(p, { loc: 'ship', shipT: st, r: sh.r, c: sh.c, step: 0, trapped: false });
    return endMove(S, ctx, 'ship');
  }

  function die(S, ctx, why) {
    const p = S.pirates[ctx.pid];
    if (p.coin) { S.cells[ctx.start.r][ctx.start.c].coins++; p.coin = false; log(S, '🪙 Монета осталась на клетке, где пират начинал ход'); }
    p.loc = 'dead'; p.trapped = false; p.step = 0;
    log(S, '☠ Пират (' + teamName(S, p.team) + ') ' + why);
    return endMove(S, ctx, 'dead');
  }

  function sendHome(S, q) {
    if (q.coin) { S.cells[q.r][q.c].coins++; q.coin = false; log(S, '🪙 Монета осталась на клетке боя'); }
    const sh = S.teams[q.team].ship;
    Object.assign(q, { loc: 'ship', shipT: q.team, r: sh.r, c: sh.c, step: 0, trapped: false, drunk: -1 });
    log(S, '⚔ Пирата (' + teamName(S, q.team) + ') побили — он на корабле');
  }

  function endMove(S, ctx, res) {
    if (res === 'stay') pickup(S, S.pirates[ctx.pid]);
    nextTurn(S);
  }

  // Пират, остановившийся на клетке с монетами, берёт одну (если руки свободны; в крепости монет не бывает)
  function pickup(S, p) {
    if (!p || p.loc !== 'land' || p.coin) return;
    const t = S.cells[p.r][p.c];
    if (t.coins > 0 && !isFortLike(t)) { t.coins--; p.coin = true; log(S, '🪙 ' + teamName(S, p.team) + ' подобрали монету'); }
  }

  function moveShip(S, ti, r, c) {
    const T = S.teams[ti];
    T.ship = { r, c };
    S.last = { ship: ti };
    S.pirates.filter(p => p.loc === 'ship' && p.shipT === ti).forEach(p => { p.r = r; p.c = c; });
    S.pirates.filter(p => p.loc === 'water' && p.r === r && p.c === c).forEach(p => {
      if (friendly(S, p.team, ti)) { p.loc = 'ship'; p.shipT = ti; log(S, '⛵ Корабль подобрал пловца'); }
      else { p.loc = 'dead'; log(S, '⛵ Корабль раздавил пирата (' + teamName(S, p.team) + ')'); }
    });
    nextTurn(S);
  }

  function nextTurn(S) {
    S.pending = null;
    if (coinsLeft(S) === 0 && !S.pirates.some(p => p.coin)) { finish(S); return; }
    for (let i = 0; i < S.teams.length; i++) {
      S.turn = (S.turn + 1) % S.teams.length;
      S.turnNo++;
      if (hasAction(S, S.turn)) return;
      log(S, teamName(S, S.turn) + ' не могут ходить — пропуск');
    }
    finish(S);
  }

  function results(S) {
    const M = MODES[S.mode];
    const byPlayer = S.names.map((n, i) => ({ name: n, score: S.teams.filter(t => t.player === i).reduce((a, t) => a + t.score, 0) }));
    let groups;
    if (M.alliance) groups = [0, 1].map(s => ({ name: S.names.filter((_, i) => i % 2 === s).join(' + '), score: byPlayer.filter((_, i) => i % 2 === s).reduce((a, x) => a + x.score, 0) }));
    else groups = byPlayer;
    const best = Math.max(...groups.map(g => g.score));
    const winners = groups.filter(g => g.score === best);
    return { groups, winners, best };
  }

  function finish(S) {
    S.over = true; S.pending = null;
    const r = results(S);
    log(S, r.winners.length > 1 ? '🏆 Ничья!' : '🏆 Победа: ' + r.winners[0].name + ' (' + r.best + ')');
  }

  function forceEnd(S) { if (!S.over) finish(S); }

  function tileName(t) {
    if (t.type === 'maze') return MAZE_NAMES[t.n] + ' (' + t.n + ' хода)';
    if (t.type === 'chest') return 'Сундук: ' + t.n + ' мон.';
    return TILE[t.type].name;
  }

  const api = { N, SIDES, TEAM_INFO, MODES, TILE, MAZE_NAMES, isLand, isWater, inGrid, newGame, dests, shipMoves, canRevive,
    canMove, drunkBlocked, hasCoin, act, coinsLeft, shipAt, friendly, teamName, tileName, results, forceEnd, hasAction, buildDeck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
