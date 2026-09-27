// ===== 問題生成・牌表示・解説（練習/タイムアタック/対戦で共通）=====
const FU_LIST = [20,25,30,40,50,60,70,80,90,100,110];
const Q_FU = FU_LIST.filter(f => f <= MAX_FU);
const QUICK_FU = FU_LIST.filter(f => f <= 70); // 翻符→点だけ70符まで

function shuffle(a){ for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ----- tiles -----
const HONOR_FILE = ['ton','nan','sya','pe','haku','hatu','tyun'];
function tileHTML(t){
  if(t === -1) return '<img class="tile" src="tiles/null.png" alt="裏">';
  const f = t >= 27 ? HONOR_FILE[t-27] : (t % 9 + 1) + 'mps'[suitOf(t)];
  return `<img class="tile" src="tiles/${f}.png" alt="${tileName(t)}">`;
}
const yokoHTML = t => `<span class="yoko">${tileHTML(t)}</span>`;
// 鳴いた牌を横向きに。pos: 上家=0 / 対面=1 / 下家=末尾
function calledRow(tiles, calledIdx, pos){
  const called = tiles[calledIdx], rest = tiles.filter((_, i) => i !== calledIdx);
  const out = rest.map(tileHTML);
  out.splice(pos, 0, yokoHTML(called));
  return out.join('');
}
function handHTML(h){
  const c = h.free.slice(); c[h.win]--;
  const closed = []; c.forEach((v, t) => { for(let k = 0; k < v; k++) closed.push(t); });
  let html = `<div class="hand"><div class="row">${closed.map(tileHTML).join('')}</div>
    <div class="winwrap" data-l="${h.tsumo ? 'ツモ' : 'ロン'}">${tileHTML(h.win)}</div></div>`;
  if(h.fixed.length){
    html += '<div class="melds">' + h.fixed.map(g => {
      let tag, row;
      if(g.type === 'shun'){ tag = 'チー'; row = calledRow([g.t, g.t+1, g.t+2], g.called, 0); }
      else if(g.type === 'kou'){ tag = 'ポン'; row = calledRow([g.t, g.t, g.t], 0, [0, 1, 2][g.from]); }
      else if(g.open){ tag = '明槓'; row = calledRow([g.t, g.t, g.t, g.t], 0, [0, 1, 3][g.from]); }
      else { tag = '暗槓'; row = [-1, g.t, g.t, -1].map(tileHTML).join(''); }
      return `<div class="meld"><em>${tag}</em><div class="row">${row}</div></div>`;
    }).join('') + '</div>';
  }
  return html;
}
function condChips(h){
  const w = HONOR[h.seat - 27];
  return `<div class="chips">
    <span class="chip ${h.oya ? 'oya' : ''}">${h.oya ? '親' : '子'}・${w}家</span>
    <span class="chip">${HONOR[h.round - 27]}場</span>
    <span class="chip agari">${h.tsumo ? 'ツモ' : 'ロン'}</span>
    ${h.riichi ? '<span class="chip riichi">リーチ</span>' : ''}
    ${h.dora ? `<span class="chip">ドラ${h.dora}</span>` : ''}
  </div>`;
}

// ----- 問題生成 -----
function nearLabels(correct, oya, tsumo, total, fus = Q_FU){
  const pool = new Map();
  for(let han = 1; han <= 13; han++) for(const fu of fus){
    const p = payment(han, fu, oya, tsumo);
    if(p.label !== correct && !pool.has(p.label)) pool.set(p.label, p.total);
  }
  // 親子の取り違えも混ぜる（同じ表記形式のロンのみ）
  const arr = [...pool.entries()].sort((a, b) => Math.abs(a[1] - total) - Math.abs(b[1] - total));
  return shuffle(arr.slice(0, 6)).slice(0, 3).map(e => e[0]);
}
function pointChoices(pay, oya, tsumo, fus){
  return shuffle([pay.label, ...nearLabels(pay.label, oya, tsumo, pay.total, fus)]);
}
function genQuick(){
  const oya = Math.random() < 0.35, tsumo = Math.random() < 0.5;
  let han, fu;
  if(Math.random() < 0.12){ han = pick([5,5,6,6,7,8,9,10,11,12,13]); fu = 30; }
  else {
    for(;;){
      han = pickW([1,2,3,4], [28,32,26,14]);
      fu = pickW(QUICK_FU, [10,6,34,30,12,5,3]);
      if(fu === 20 && (!tsumo || han < 2)) continue;
      if(fu === 25 && (tsumo ? han < 3 : han < 2)) continue;
      break;
    }
  }
  const pay = payment(han, fu, oya, tsumo);
  return {kind:'quick', han, fu, oya, tsumo, pay, choices: pointChoices(pay, oya, tsumo, QUICK_FU), correct: pay.label};
}
function genFu(){
  const h = genHand(), fu = h.res.fu;
  const opts = fu === 25 ? [20,25,30,40] : [20,30,40,50];
  return {kind:'fu', h, choices: opts.map(String), correct: String(fu)};
}
function genFull(){
  const h = genHand(), pay = h.res.pay;
  return {kind:'full', h, choices: pointChoices(pay, h.oya, h.tsumo), correct: pay.label};
}

// ----- 解説 -----
function calcHTML(han, fu, oya, tsumo){
  const lim = limitName(han, fu), b = basePoints(han, fu);
  let s = '';
  if(han >= 5) s += `${han}翻 → <b>${lim}</b>（基本点 ${b}）<br>`;
  else {
    const raw = fu * Math.pow(2, han + 2);
    s += `基本点 = ${fu} × 2<sup>${han}+2</sup> = ${raw}<br>`;
    if(raw >= 2000) s += `2000以上なので <b>満貫</b>（基本点 2000）<br>`;
  }
  if(!tsumo) s += `${oya ? '親' : '子'}ロン：${b} × ${oya ? 6 : 4} = ${b * (oya ? 6 : 4)} → <b>${up100(b * (oya ? 6 : 4))}</b>`;
  else if(oya) s += `親ツモ：各家 ${b} × 2 = ${b*2} → <b>${up100(b*2)}オール</b>`;
  else s += `子ツモ：子 ${b} → <b>${up100(b)}</b>、親 ${b} × 2 = ${b*2} → <b>${up100(b*2)}</b>`;
  return `<div class="calc">${s}<br><span class="note">※100点未満は切り上げ</span></div>`;
}
function handExplain(h, showPoints){
  const r = h.res;
  const yaku = r.yaku.map(y => `<li><span>${y[0]}</span><span>${y[1]}翻</span></li>`).join('');
  const fus = r.fuItems.map(f => `<li><span>${f[0]}</span><span>${f[1]}符</span></li>`).join('');
  const fuSum = r.chiitoi ? '' : `<li class="sum"><span>合計 ${r.fuRaw}符 → 切り上げ</span><span>${r.fu}符</span></li>`;
  const who = `${h.oya ? '親' : '子'}${h.tsumo ? 'ツモ' : 'ロン'}`;
  return `<div class="exp">
    <div><h3>役</h3><ul>${yaku}<li class="sum"><span>合計</span><span>${r.han}翻</span></li></ul></div>
    <div><h3>符　<span style="letter-spacing:0">待ち：${WAIT[r.wait]}</span></h3><ul>${fus}${fuSum}</ul>
      ${r.fuNote ? `<div class="note">※${r.fuNote}</div>` : ''}</div>
    ${showPoints ? `<div><h3>点数</h3>${calcHTML(r.han, r.fu, h.oya, h.tsumo)}</div>` : ''}
    <div class="res">${r.han}翻${r.fu}符${r.limit ? '・' + r.limit : ''} ${who}<b>${r.pay.label}</b></div>
  </div>`;
}


// ----- 共通パーツ -----
const MODE_NAME = {quick:'翻符→点', fu:'符計算', full:'手牌→点'};
const genQ = mode => mode === 'quick' ? genQuick() : mode === 'fu' ? genFu() : genFull();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function questionCard(q){
  if(q.kind === 'quick'){
    return `<section class="card">
      <div class="chips">
        <span class="chip ${q.oya ? 'oya' : ''}">${q.oya ? '親' : '子'}</span>
        <span class="chip agari">${q.tsumo ? 'ツモ' : 'ロン'}</span>
      </div>
      <div class="bigq"><span>${q.han}<small>翻</small></span>${q.han < 5 ? `<span>${q.fu}<small>符</small></span>` : ''}</div>
      ${q.han >= 5 ? '<div class="bigsub">5翻以上は符に関係なく決まる</div>' : ''}
      <div class="ask"><b>${q.oya ? '親' : '子'}の${q.tsumo ? 'ツモ' : 'ロン'}</b>和了。点数は？</div>
    </section>`;
  }
  return `<section class="card">
    ${condChips(q.h)}
    ${handHTML(q.h)}
    <div class="ask">${q.kind === 'fu' ? '<b>何符？</b>（切り上げ後）' : '<b>点数は？</b>'}</div>
  </section>`;
}
function choicesHTML(q){
  return `<div class="choices" id="choices">${q.choices.map((c, i) =>
    `<button class="choice" data-i="${i}">${c}${q.kind === 'fu' ? '<small>符</small>' : ''}</button>`).join('')}</div>`;
}
function explainHTML(q){
  return q.kind === 'quick' ? `<div class="exp">${calcHTML(q.han, q.fu, q.oya, q.tsumo)}</div>` : handExplain(q.h, q.kind === 'full');
}
function tableHTML(oya){
  const rows = FU_LIST.map(fu => {
    const cells = [1,2,3,4].map(han => {
      const ronOK = !(fu === 20 || (fu === 25 && han < 2));
      const tsuOK = !((fu === 20 && han < 2) || (fu === 25 && han < 3));
      if(!ronOK && !tsuOK) return '<td class="na">—</td>';
      if(limitName(han, fu)) return `<td class="lim"><span class="r">満貫</span></td>`;
      const r = ronOK ? payment(han, fu, oya, false).label : '—';
      const t = tsuOK ? payment(han, fu, oya, true).label : '—';
      return `<td><span class="r">${r}</span><span class="t">${t}</span></td>`;
    }).join('');
    return `<tr><th>${fu}符</th>${cells}</tr>`;
  }).join('');
  const limits = [['満貫','5翻',5],['跳満','6-7翻',6],['倍満','8-10翻',8],['三倍満','11-12翻',11],['数え役満','13翻〜',13]].map(([n, h, han]) =>
    `<tr><th>${n}</th><td>${h}</td><td><span class="r">${payment(han, 30, oya, false).label}</span></td><td><span class="r">${payment(han, 30, oya, true).label}</span></td></tr>`).join('');
  return `<div class="stack">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="seg"><button data-oya="0" aria-pressed="${!oya}">子</button><button data-oya="1" aria-pressed="${oya}">親</button></div>
      <span class="note">上：ロン　下：ツモ</span>
    </div>
    <div class="tblwrap"><table><thead><tr><th></th><th>1翻</th><th>2翻</th><th>3翻</th><th>4翻</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="tblwrap"><table><thead><tr><th></th><th>翻数</th><th>ロン</th><th>ツモ</th></tr></thead><tbody>${limits}</tbody></table></div>
    <p class="note">基本点 = 符 × 2<sup>(翻+2)</sup>。子ロンは×4、親ロンは×6、ツモは子が×1・親が×2を各自払い（100点未満切り上げ）。基本点が2000を超えたら満貫。</p>
  </div>`;
}
