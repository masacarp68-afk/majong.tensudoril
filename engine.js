// ===== 牌: 0-8 萬 / 9-17 筒 / 18-26 索 / 27-30 東南西北 / 31-33 白發中 =====
const HONOR = ['東','南','西','北','白','發','中'];
const KNUM = ['一','二','三','四','五','六','七','八','九'];
const isHonor = t => t >= 27;
const isYao = t => t >= 27 || t % 9 === 0 || t % 9 === 8;
const isDragon = t => t >= 31;
const isWind = t => t >= 27 && t <= 30;
const suitOf = t => t >= 27 ? 3 : Math.floor(t / 9);
const tileName = t => t >= 27 ? HONOR[t - 27] : (t % 9 + 1) + ['萬','筒','索'][suitOf(t)];
const MAX_FU = 50; // 出題は50符以下のよく出る形に絞る
const rnd = n =>Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
function pickW(vals, ws){ let s = ws.reduce((a,b)=>a+b,0), r = Math.random()*s; for(let i=0;i<vals.length;i++){ r -= ws[i]; if(r < 0) return vals[i]; } return vals[vals.length-1]; }
const WAIT = {ryanmen:'両面', kanchan:'嵌張（カンチャン）', penchan:'辺張（ペンチャン）', tanki:'単騎', shanpon:'双碰（シャンポン）'};

// ----- 点数 -----
const up100 = x => Math.ceil(x / 100) * 100;
function basePoints(han, fu){
  if(han >= 13) return 8000; if(han >= 11) return 6000; if(han >= 8) return 4000;
  if(han >= 6) return 3000; if(han >= 5) return 2000;
  return Math.min(fu * Math.pow(2, han + 2), 2000);
}
function limitName(han, fu){
  if(han >= 13) return '数え役満'; if(han >= 11) return '三倍満'; if(han >= 8) return '倍満';
  if(han >= 6) return '跳満'; if(han >= 5 || fu * Math.pow(2, han + 2) >= 2000) return '満貫';
  return '';
}
function payment(han, fu, oya, tsumo){
  const b = basePoints(han, fu);
  if(!tsumo){ const v = up100(b * (oya ? 6 : 4)); return {label: String(v), total: v}; }
  if(oya){ const v = up100(b * 2); return {label: v + 'オール', total: v * 3}; }
  const k = up100(b), o = up100(b * 2);
  return {label: k + '-' + o, total: k * 2 + o};
}

// ----- 面子分解 -----
function decompose(c){
  const res = [];
  const rec = (i, sets, pair) => {
    while(i < 34 && c[i] === 0) i++;
    if(i === 34){ res.push({pair, sets: sets.slice()}); return; }
    if(c[i] >= 3){ c[i] -= 3; sets.push({type:'kou', t:i}); rec(i, sets, pair); sets.pop(); c[i] += 3; }
    if(i < 27 && i % 9 <= 6 && c[i+1] > 0 && c[i+2] > 0){
      c[i]--; c[i+1]--; c[i+2]--; sets.push({type:'shun', t:i}); rec(i, sets, pair); sets.pop(); c[i]++; c[i+1]++; c[i+2]++;
    }
  };
  for(let p = 0; p < 34; p++) if(c[p] >= 2){ c[p] -= 2; rec(0, [], p); c[p] += 2; }
  return res;
}

