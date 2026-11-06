/* Small World — игровой движок (без DOM). Работает и в браузере, и в node для тестов. */
(function (root) {
"use strict";

// ---------- справочники ----------
const RACES = {
  amazons:   { name:'Амазонки',    n:6, cap:15, ico:'🏹', d:'+4 фишки на время захватов, перед перегруппировкой их убирают.' },
  dwarves:   { name:'Гномы',       n:3, cap:8,  ico:'⛏️', d:'+1 монета за каждую свою область с шахтой — даже в упадке.' },
  elves:     { name:'Эльфы',       n:6, cap:11, ico:'🧝', d:'Когда их область захватывают, не теряют ни одной фишки.' },
  ghouls:    { name:'Упыри',       n:5, cap:10, ico:'🧟', d:'В упадке сохраняют все фишки и продолжают захватывать каждый ход.' },
  giants:    { name:'Великаны',    n:6, cap:11, ico:'🗿', d:'−1 фишка на захват области, соседней с их горой.' },
  halflings: { name:'Полурослики', n:6, cap:11, ico:'🍀', d:'Первый захват — где угодно. В первых двух областях роют норы: их нельзя захватить.' },
  humans:    { name:'Люди',        n:5, cap:10, ico:'🛡️', d:'+1 монета за каждую свою пашню.' },
  orcs:      { name:'Орки',        n:5, cap:10, ico:'👹', d:'+1 монета за каждую непустую область, захваченную в этот ход.' },
  ratmen:    { name:'Крысолюды',   n:8, cap:13, ico:'🐀', d:'Особенности нет — зато их очень много.' },
  skeletons: { name:'Скелеты',     n:6, cap:20, ico:'💀', d:'Перед перегруппировкой +1 фишка за каждые 2 захваченные непустые области.' },
  sorcerers: { name:'Колдуны',     n:5, cap:18, ico:'🔮', d:'Раз в ход против каждого соперника превращают его одиночную фишку по соседству в свою.' },
  tritons:   { name:'Тритоны',     n:6, cap:11, ico:'🔱', d:'−1 фишка на захват прибрежных областей.' },
  trolls:    { name:'Тролли',      n:5, cap:10, ico:'🧌', d:'В каждой их области логово: +1 к защите. Логова остаются и в упадке.' },
  wizards:   { name:'Маги',        n:5, cap:10, ico:'🧙', d:'+1 монета за каждую свою область с источником магии.' },
};
const POWERS = {
  alchemist:  { name:'Алхимики',      n:4, d:'+2 монеты в конце каждого хода, пока раса активна.' },
  berserk:    { name:'Берсерки',      n:4, d:'Перед каждым захватом бросают кубик подкрепления.' },
  bivouacking:{ name:'Лагерные',      n:5, d:'5 лагерей: каждый +1 к защите области. Переставляются при перегруппировке.' },
  commando:   { name:'Диверсанты',    n:4, d:'−1 фишка на любой захват.' },
  diplomat:   { name:'Дипломаты',     n:5, d:'В конце хода выбирают соперника, которого не атаковали: он не сможет напасть на них в свой следующий ход.' },
  dragon:     { name:'Драконоборцы',  n:5, d:'Раз в ход дракон захватывает область одной фишкой. Область с драконом неуязвима.' },
  flying:     { name:'Летающие',      n:5, d:'Захватывают любую область карты, не только соседнюю.' },
  forest:     { name:'Лесные',        n:4, d:'+1 монета за каждый свой лес.' },
  fortified:  { name:'Крепостные',    n:3, d:'Раз в ход строят крепость (до 6): +1 к защите и +1 монета, пока раса активна.' },
  heroic:     { name:'Героические',   n:5, d:'В конце хода ставят 2 героев: эти области неуязвимы.' },
  hill:       { name:'Холмовые',      n:4, d:'+1 монета за каждый свой холм.' },
  merchant:   { name:'Торговые',      n:2, d:'+1 монета за каждую свою область.' },
  mounted:    { name:'Конные',        n:5, d:'−1 фишка на захват холмов и пашен.' },
  pillaging:  { name:'Мародёры',      n:5, d:'+1 монета за каждую непустую область, захваченную в этот ход.' },
  seafaring:  { name:'Мореходы',      n:5, d:'Могут захватывать моря и озеро — и получать за них монеты.' },
  spirit:     { name:'Духи',          n:5, d:'Уйдя в упадок, остаются на карте до конца игры и не мешают следующей расе в упадке.' },
  stout:      { name:'Стойкие',       n:4, d:'Могут уйти в упадок в конце обычного хода, после захватов.' },
  swamp:      { name:'Болотные',      n:4, d:'+1 монета за каждое своё болото.' },
  underworld: { name:'Подземные',     n:5, d:'Все пещеры соседствуют друг с другом; −1 фишка на захват пещер.' },
  wealthy:    { name:'Богатые',       n:4, d:'+7 монет один раз, в конце первого хода.' },
};
const TERR = {
  farm:  { name:'Пашня' }, forest:{ name:'Лес' }, hill:{ name:'Холмы' },
  mount: { name:'Горы' },  swamp: { name:'Болото' }, sea:{ name:'Море' }, lake:{ name:'Озеро' },
};
const COLORS = [
  { name:'Красный', c:'#d64541' }, { name:'Синий', c:'#3f7fe0' }, { name:'Жёлтый', c:'#e7b416' },
  { name:'Зелёный', c:'#3fa34d' }, { name:'Фиолетовый', c:'#9b59d0' },
];
const SIZES = { 2:{ regions:23, turns:10 }, 3:{ regions:30, turns:10 }, 4:{ regions:39, turns:9 }, 5:{ regions:48, turns:8 } };
const DIE = [0,0,0,1,2,3];
const MAP_W = 1.5, MAP_H = 1;

// ---------- шум и случайность ----------
function mulberry(seed){ let a = seed>>>0; return ()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function hash2(ix, iy, s){ let h=(Math.imul(ix,374761393)+Math.imul(iy,668265263)+Math.imul(s,982451653))|0; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; }
function vnoise(x, y, s){
  const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
  const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const a=hash2(ix,iy,s), b=hash2(ix+1,iy,s), c=hash2(ix,iy+1,s), d=hash2(ix+1,iy+1,s);
  return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;
}
function fbm(x, y, s, oct){ let v=0, amp=0.5, f=1, norm=0; for (let i=0;i<oct;i++){ v+=amp*vnoise(x*f,y*f,s+i*131); norm+=amp; amp*=0.5; f*=2.03; } return v/norm; }

// Область в точке (x,y) карты: ближайший центр после лёгкого искривления — границы выглядят естественно
function regionAt(M, x, y){
  const s = M.seed & 0xffff;
  const wx = x + M.A*(fbm(x*5, y*5, s+7, 3)-0.5)*2;
  const wy = y + M.A*(fbm(x*5+31, y*5+17, s+29, 3)-0.5)*2;
  let best=0, bd=1e9; const P=M.pts;
  for (let i=0;i<P.length;i++){ const dx=P[i][0]-wx, dy=P[i][1]-wy, d=dx*dx+dy*dy; if (d<bd){ bd=d; best=i; } }
  return best;
}

// ---------- генерация карты ----------
function buildMap(seed, np){
  const n = SIZES[np].regions, r = mulberry(seed);
  // точки: «лучший кандидат» для равномерности
  const pts=[];
  for (let i=0;i<n;i++){
    let best=null, bd=-1;
    for (let k=0;k<14;k++){
      const c=[0.04+r()*(MAP_W-0.08), 0.04+r()*(MAP_H-0.08)];
      let md=1e9; for (const p of pts){ const dx=p[0]-c[0], dy=p[1]-c[1]; md=Math.min(md,dx*dx+dy*dy); }
      if (md>bd){ bd=md; best=c; }
    }
    pts.push(best);
  }
  // релаксация Ллойда
  for (let it=0; it<3; it++){
    const sx=new Float64Array(n), sy=new Float64Array(n), cnt=new Float64Array(n);
    for (let gy=0; gy<100; gy++) for (let gx=0; gx<150; gx++){
      const x=(gx+0.5)/100, y=(gy+0.5)/100; let b=0, bd=1e9;
      for (let i=0;i<n;i++){ const dx=pts[i][0]-x, dy=pts[i][1]-y, d=dx*dx+dy*dy; if (d<bd){ bd=d; b=i; } }
      sx[b]+=x; sy[b]+=y; cnt[b]++;
    }
    for (let i=0;i<n;i++) if (cnt[i]) pts[i]=[sx[i]/cnt[i], sy[i]/cnt[i]];
  }
  const M = { seed, n, pts: pts.map(p=>[+p[0].toFixed(5), +p[1].toFixed(5)]), A: +(0.2*Math.sqrt(MAP_W*MAP_H/n)).toFixed(5) };

  // растр для соседства, краёв и точки для фишек
  const GW=330, GH=220, id=new Int16Array(GW*GH);
  for (let gy=0; gy<GH; gy++) for (let gx=0; gx<GW; gx++) id[gy*GW+gx]=regionAt(M,(gx+0.5)/GW*MAP_W,(gy+0.5)/GH*MAP_H);
  const R = Array.from({length:n}, ()=>({ terr:'farm', adj:[], edge:false, area:0 }));
  const shared = new Map();
  for (let gy=0; gy<GH; gy++) for (let gx=0; gx<GW; gx++){
    const a=id[gy*GW+gx]; R[a].area++;
    if (gx===0||gy===0||gx===GW-1||gy===GH-1) R[a].edge=true;
    if (gx+1<GW){ const b=id[gy*GW+gx+1]; if (b!==a){ const k=a<b?a*256+b:b*256+a; shared.set(k,(shared.get(k)||0)+1); } }
    if (gy+1<GH){ const b=id[(gy+1)*GW+gx]; if (b!==a){ const k=a<b?a*256+b:b*256+a; shared.set(k,(shared.get(k)||0)+1); } }
  }
  for (const [k,c] of shared) if (c>=4){ const a=k>>8, b=k&255; R[a].adj.push(b); R[b].adj.push(a); }
  for (const x of R) x.adj.sort((a,b)=>a-b);
  // точка внутри области, дальше всего от границ (там стоят фишки)
  const dist=new Float32Array(GW*GH);
  for (let gy=0; gy<GH; gy++) for (let gx=0; gx<GW; gx++){
    const i=gy*GW+gx, a=id[i];
    const bord = gx===0||gy===0||gx===GW-1||gy===GH-1 || id[i-1]!==a || id[i+1]!==a || id[i-GW]!==a || id[i+GW]!==a;
    dist[i] = bord ? 0 : 1e9;
  }
  for (let pass=0; pass<2; pass++){
    const fwd = pass===0;
    for (let k=0;k<GW*GH;k++){
      const i = fwd ? k : GW*GH-1-k; if (dist[i]===0) continue;
      const gx=i%GW, gy=(i/GW)|0, a=id[i];
      const nb = fwd ? [[-1,0,1],[0,-1,1],[-1,-1,1.414],[1,-1,1.414]] : [[1,0,1],[0,1,1],[1,1,1.414],[-1,1,1.414]];
      for (const [dx,dy,w] of nb){ const x=gx+dx, y=gy+dy; if (x<0||y<0||x>=GW||y>=GH) continue; const j=y*GW+x; if (id[j]!==a) continue; dist[i]=Math.min(dist[i], dist[j]+w); }
    }
  }
  const bestD=new Float32Array(n).fill(-1);
  for (let i=0;i<GW*GH;i++){ const a=id[i]; if (dist[i]>bestD[a]){ bestD[a]=dist[i]; R[a].ax=+((i%GW+0.5)/GW*MAP_W).toFixed(4); R[a].ay=+((((i/GW)|0)+0.5)/GH*MAP_H).toFixed(4); R[a].rad=+(dist[i]/GH).toFixed(4); } }

  // моря у края и озеро
  const edges = R.map((x,i)=>i).filter(i=>R[i].edge);
  const nSea = n<=30 ? 2 : 3, seas=[];
  const cand = edges.slice();
  seas.push(cand[Math.floor(r()*cand.length)]);
  while (seas.length<nSea){
    let best=-1, bd=-1;
    for (const c of cand){ if (seas.includes(c)) continue; if (seas.some(s=>R[s].adj.includes(c))) continue;
      let md=1e9; for (const s of seas){ const dx=R[s].ax-R[c].ax, dy=R[s].ay-R[c].ay; md=Math.min(md,dx*dx+dy*dy); }
      md*=0.7+0.6*r(); if (md>bd){ bd=md; best=c; } }
    if (best<0) break; seas.push(best);
  }
  for (const s of seas) R[s].terr='sea';
  if (n>=30){
    const inner = R.map((x,i)=>i).filter(i=>!R[i].edge && R[i].adj.every(j=>R[j].terr!=='sea'));
    inner.sort((a,b)=>{ const da=(R[a].ax-0.75)**2+(R[a].ay-0.5)**2, db=(R[b].ax-0.75)**2+(R[b].ay-0.5)**2; return da-db; });
    const pick = inner[Math.floor(r()*Math.min(4,inner.length))];
    if (pick!=null) R[pick].terr='lake';
  }
  // типы местности: поровну и по возможности без одинаковых соседей
  const land = R.map((x,i)=>i).filter(i=>R[i].terr!=='sea'&&R[i].terr!=='lake');
  const kinds=['farm','forest','hill','mount','swamp'];
  const tl = land.map((_,k)=>kinds[k%5]);
  for (let i=tl.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [tl[i],tl[j]]=[tl[j],tl[i]]; }
  land.forEach((ri,k)=>R[ri].terr=tl[k]);
  const clash = i => R[i].adj.reduce((s,j)=>s+(R[j].terr===R[i].terr?1:0),0);
  for (let it=0; it<4000; it++){
    const a=land[Math.floor(r()*land.length)], b=land[Math.floor(r()*land.length)];
    if (R[a].terr===R[b].terr) continue;
    const before=clash(a)+clash(b); [R[a].terr,R[b].terr]=[R[b].terr,R[a].terr];
    if (clash(a)+clash(b)>before) [R[a].terr,R[b].terr]=[R[b].terr,R[a].terr];
  }
  // особые места
  const k = Math.max(2, Math.round(land.length/6));
  const takeSome = (count, pref, flag)=>{
    const pool = land.filter(i=>!R[i].magic&&!R[i].mine&&!R[i].cave)
      .map(i=>({ i, w:(pref.includes(R[i].terr)?3:1)*r() })).sort((a,b)=>b.w-a.w);
    pool.slice(0,count).forEach(o=>R[o.i][flag]=true);
  };
  takeSome(k, ['mount','hill'], 'mine');
  takeSome(k, ['mount','hill','forest'], 'cave');
  takeSome(k, ['swamp','forest','farm'], 'magic');
  // свойства для правил
  for (let i=0;i<n;i++){
    const x=R[i]; x.water = x.terr==='sea'||x.terr==='lake';
    x.coastal = !x.water && x.adj.some(j=>R[j].water);
  }
  for (let i=0;i<n;i++){ const x=R[i];
    x.border = x.edge || (!x.water && x.adj.some(j=>R[j].terr==='sea'&&R[j].edge)); }
  // затерянные племена
  const tribesPool = land.filter(i=>R[i].terr!=='mount').map(i=>({i,w:r()})).sort((a,b)=>a.w-b.w);
  const tribes = tribesPool.slice(0, Math.round(land.length*0.33)).map(o=>o.i);
  for (const x of R) delete x.area;
  return { M, R, tribes };
}

// ---------- партия ----------
function newGame(names, seed){
  const np = names.length;
  if (!SIZES[np]) throw new Error('2–5 игроков');
  seed = (seed==null ? Math.floor(Math.random()*2**31) : seed) >>> 0;
  const { M, R, tribes } = buildMap(seed, np);
  const S = {
    v:1, seed, np, maxT:SIZES[np].turns, round:1, cur:0, phase:'pick', defQ:[], defP:null,
    M, R, O:R.map(()=>null),
    P: names.map((nm,i)=>({ name:String(nm).slice(0,16), coins:5, races:[], peaceVs:null, color:COLORS[i].c })),
    raceDeck:[], powDeck:[], shown:[], rs:(seed^0x5bd1e995)>>>0, log:[], seq:0, T:null, lastDie:null, lastScore:null, over:false, winners:null,
  };
  for (const t of tribes) S.O[t] = { p:-1, race:'lost', n:1 };
  S.raceDeck = shuffle(S, Object.keys(RACES));
  S.powDeck = shuffle(S, Object.keys(POWERS));
  refill(S);
  startTurn(S);
  log(S, `Начало партии: ${np} игрока, ${S.maxT} ходов. Первым ходит ${S.P[0].name}.`);
  return S;
}
function rnd(S){ const f=mulberry(S.rs); const v=f(); S.rs=(S.rs+0x6D2B79F5)>>>0; return v; }
function shuffle(S, arr){ const a=arr.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(rnd(S)*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function refill(S){ while (S.shown.length<6 && S.raceDeck.length && S.powDeck.length) S.shown.push({ race:S.raceDeck.shift(), power:S.powDeck.shift(), coins:0 }); }
function log(S, t){ S.log.push(t); if (S.log.length>60) S.log.splice(0, S.log.length-60); }
function comboName(ri){ return POWERS[ri.power].name+' '+RACES[ri.race].name.toLowerCase(); }

function active(S, p){ return S.P[p].races.find(x=>!x.decl) || null; }
function raceRI(S, p, race){ return S.P[p].races.find(x=>x.race===race) || null; }
function regionsOf(S, race){ const out=[]; S.O.forEach((o,i)=>{ if (o && o.race===race) out.push(i); }); return out; }
function onMap(S, race){ return S.O.reduce((s,o)=>s+(o&&o.race===race?o.n:0),0); }
function trayLeft(S, ri){ return RACES[ri.race].cap - onMap(S, ri.race) - ri.hand; }
function isArmy(ri){ return !ri.decl || ri.race==='ghouls'; }
function pw(ri, p){ return !ri.decl && ri.power===p; }   // способность действует только у активной расы
function rc(ri, r){ return !ri.decl && ri.race===r; }

function startTurn(S){
  const p=S.cur, pl=S.P[p];
  pl.peaceVs = null;
  S.T = { conq:[], attacked:{}, ready:{}, touched:false, picked:false, final:false, bers:null, sorc:{}, dragonUsed:false, fortAt:-1, amaz:0 };
  S.phase = active(S,p) ? 'conquer' : 'pick';
  S.lastDie = null;
}

// подготовка войск: в каждой области остаётся по 1 фишке, остальные — в руку
function ensureReady(S, ri){
  if (S.T.ready[ri.race]) return;
  S.T.ready[ri.race] = true;
  for (const i of regionsOf(S, ri.race)){ const o=S.O[i]; if (o.n>1){ ri.hand+=o.n-1; o.n=1; } }
  if (rc(ri,'amazons')){ const add=Math.min(4, trayLeft(S,ri)); ri.hand+=add; S.T.amaz=add; }
}

// можно ли напасть расой ri на область r (без учёта числа фишек в руке)
function target(S, p, ri, r, kind){
  const R=S.R[r], o=S.O[r];
  if (R.water && !pw(ri,'seafaring')) return { err:'Моря и озеро захватывают только Мореходы' };
  if (o && o.race===ri.race) return { err:'Это ваша область' };
  if (o && o.p===p && !S.P[p].races.find(x=>x.race===o.race)?.decl) return { err:'Это ваша область' };
  if (o && (o.hero || o.dragon || o.hole)) return { err: o.hero?'Здесь герой — область неуязвима': o.dragon?'Здесь дракон — область неуязвима':'Нора полуросликов неуязвима' };
  if (o && o.p>=0 && o.p!==p){
    const dri = raceRI(S,o.p,o.race);
    if (dri && !dri.decl && S.P[o.p].peaceVs===p && !ri.decl) return { err:`${S.P[o.p].name} заключил с вами мир на этот ход` };
  }
  const mine = regionsOf(S, ri.race);
  if (mine.length===0){
    if (!(pw(ri,'flying') || rc(ri,'halflings')) && !R.border) return { err:'Первый захват — только с края карты' };
  } else if (!pw(ri,'flying')){
    const near = mine.some(h=>S.R[h].adj.includes(r) || (pw(ri,'underworld') && S.R[h].cave && R.cave));
    if (!near) return { err:'Можно захватывать только соседние области' };
  }
  let cost = 2 + (o ? o.n : 0) + (R.terr==='mount'?1:0) + (o&&o.fort?1:0) + (o&&o.lair?1:0) + (o&&o.camp?o.camp:0);
  if (pw(ri,'commando')) cost--;
  if (pw(ri,'mounted') && (R.terr==='hill'||R.terr==='farm')) cost--;
  if (pw(ri,'underworld') && R.cave) cost--;
  if (rc(ri,'tritons') && (R.coastal)) cost--;
  if (rc(ri,'giants') && R.adj.some(j=>S.O[j] && S.O[j].race==='giants' && S.R[j].terr==='mount')) cost--;
  cost = Math.max(1, cost);
  return { cost };
}

// выбить защитника из области r
function evict(S, p, r){
  const o=S.O[r]; if (!o) return false;
  if (o.p<0){ log(S, `Затерянное племя изгнано (${TERR[S.R[r].terr].name.toLowerCase()})`); S.O[r]=null; return true; }
  const dri = raceRI(S, o.p, o.race);
  const loss = (dri.race==='elves' && !dri.decl) ? 0 : 1;
  const back = Math.max(0, o.n - loss);
  if (o.dragon) { dri.dragonAt=-1; }
  if (isArmy(dri)){
    dri.hand += back;
    if (back>0 && o.p!==p && !S.defQ.includes(o.p)) S.defQ.push(o.p);
  }
  if (!dri.decl && o.p!==p) S.T.attacked[o.p]=true;
  S.O[r]=null;
  return true;
}
function occupy(S, p, ri, r, n){
  const o = { p, race:ri.race, n };
  if (ri.race==='trolls') o.lair=1;
  if (rc(ri,'halflings') && (ri.holes||0)<2){ o.hole=true; ri.holes=(ri.holes||0)+1; }
  S.O[r]=o;
}
function armyFor(S, p, a){
  if (a && a.g){ const g=raceRI(S,p,'ghouls'); return g && g.decl ? g : null; }
  return active(S,p);
}

// ---------- подсчёт ----------
function score(S, p){
  const pl=S.P[p], parts=[]; let total=0;
  const add=(label,v)=>{ if (v>0){ parts.push([label,v]); total+=v; } };
  for (const ri of pl.races){
    const regs = regionsOf(S, ri.race), nm = RACES[ri.race].name;
    add(`${nm}: области`, regs.length);
    const cnt = f => regs.filter(i=>f(S.R[i])).length;
    const ne = S.T.conq.filter(c=>c.race===ri.race && c.ne).length;
    if (ri.race==='dwarves') add('Гномы: шахты', cnt(R=>R.mine));
    if (!ri.decl){
      if (ri.race==='humans') add('Люди: пашни', cnt(R=>R.terr==='farm'));
      if (ri.race==='wizards') add('Маги: источники', cnt(R=>R.magic));
      if (ri.race==='orcs') add('Орки: захваты', ne);
      if (ri.power==='forest') add('Лесные: леса', cnt(R=>R.terr==='forest'));
      if (ri.power==='hill') add('Холмовые: холмы', cnt(R=>R.terr==='hill'));
      if (ri.power==='swamp') add('Болотные: болота', cnt(R=>R.terr==='swamp'));
      if (ri.power==='merchant') add('Торговые', regs.length);
      if (ri.power==='alchemist') add('Алхимики', 2);
      if (ri.power==='fortified') add('Крепости', regs.filter(i=>S.O[i].fort).length);
      if (ri.power==='pillaging') add('Мародёры', ne);
      if (ri.power==='wealthy' && !ri.paid){ add('Богатые', 7); ri.paid=true; }
    }
  }
  pl.coins += total;
  S.lastScore = { p, total, parts };
  log(S, `${pl.name} получает ${total} 🪙`);
  return total;
}

function removeRace(S, p, ri){
  for (const i of regionsOf(S, ri.race)) S.O[i]=null;
  S.P[p].races = S.P[p].races.filter(x=>x!==ri);
  S.raceDeck.push(ri.race); S.powDeck.push(ri.power);
  refill(S);
}
function doDecline(S, p){
  const a=active(S,p); if (!a) return;
  if (a.power!=='spirit'){
    const old = S.P[p].races.find(x=>x.decl && x.power!=='spirit');
    if (old){ removeRace(S,p,old); log(S, `${comboName(old)} покидают карту`); }
  } else {
    const old = S.P[p].races.find(x=>x.decl && x.power==='spirit');
    if (old) removeRace(S,p,old);
  }
  for (const i of regionsOf(S, a.race)){
    const o=S.O[i];
    if (a.race!=='ghouls') o.n=1;
    delete o.camp; delete o.hero; delete o.dragon; delete o.hole;
  }
  if (a.race!=='ghouls') a.hand=0;
  a.decl=true; a.dragonAt=-1;
  log(S, `${S.P[p].name}: ${comboName(a)} уходят в упадок`);
}

function finishTurn(S){
  // защитники перегруппировываются в конце хода нападавшего
  S.defQ = S.defQ.filter(q=>S.P[q].races.some(ri=>isArmy(ri) && ri.hand>0 && regionsOf(S,ri.race).length>0));
  if (S.defQ.length){ S.phase='defense'; S.defP=S.defQ.shift(); return; }
  S.defP=null;
  nextPlayer(S);
}
function nextPlayer(S){
  S.cur++;
  if (S.cur>=S.np){ S.cur=0; S.round++; }
  if (S.round>S.maxT){
    S.over=true; S.phase='over';
    const best=Math.max(...S.P.map(p=>p.coins));
    S.winners=S.P.map((p,i)=>i).filter(i=>S.P[i].coins===best);
    log(S, `Игра окончена! Победа: ${S.winners.map(i=>S.P[i].name).join(', ')} (${best} 🪙)`);
    return;
  }
  startTurn(S);
}

function handsLeft(S, p){ return S.P[p].races.filter(ri=>isArmy(ri) && ri.hand>0 && regionsOf(S,ri.race).length>0); }

// ---------- действия ----------
function actor(S){ return S.phase==='defense' ? S.defP : S.cur; }
function act(S, seat, a){
  if (!a || typeof a!=='object') return 'Неизвестное действие';
  if (S.over) return 'Игра окончена';
  const p = actor(S);
  if (seat!=null && seat!==p) return 'Сейчас не ваш ход';
  const err = doAct(S, p, a);
  if (!err) S.seq++;
  return err;
}
function doAct(S, p, a){
  const pl=S.P[p], T=S.T;
  switch (a.t){
  case 'pick': {
    if (S.phase!=='pick') return 'Сейчас нельзя выбирать расу';
    const i=a.i|0; if (i<0||i>=S.shown.length) return 'Нет такой расы';
    if (pl.coins<i) return `Нужно ${i} 🪙`;
    for (let j=0;j<i;j++) S.shown[j].coins++;
    pl.coins -= i;
    const c=S.shown.splice(i,1)[0];
    pl.coins += c.coins;
    const ri = { race:c.race, power:c.power, hand:0, decl:false, holes:0, dragonAt:-1, paid:false };
    ri.hand = Math.min(RACES[c.race].n + POWERS[c.power].n, RACES[c.race].cap);
    pl.races.push(ri);
    refill(S);
    T.picked=true; T.ready[ri.race]=true;
    if (ri.race==='amazons'){ const add=Math.min(4, trayLeft(S,ri)); ri.hand+=add; T.amaz=add; }
    S.phase='conquer';
    log(S, `${pl.name} выбирает: ${comboName(ri)} (${ri.hand} фишек)`);
    return null;
  }
  case 'decline': {
    if (S.phase!=='conquer') return 'Сейчас нельзя';
    const ac=active(S,p); if (!ac) return 'Нет активной расы';
    if (T.picked) return 'Расу, выбранную в этот ход, нельзя сразу отправить в упадок';
    if (T.touched) return 'В упадок уходят вместо захватов, а вы уже начали ход';
    doDecline(S,p); score(S,p); finishTurn(S); return null;
  }
  case 'abandon': {
    if (S.phase!=='conquer') return 'Сейчас нельзя';
    const r=a.r|0, o=S.O[r];
    const ri = o && o.p===p ? raceRI(S,p,o.race) : null;
    if (!ri || !isArmy(ri)) return 'Покинуть можно только область своей активной расы';
    if (T.conq.some(c=>c.race===ri.race)) return 'Покидать области можно только до первого захвата';
    ensureReady(S,ri); if (!ri.decl) T.touched=true;
    ri.hand += S.O[r].n; if (S.O[r].dragon) ri.dragonAt=-1; S.O[r]=null;
    log(S, `${pl.name} покидает область`);
    return null;
  }
  case 'berserk': {
    if (S.phase!=='conquer' || T.final) return 'Сейчас нельзя';
    const ri=active(S,p); if (!ri || !pw(ri,'berserk')) return 'Только для Берсерков';
    if (T.bers!=null) return 'Кубик уже брошен — сначала захватите область';
    ensureReady(S,ri); T.touched=true;
    T.bers = DIE[Math.floor(rnd(S)*6)]; S.lastDie=T.bers;
    log(S, `Берсерки бросают кубик: +${T.bers}`);
    return null;
  }
  case 'conquer': case 'final': {
    if (S.phase!=='conquer') return 'Сейчас не время захватов';
    if (T.final) return 'Последний захват уже был — перегруппируйте войска';
    const ri=armyFor(S,p,a); if (!ri) return 'Нет расы для захвата';
    const r=a.r|0; if (!S.R[r]) return 'Нет такой области';
    ensureReady(S,ri); if (!ri.decl) T.touched=true;
    const tg=target(S,p,ri,r); if (tg.err) return tg.err;
    let cost=tg.cost;
    const bers = pw(ri,'berserk');
    if (bers){ if (T.bers==null) return 'Берсерки сначала бросают кубик'; cost=Math.max(1,cost-T.bers); }
    if (ri.hand<1) return 'Нет фишек в руке';
    let use=cost;
    if (a.t==='conquer'){
      if (ri.hand<cost) return `Нужно ${cost} фишек, в руке ${ri.hand}`;
    } else {
      if (bers) return 'У берсерков кубик уже брошен';
      if (ri.hand>=cost) return 'Фишек хватает — захватывайте без кубика';
      const d=DIE[Math.floor(rnd(S)*6)]; S.lastDie=d; T.final=true;
      if (ri.hand+d<cost){ log(S, `Последний захват: кубик +${d} — не хватило`); S.phase='redeploy'; afterConquest(S,p); return null; }
      use=ri.hand; log(S, `Последний захват: кубик +${d} — успех!`);
    }
    if (bers) T.bers=null;
    const ne = evict(S,p,r);
    ri.hand -= use; occupy(S,p,ri,r,use);
    T.conq.push({ r, race:ri.race, ne });
    log(S, `${pl.name} (${RACES[ri.race].name}) захватывает: ${TERR[S.R[r].terr].name}`);
    if (a.t==='final'){ S.phase='redeploy'; afterConquest(S,p); }
    return null;
  }
  case 'dragon': {
    if (S.phase!=='conquer' || T.final) return 'Сейчас нельзя';
    const ri=active(S,p); if (!ri || !pw(ri,'dragon')) return 'Только для Драконоборцев';
    if (T.dragonUsed) return 'Дракон уже летал в этот ход';
    ensureReady(S,ri); T.touched=true;
    if (ri.hand<1) return 'Нет фишек в руке';
    const r=a.r|0; const tg=target(S,p,ri,r); if (tg.err) return tg.err;
    if (ri.dragonAt>=0 && S.O[ri.dragonAt]) delete S.O[ri.dragonAt].dragon;
    const ne=evict(S,p,r); ri.hand--; occupy(S,p,ri,r,1); S.O[r].dragon=true; ri.dragonAt=r; T.dragonUsed=true;
    T.conq.push({ r, race:ri.race, ne });
    log(S, `${pl.name}: дракон захватывает ${TERR[S.R[r].terr].name.toLowerCase()}`);
    return null;
  }
  case 'sorcery': {
    if (S.phase!=='conquer' || T.final) return 'Сейчас нельзя';
    const ri=active(S,p); if (!ri || !rc(ri,'sorcerers')) return 'Только для Колдунов';
    const r=a.r|0, o=S.O[r];
    if (!o || o.p<0 || o.p===p) return 'Колдовать можно только на фишку соперника';
    const dri=raceRI(S,o.p,o.race);
    if (dri.decl) return 'Только на активную расу соперника';
    if (o.n!==1) return 'В области должна быть ровно одна фишка';
    if (T.sorc[o.p]) return 'Против этого соперника уже колдовали в этот ход';
    if (trayLeft(S,ri)<1) return 'Закончились фишки колдунов';
    ensureReady(S,ri); T.touched=true;
    const tg=target(S,p,ri,r); if (tg.err) return tg.err;
    if (dri.race==='elves') dri.hand++;
    else if (o.p!==p) {} // фишка уходит в коробку
    if (o.dragon) dri.dragonAt=-1;
    if (dri.hand>0 && !S.defQ.includes(o.p)) S.defQ.push(o.p);
    T.attacked[o.p]=true; T.sorc[o.p]=true;
    S.O[r]={ p, race:'sorcerers', n:1 };
    T.conq.push({ r, race:'sorcerers', ne:true });
    log(S, `Колдуны превращают фишку ${S.P[o.p].name}`);
    return null;
  }
  case 'endConquest': {
    if (S.phase!=='conquer') return 'Сейчас нельзя';
    for (const ri of pl.races) if (isArmy(ri)) ensureReady(S,ri);
    T.touched=true;
    S.phase='redeploy'; afterConquest(S,p); return null;
  }
  case 'place': {
    if (S.phase!=='redeploy' && S.phase!=='defense') return 'Сейчас не перегруппировка';
    const r=a.r|0, o=S.O[r];
    if (!o || o.p!==p) return 'Это не ваша область';
    const ri=raceRI(S,p,o.race); if (!ri || !isArmy(ri)) return 'Эту расу не перегруппировать';
    const d=a.d;
    if (d==='all'){ if (ri.hand<1) return 'В руке нет фишек'; o.n+=ri.hand; ri.hand=0; return null; }
    if (d>0){ if (ri.hand<1) return 'В руке нет фишек'; o.n++; ri.hand--; return null; }
    if (d<0){ if (o.n<=1) return 'В области должна остаться хотя бы 1 фишка'; o.n--; ri.hand++; return null; }
    return 'Неверный ход';
  }
  case 'camp': {
    if (S.phase!=='redeploy') return 'Лагеря ставят при перегруппировке';
    const ri=active(S,p); if (!ri || !pw(ri,'bivouacking')) return 'Только для Лагерных';
    const r=a.r|0, o=S.O[r]; if (!o || o.race!==ri.race) return 'Лагерь ставят в свою область';
    const used=regionsOf(S,ri.race).reduce((s,i)=>s+(S.O[i].camp||0),0);
    if (a.d>0){ if (used>=5) return 'Все 5 лагерей уже стоят'; o.camp=(o.camp||0)+1; }
    else { if (!o.camp) return 'Здесь нет лагеря'; o.camp--; if (!o.camp) delete o.camp; }
    return null;
  }
  case 'fort': {
    if (S.phase!=='redeploy') return 'Крепость строят при перегруппировке';
    const ri=active(S,p); if (!ri || !pw(ri,'fortified')) return 'Только для Крепостных';
    const r=a.r|0, o=S.O[r]; if (!o || o.race!==ri.race) return 'Крепость строят в своей области';
    if (T.fortAt===r){ delete o.fort; T.fortAt=-1; return null; }
    if (T.fortAt>=0) return 'В этот ход крепость уже построена';
    if (o.fort) return 'Здесь уже есть крепость';
    if (regionsOf(S,ri.race).filter(i=>S.O[i].fort).length>=6) return 'Все 6 крепостей построены';
    o.fort=1; T.fortAt=r; return null;
  }
  case 'hero': {
    if (S.phase!=='redeploy') return 'Героев ставят при перегруппировке';
    const ri=active(S,p); if (!ri || !pw(ri,'heroic')) return 'Только для Героических';
    const r=a.r|0, o=S.O[r]; if (!o || o.race!==ri.race) return 'Героя ставят в свою область';
    if (o.hero){ delete o.hero; return null; }
    if (regionsOf(S,ri.race).filter(i=>S.O[i].hero).length>=2) return 'Героев только двое — сначала снимите одного';
    o.hero=true; return null;
  }
  case 'endTurn': {
    if (S.phase!=='redeploy') return 'Сначала закончите захваты';
    if (handsLeft(S,p).length) return 'Расставьте все фишки из руки';
    const ac=active(S,p);
    if (a.diplo!=null){
      if (!ac || !pw(ac,'diplomat')) return 'Только для Дипломатов';
      const q=a.diplo|0; if (q===p || !S.P[q]) return 'Выберите соперника';
      if (T.attacked[q]) return 'С тем, на кого вы нападали в этот ход, мир не заключить';
      pl.peaceVs=q; log(S, `${pl.name} заключает мир с ${S.P[q].name}`);
    }
    if (a.stout && !(ac && pw(ac,'stout'))) return 'Только Стойкие уходят в упадок после захватов';
    score(S,p);
    if (a.stout) doDecline(S,p);
    finishTurn(S); return null;
  }
  case 'defDone': {
    if (S.phase!=='defense') return 'Сейчас нельзя';
    if (handsLeft(S,p).length) return 'Расставьте все фишки из руки';
    finishTurn(S); return null;
  }
  }
  return 'Неизвестное действие';
}
// после захватов: амазонки возвращают 4 фишки, скелеты получают подкрепление
function afterConquest(S, p){
  const T=S.T;
  for (const ri of S.P[p].races){
    if (rc(ri,'amazons') && T.amaz>0){
      let left=T.amaz; T.amaz=0;
      const take=Math.min(left, ri.hand); ri.hand-=take; left-=take;
      while (left>0){
        const regs=regionsOf(S,'amazons').filter(i=>S.O[i].n>1).sort((a,b)=>S.O[b].n-S.O[a].n);
        if (!regs.length) break; S.O[regs[0]].n--; left--;
      }
    }
    if (rc(ri,'skeletons')){
      const ne=T.conq.filter(c=>c.race==='skeletons' && c.ne).length;
      const add=Math.min(Math.floor(ne/2), trayLeft(S,ri));
      if (add>0){ ri.hand+=add; log(S, `Скелеты получают +${add}`); }
    }
  }
}

// подсказки для интерфейса: куда можно напасть и сколько это стоит
function targets(S, p, g){
  const ri=armyFor(S,p,g?{g:true}:null); if (!ri) return [];
  return S.R.map((_,r)=>{ const t=target(S,p,ri,r); let cost=t.cost;
    if (!t.err && pw(ri,'berserk') && S.T.bers!=null) cost=Math.max(1,cost-S.T.bers);
    return t.err ? null : { r, cost }; }).filter(Boolean);
}
function handFor(S, p, g){ const ri=armyFor(S,p,g?{g:true}:null); if (!ri) return 0; return ri.hand + (S.T.ready[ri.race] ? 0 : regionsOf(S,ri.race).reduce((s,i)=>s+S.O[i].n-1,0) + (rc(ri,'amazons')?Math.min(4,trayLeft(S,ri)):0)); }

const Engine = { RACES, POWERS, TERR, COLORS, SIZES, DIE, MAP_W, MAP_H, fbm, vnoise, hash2, regionAt, buildMap, newGame, act, actor,
  active, raceRI, regionsOf, onMap, isArmy, targets, handFor, comboName, trayLeft, handsLeft };
if (typeof module!=='undefined' && module.exports) module.exports = Engine; else root.Engine = Engine;
})(this);
