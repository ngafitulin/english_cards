/* Small World — художник карты: рисует рельеф попиксельно (шум + освещение), без готовых картинок. */
(function (root) {
"use strict";
const E = root.Engine;
const { fbm, vnoise, hash2 } = E;
const PAL_FARM = [[201,178,98],[126,152,72],[152,171,86],[140,108,70],[212,193,122],[104,134,62],[176,160,90],[118,96,62]];
let cr=0, cg=0, cb=0, ch=0; // результат surface()

function mix(a, b, t){ return a + (b-a)*t; }
function sstep(e0, e1, x){ const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0))); return t*t*(3-2*t); }

// цвет и высота поверхности в точке (x,y) карты; dB — расстояние до границы области (px), dC — до береговой линии (px)
function surface(t, x, y, rid, dB, dC, rad){
  const n1 = fbm(x*6, y*6, 11, 3);
  if (t==='farm'){
    const a = hash2(rid,7,3)*Math.PI, ca=Math.cos(a), sa=Math.sin(a);
    const wu = 0.35*(vnoise(x*14,y*14,5)-0.5);
    const u = (x*ca + y*sa)*26 + wu, v = (-x*sa + y*ca)*42 + wu*0.7;
    const fu=Math.floor(u), fv=Math.floor(v), hsh=hash2(fu,fv,rid+101);
    const c = PAL_FARM[Math.floor(hsh*PAL_FARM.length)];
    const stripe = 1 + 0.07*Math.sin((-x*sa + y*ca)*1500 + hsh*9) * (hsh<0.55?1:0.4);
    const tex = 0.9 + 0.2*vnoise(x*260,y*260,9);
    cr=c[0]*stripe*tex; cg=c[1]*stripe*tex; cb=c[2]*stripe*tex;
    ch = 2*n1;
    const eu=u-fu, ev=v-fv;
    if (eu<0.045 || ev<0.07){ // живые изгороди между полями
      const tr = vnoise(x*400,y*400,3);
      cr=48+18*tr; cg=74+20*tr; cb=36+10*tr; ch += 2.2 + 1.5*tr;
    }
    if (hash2(fu,fv,rid+7)<0.035){ // хутор
      const bx=(eu-0.5), by=(ev-0.5);
      if (Math.abs(bx)<0.12 && Math.abs(by)<0.18){ cr=150; cg=78; cb=58; ch+=4; }
    }
    return;
  }
  if (t==='forest'){
    const c = fbm(x*170, y*170, 23, 2);
    const v = fbm(x*22, y*22, 41, 2);
    const crown = Math.max(0, c-0.28)*1.6;
    cr = mix(30, 62, crown) + 30*(v-0.5) + 22*Math.max(0,v-0.62)*4;
    cg = mix(48, 92, crown) + 14*(v-0.5);
    cb = mix(26, 40, crown);
    if (c<0.3){ cr*=0.62; cg*=0.66; cb*=0.66; }
    ch = 3*n1 + 7*crown*crown;
    return;
  }
  if (t==='hill'){
    const ramp = sstep(0, rad*0.55, dB);
    const g = fbm(x*13, y*13, 31, 4);
    const det = fbm(x*90, y*90, 37, 2);
    ch = (8 + 34*g)*ramp + 3*det;
    cr = 116 + 30*(det-0.5) + 20*g; cg = 140 + 22*(det-0.5) + 6*g; cb = 70 + 10*(det-0.5);
    const rock = fbm(x*45, y*45, 43, 2);
    if (rock>0.64){ const k=sstep(0.64,0.72,rock); cr=mix(cr,146,k); cg=mix(cg,134,k); cb=mix(cb,110,k); }
    // редкие деревья
    const tr = vnoise(x*190,y*190,47);
    if (tr>0.8 && det>0.45){ cr=46; cg=72; cb=36; ch+=3; }
    return;
  }
  if (t==='mount'){
    const ramp = sstep(0, rad*0.85, dB);
    let r=0, amp=1, f=8, norm=0;
    for (let i=0;i<5;i++){ const q=1-Math.abs(2*vnoise(x*f,y*f,61+i*13)-1); r+=q*q*amp; norm+=amp; amp*=0.5; f*=2.1; }
    r/=norm;
    const hf = r*ramp;
    ch = 140*hf + 6*n1;
    const det = vnoise(x*300,y*300,67);
    if (hf<0.3){ const k=hf/0.3; cr=mix(104,124,k); cg=mix(104,112,k); cb=mix(66,92,k); }
    else { cr=124+18*det; cg=118+16*det; cb=110+16*det; }
    const snow = 0.52 + 0.08*vnoise(x*30,y*30,71);
    if (hf>snow){ const k=sstep(snow,snow+0.06,hf); cr=mix(cr,243,k); cg=mix(cg,245,k); cb=mix(cb,250,k); }
    return;
  }
  if (t==='swamp'){
    const m = fbm(x*24, y*24, 81, 3);
    const det = vnoise(x*220,y*220,83);
    cr = 88 + 26*(m-0.5) + 14*det; cg = 96 + 22*(m-0.5) + 10*det; cb = 56 + 8*det;
    ch = 1.5*n1;
    if (m>0.56){ // стоячая вода
      const k = sstep(0.56,0.6,m);
      cr=mix(cr,48,k); cg=mix(cg,70,k); cb=mix(cb,66,k); ch-=1.5*k;
      if (det>0.82){ cr=118; cg=128; cb=70; ch+=1; } // камыш
    } else if (det>0.86){ cr=70; cg=86; cb=44; ch+=1.5; }
    return;
  }
  // вода
  const sea = t==='sea';
  const d = Math.min(1, dC/(sea?70:34));
  const dd = Math.sqrt(d);
  cr = sea ? mix(92,18,dd) : mix(86,26,dd);
  cg = sea ? mix(170,58,dd) : mix(152,84,dd);
  cb = sea ? mix(178,104,dd) : mix(150,100,dd);
  const w = vnoise(x*60, y*240, 91)*0.6 + vnoise(x*150,y*40,93)*0.4;
  ch = 1.2*w;
  const glint = Math.max(0, w-0.72)*2.2;
  cr+=60*glint; cg+=60*glint; cb+=60*glint;
  if (dC<3){ const k=(1-dC/3)*0.7; cr=mix(cr,235,k); cg=mix(cg,240,k); cb=mix(cb,236,k); }
}