// ----- 通常形の役と符 -----
function evalStd(h, menzen, groups, pair, wait){
  const {tsumo, riichi, seat, round} = h;
  const shun = groups.filter(g => g.type === 'shun');
  const kous = groups.filter(g => g.type !== 'shun');
  const all = [];
  groups.forEach(g => { if(g.type === 'shun') all.push(g.t, g.t+1, g.t+2); else all.push(g.t, g.t, g.t); });
  all.push(pair, pair);
  const anko = kous.filter(g => g.anko).length;
  const dragK = kous.filter(g => isDragon(g.t)).length;
  const windK = kous.filter(g => isWind(g.t)).length;
  const kanN = kous.filter(g => g.type === 'kan').length;
  const green = new Set([19,20,21,23,25,32]);
  if(anko === 4 || dragK === 3 || windK === 4 || (windK === 3 && isWind(pair)) || kanN === 4 ||
     all.every(isHonor) || all.every(t => !isHonor(t) && isYao(t)) || all.every(t => green.has(t))) return {yakuman:true};

  const yaku = []; const add = (n, v) => yaku.push([n, v]);
  if(riichi) add('立直', 1);
  if(menzen && tsumo) add('門前清自摸和', 1);
  const pairYakuhai = isDragon(pair) || pair === seat || pair === round;
  const pinfu = menzen && shun.length === 4 && !pairYakuhai && wait === 'ryanmen';
  if(pinfu) add('平和', 1);
  if(all.every(t => !isYao(t))) add('断么九', 1);
  if(menzen){
    const cnt = {}; shun.forEach(g => cnt[g.t] = (cnt[g.t] || 0) + 1);
    let pk = 0; Object.values(cnt).forEach(v => pk += Math.floor(v / 2));
    if(pk >= 2) add('二盃口', 3); else if(pk === 1) add('一盃口', 1);
  }
  kous.forEach(g => {
    if(g.t === 31) add('役牌 白', 1); if(g.t === 32) add('役牌 發', 1); if(g.t === 33) add('役牌 中', 1);
    if(g.t === seat) add('自風 ' + HONOR[g.t-27], 1);
    if(g.t === round) add('場風 ' + HONOR[g.t-27], 1);
  });
  for(let n = 0; n < 7; n++) if([0,1,2].every(s => shun.some(g => g.t === s*9+n))){ add('三色同順', menzen ? 2 : 1); break; }
  for(let s = 0; s < 3; s++) if([0,3,6].every(n => shun.some(g => g.t === s*9+n))){ add('一気通貫', menzen ? 2 : 1); break; }
  const gYao = g => g.type === 'shun' ? (g.t % 9 === 0 || g.t % 9 === 6) : isYao(g.t);
  if(shun.length > 0 && groups.every(gYao) && isYao(pair)){
    if(all.some(isHonor)) add('混全帯么九', menzen ? 2 : 1); else add('純全帯么九', menzen ? 3 : 2);
  }
  if(kous.length === 4) add('対々和', 2);
  if(anko === 3) add('三暗刻', 2);
  for(let n = 0; n < 9; n++) if([0,1,2].every(s => kous.some(g => g.t === s*9+n))){ add('三色同刻', 2); break; }
  if(kanN === 3) add('三槓子', 2);
  if(dragK === 2 && isDragon(pair)) add('小三元', 2);
  if(all.every(isYao)) add('混老頭', 2);
  const suits = new Set(all.filter(t => !isHonor(t)).map(suitOf));
  if(suits.size === 1){ if(all.some(isHonor)) add('混一色', menzen ? 3 : 2); else add('清一色', menzen ? 6 : 5); }

  // 符
  const items = [['副底', 20]]; let fu = 20;
  if(menzen && !tsumo){ items.push(['門前ロン', 10]); fu += 10; }
  kous.forEach(g => {
    let v = 2; if(isYao(g.t)) v *= 2; if(g.anko) v *= 2; if(g.type === 'kan') v *= 4;
    const kind = g.type === 'kan' ? (g.anko ? '暗槓' : '明槓') : (g.anko ? '暗刻' : '明刻');
    items.push([kind + ' ' + tileName(g.t) + (isYao(g.t) ? '（么九）' : '（中張）'), v]); fu += v;
  });
  if(isDragon(pair)){ items.push(['雀頭 ' + tileName(pair) + '（役牌）', 2]); fu += 2; }
  if(pair === seat){ items.push(['雀頭 ' + tileName(pair) + '（自風）', 2]); fu += 2; }
  if(pair === round){ items.push(['雀頭 ' + tileName(pair) + '（場風）', 2]); fu += 2; }
  if(wait === 'kanchan' || wait === 'penchan' || wait === 'tanki'){ items.push(['待ち ' + WAIT[wait].replace(/（.*）/, ''), 2]); fu += 2; }
  if(tsumo && !pinfu){ items.push(['ツモ', 2]); fu += 2; }
  let fuR = Math.ceil(fu / 10) * 10, note = '';
  if(pinfu && tsumo) note = '平和ツモはツモ符なしで20符';
  if(!menzen && fuR === 20){ fuR = 30; note = '鳴き手で20符のときは30符にする'; }
  return {yaku, fu: fuR, fuRaw: fu, fuItems: items, fuNote: note, wait, pinfu};
}

function evalChiitoi(h, c){
  const all = []; c.forEach((v, t) => { for(let k = 0; k < v; k++) all.push(t); });
  if(all.every(isHonor)) return {yakuman:true};
  const yaku = []; const add = (n, v) => yaku.push([n, v]);
  if(h.riichi) add('立直', 1);
  if(h.tsumo) add('門前清自摸和', 1);
  add('七対子', 2);
  if(all.every(t => !isYao(t))) add('断么九', 1);
  if(all.every(isYao)) add('混老頭', 2);
  const suits = new Set(all.filter(t => !isHonor(t)).map(suitOf));
  if(suits.size === 1){ if(all.some(isHonor)) add('混一色', 3); else add('清一色', 6); }
  return {yaku, fu: 25, fuRaw: 25, fuItems: [['七対子（固定）', 25]], fuNote: '七対子は常に25符（切り上げなし）', wait: 'tanki', chiitoi: true};
}