// хамферное расстояние: src[i]=0 у «затравок», остальные Infinity
function chamfer(dist, W, H, same){
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const i=y*W+x; let d=dist[i]; if (d===0) continue;
    if (x>0 && same(i,i-1)) d=Math.min(d,dist[i-1]+1);
    if (y>0){ if (same(i,i-W)) d=Math.min(d,dist[i-W]+1);
      if (x>0 && same(i,i-W-1)) d=Math.min(d,dist[i-W-1]+1.414);
      if (x<W-1 && same(i,i-W+1)) d=Math.min(d,dist[i-W+1]+1.414); }
    dist[i]=d; }
  for (let y=H-1;y>=0;y--) for (let x=W-1;x>=0;x--){ const i=y*W+x; let d=dist[i]; if (d===0) continue;
    if (x<W-1 && same(i,i+1)) d=Math.min(d,dist[i+1]+1);
    if (y<H-1){ if (same(i,i+W)) d=Math.min(d,dist[i+W]+1);
      if (x<W-1 && same(i,i+W+1)) d=Math.min(d,dist[i+W+1]+1.414);
      if (x>0 && same(i,i+W-1)) d=Math.min(d,dist[i+W-1]+1.414); }
    dist[i]=d; }
}
const tick = ()=>new Promise(r=>setTimeout(r,0));