// h = {fixed:[{type,t,open}], free:counts(和了牌込み), win, tsumo, riichi, seat, round, dora, oya}
function evaluate(h){
  const menzen = h.fixed.every(g => !g.open);
  const c = h.free.slice();
  if(h.fixed.length === 0){
    const ss = new Set(); let honors = false;
    c.forEach((v, t) => { if(v){ if(isHonor(t)) honors = true; else ss.add(suitOf(t)); } });
    if(!honors && ss.size === 1){
      const s = [...ss][0], need = [3,1,1,1,1,1,1,1,3];
      if(need.every((n, i) => c[s*9+i] >= n)) return {yakuman:true};
    }
  }
  let best = null, yakuman = false;
  const consider = r => {
    if(r.yakuman){ yakuman = true; return; }
    const yakuHan = r.yaku.reduce((a, y) => a + y[1], 0);
    const yaku = r.yaku.slice();
    if(yakuHan > 0 && h.dora > 0) yaku.push(['ドラ', h.dora]);
    const han = yakuHan > 0 ? yakuHan + h.dora : 0;
    const pay = han > 0 ? payment(han, r.fu, h.oya, h.tsumo) : {label:'', total:0};
    const res = {...r, yaku, yakuHan, han, pay, limit: han > 0 ? limitName(han, r.fu) : ''};
    if(!best || pay.total > best.pay.total || (pay.total === best.pay.total && (han > best.han || (han === best.han && r.fu > best.fu)))) best = res;
  };
  decompose(c.slice()).forEach(d => {
    const spots = [];
    if(d.pair === h.win) spots.push(-1);
    d.sets.forEach((s, i) => { if(s.type === 'kou' ? s.t === h.win : (h.win >= s.t && h.win <= s.t + 2)) spots.push(i); });
    spots.forEach(wi => {
      let wait;
      if(wi === -1) wait = 'tanki';
      else {
        const s = d.sets[wi];
        if(s.type === 'kou') wait = 'shanpon';
        else {
          const p = h.win - s.t, n = s.t % 9;
          wait = p === 1 ? 'kanchan' : p === 0 ? (n === 6 ? 'penchan' : 'ryanmen') : (n === 0 ? 'penchan' : 'ryanmen');
        }
      }
      const groups = h.fixed.map(g => ({type:g.type, t:g.t, anko: !g.open && g.type !== 'shun'}))
        .concat(d.sets.map((s, i) => ({type:s.type, t:s.t, anko: s.type === 'kou' && !(i === wi && !h.tsumo)})));
      consider(evalStd(h, menzen, groups, d.pair, wait));
    });
  });
  if(h.fixed.length === 0 && c.filter(v => v === 2).length === 7) consider(evalChiitoi(h, c));
  if(yakuman) return {yakuman:true};
  return best;
}

// ----- 手牌生成 -----
function tryGen(){
  const seat = 27 + rnd(4), round = Math.random() < 0.7 ? 27 : 28;
  const tsumo = Math.random() < 0.45;
  const dora = pickW([0,1,2,3], [50,30,15,5]);
  const theme = Math.random();
  const oneSuit = theme < 0.2 ? rnd(3) : -1;
  const simples = theme >= 0.2 && theme < 0.38;
  const randTile = shun => {
    const s = oneSuit >= 0 ? oneSuit : rnd(3);
    if(shun) return s*9 + (simples ? 1 + rnd(5) : rnd(7));
    if(!simples && Math.random() < (oneSuit >= 0 ? 0.35 : 0.25)) return 27 + rnd(7);
    return s*9 + (simples ? 1 + rnd(7) : rnd(9));
  };
  const counts = new Array(34).fill(0);
  let fixed = [], free = new Array(34).fill(0), win, riichi;

  if(Math.random() < 0.08){
    const ts = new Set(); while(ts.size < 7) ts.add(randTile(false));
    ts.forEach(t => free[t] = 2);
    win = pick([...ts]); riichi = Math.random() < 0.55;
  } else {
    const nOpen = Math.random() < 0.6 ? 0 : 1 + rnd(3);
    const sets = [];
    for(let i = 0; i < 4; i++){
      const sh = Math.random() < 0.66;
      sets.push({type: sh ? 'shun' : 'kou', t: randTile(sh), open: i < nOpen});
    }
    if(Math.random() < 0.06){ const k = sets.find(s => s.type === 'kou'); if(k) k.type = 'kan'; }
    const pair = randTile(false);
    if(pair === seat && pair === round) return null;
    sets.forEach(s => { if(s.type === 'shun'){ counts[s.t]++; counts[s.t+1]++; counts[s.t+2]++; } else counts[s.t] += s.type === 'kan' ? 4 : 3; });
    counts[pair] += 2;
    if(counts.some(v => v > 4)) return null;
    const cands = [pair, pair];
    sets.forEach(s => {
      if(s.open || s.type === 'kan'){ fixed.push({type:s.type, t:s.t, open:s.open, called: rnd(3), from: rnd(3)}); return; }
      if(s.type === 'shun'){ cands.push(s.t, s.t+1, s.t+2); free[s.t]++; free[s.t+1]++; free[s.t+2]++; }
      else { cands.push(s.t); free[s.t] += 3; }
    });
    free[pair] += 2;
    win = pick(cands);
    riichi = nOpen === 0 && Math.random() < 0.55;
  }
  const h = {fixed, free, win, tsumo, riichi, seat, round, dora, oya: seat === 27};
  const r = evaluate(h);
  if(!r || r.yakuman || r.yakuHan === 0 || r.fu > MAX_FU) return null;
  h.res = r;
  return h;
}
function genHand(){ for(let i = 0; i < 2000; i++){ const h = tryGen(); if(h) return h; } }