// Полная карта. Возвращает { canvas, id, dB, W, H }
async function paint(M, R, W, H, progress){
  progress = progress || (()=>{});
  const N=W*H, sx=E.MAP_W/W, sy=E.MAP_H/H, id=new Int16Array(N);
  // 1) области: грубая сетка + точный расчёт только у границ
  const st=4, CW=Math.ceil(W/st)+1, CH=Math.ceil(H/st)+1, cid=new Int16Array(CW*CH);
  for (let y=0;y<CH;y++) for (let x=0;x<CW;x++) cid[y*CW+x]=E.regionAt(M,(x*st+0.5)*sx,(y*st+0.5)*sy);
  for (let y=0;y<H;y++){
    const cy=Math.floor(y/st);
    for (let x=0;x<W;x++){
      const cx=Math.floor(x/st), a=cid[cy*CW+cx];
      id[y*W+x] = (a===cid[cy*CW+cx+1] && a===cid[(cy+1)*CW+cx] && a===cid[(cy+1)*CW+cx+1]) ? a : E.regionAt(M,(x+0.5)*sx,(y+0.5)*sy);
    }
    if (y%100===0){ progress(0.12*y/H); await tick(); }
  }
  // 2) расстояния до границ областей и до берега
  const water = new Uint8Array(R.length); R.forEach((r,i)=>water[i]=r.water?1:0);
  const dB=new Float32Array(N), dC=new Float32Array(N);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const i=y*W+x, a=id[i];
    const b = (x>0&&id[i-1]!==a)||(x<W-1&&id[i+1]!==a)||(y>0&&id[i-W]!==a)||(y<H-1&&id[i+W]!==a);
    dB[i] = b ? 0 : Infinity;
    const wa=water[a];
    const c = (x>0&&water[id[i-1]]!==wa)||(x<W-1&&water[id[i+1]]!==wa)||(y>0&&water[id[i-W]]!==wa)||(y<H-1&&water[id[i+W]]!==wa);
    dC[i] = c ? 0 : Infinity;
  }
  chamfer(dB, W, H, (i,j)=>id[i]===id[j]);
  await tick(); progress(0.18);
  chamfer(dC, W, H, (i,j)=>water[id[i]]===water[id[j]]);
  for (let i=0;i<N;i++) if (dC[i]===Infinity) dC[i]=500;
  await tick(); progress(0.24);
  // 3) цвет и высота
  const cR=new Float32Array(N), cG=new Float32Array(N), cBl=new Float32Array(N), hh=new Float32Array(N);
  const radPx = R.map(r=>Math.max(8,(r.rad||0.05)*H));
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=y*W+x, a=id[i], t=R[a].terr;
      surface(t, (x+0.5)*sx, (y+0.5)*sy, a, dB[i], dC[i], radPx[a]);
      // песчаный берег
      if (!water[a] && dC[i]<5 && t!=='mount' && t!=='swamp'){ const k=1-dC[i]/5; cr=mix(cr,214,k); cg=mix(cg,196,k); cb=mix(cb,142,k); }
      cR[i]=cr; cG[i]=cg; cBl[i]=cb; hh[i]=water[a]?Math.min(ch,1.2):ch+ (dC[i]<6? -2*(1-dC[i]/6):0);
    }
    if (y%40===0){ progress(0.24+0.66*y/H); await tick(); }
  }
  // 4) освещение, границы, рамка
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d'), img=ctx.createImageData(W,H), px=img.data;
  const Lx=-0.55, Ly=-0.62, Lz=0.56;
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=y*W+x, a=id[i];
      const hx=(hh[x<W-1?i+1:i]-hh[x>0?i-1:i])*0.5, hy=(hh[y<H-1?i+W:i]-hh[y>0?i-W:i])*0.5;
      const inv=1/Math.sqrt(hx*hx+hy*hy+1);
      let sh=(-hx*Lx - hy*Ly + Lz)*inv / Lz;
      sh = water[a] ? 0.85+0.15*sh : 0.42+0.58*sh;
      let r=cR[i]*sh, g=cG[i]*sh, b=cBl[i]*sh;
      // затенение у края области, чтобы области читались
      const d=dB[i];
      const ao = 0.86 + 0.14*Math.min(1, d/12);
      r*=ao; g*=ao; b*=ao;
      if (d<1.3){
        if (water[a] && dC[i]>1.5){ if (((x+y)>>2)&1){ r=mix(r,230,0.45); g=mix(g,240,0.45); b=mix(b,245,0.45); } }
        else if (dC[i]>1.5){ r=mix(r,44,0.8); g=mix(g,32,0.8); b=mix(b,22,0.8); }
      } else if (d<2.6 && !water[a] && dC[i]>2){ r=mix(r,250,0.18); g=mix(g,236,0.18); b=mix(b,200,0.18); }
      // виньетка по краю карты
      const ex=Math.min(x,W-1-x), ey=Math.min(y,H-1-y), e=Math.min(ex,ey);
      if (e<26){ const k=(1-e/26)*0.35; r*=1-k; g*=1-k; b*=1-k; }
      const o=i*4; px[o]=r; px[o+1]=g; px[o+2]=b; px[o+3]=255;
    }
    if (y%80===0){ progress(0.9+0.1*y/H); await tick(); }
  }
  ctx.putImageData(img,0,0);
  progress(1);
  const dB8=new Uint8Array(N); for (let i=0;i<N;i++) dB8[i]=Math.min(255,dB[i]);
  return { canvas:cv, id, dB:dB8, W, H };
}

// Подсветка: fills — массив по областям: null или [r,g,b,alphaFill,alphaEdge,edgeWidth]
function overlay(cv, map, fills){
  const { W, H, id, dB } = map;
  if (cv.width!==W){ cv.width=W; cv.height=H; }
  const ctx=cv.getContext('2d'), img=ctx.createImageData(W,H), px=img.data;
  for (let i=0, N=W*H; i<N; i++){
    const f=fills[id[i]]; if (!f) continue;
    const d=dB[i]; let a=f[3];
    if (d<f[5]) a=Math.max(a, f[4]*(1-d/f[5]));
    if (a<=0) continue;
    const o=i*4; px[o]=f[0]; px[o+1]=f[1]; px[o+2]=f[2]; px[o+3]=a*255;
  }
  ctx.putImageData(img,0,0);
}

// Образец местности для легенды
function swatch(t, w, h){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d'), img=ctx.createImageData(w,h), px=img.data;
  const hh=new Float32Array(w*h), cc=new Float32Array(w*h*3);
  const off = t.length*0.37;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const dB=Math.min(x,y,w-1-x,h-1-y)+4, dC=t==='sea'||t==='lake'? x+4 : 500;
    surface(t, off+x/1000, 0.3+y/1000, 3, dB, dC, Math.min(w,h)*0.6);
    const i=y*w+x; hh[i]=ch; cc[i*3]=cr; cc[i*3+1]=cg; cc[i*3+2]=cb;
  }
  const water = t==='sea'||t==='lake';
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const i=y*w+x;
    const hx=(hh[x<w-1?i+1:i]-hh[x>0?i-1:i])*0.5, hy=(hh[y<h-1?i+w:i]-hh[y>0?i-w:i])*0.5;
    const inv=1/Math.sqrt(hx*hx+hy*hy+1); let sh=(0.55*hx+0.62*hy+0.56)*inv/0.56;
    sh = water ? 0.85+0.15*sh : 0.42+0.58*sh;
    const o=i*4; px[o]=cc[i*3]*sh; px[o+1]=cc[i*3+1]*sh; px[o+2]=cc[i*3+2]*sh; px[o+3]=255;
  }
  ctx.putImageData(img,0,0);
  return cv;
}

root.Painter = { paint, overlay, swatch };
})(this);
