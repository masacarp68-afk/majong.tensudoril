const $ = s => document.querySelector(s);
const main = $('#main');
const MODES = ['quick','fu','full'];
const KEY = 'mj-drill-v1';
const TA_N = 10, TA_PENALTY = 5000;          // タイムアタック：10問・誤答+5秒
const QTIME = 20000, REVEAL = 4000;          // 対戦：制限20秒・正解発表4秒

// ----- 保存データ -----
const store = (() => {
  const s = {tab:'practice', sub:'quick', stats:{}, name:'', total:0, taBest:{}};
  MODES.forEach(m => s.stats[m] = {n:0, ok:0, streak:0, best:0});
  try{
    const d = JSON.parse(localStorage.getItem(KEY)) || {};
    if(d.stats) Object.assign(s.stats, d.stats);
    if(d.mode) s.sub = d.mode;                 // v1 互換
    ['tab','sub','name','total','taBest'].forEach(k => { if(d[k] != null) s[k] = d[k]; });
  }catch(e){}
  return s;
})();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(store)); }catch(e){} }
function onCorrect(){
  store.total++; save();
  Online.addCorrect(store.name).catch(() => {});
}
const fmtTime = ms => (ms / 1000).toFixed(2);
const vibrate = ms => { try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} };

// ----- 名前 -----
function nameFormHTML(label = 'ニックネーム（ランキング・対戦で表示）'){
  return `<div class="stack" style="gap:6px"><span class="lbl">${label}</span>
    <div class="field"><input class="txt" id="nm" maxlength="12" autocomplete="nickname" placeholder="例：まさ" value="${esc(store.name)}"><button class="btn" id="nmSave">決定</button></div></div>`;
}
function bindName(after){
  const b = $('#nmSave'); if(!b) return;
  b.onclick = () => {
    const v = $('#nm').value.trim().slice(0, 12);
    if(!v){ $('#nm').focus(); return; }
    store.name = v; save(); renderHeader(); after && after();
  };
}
function renderHeader(){ $('#who').textContent = store.name ? store.name : ''; }

// ----- タブ -----
function setTab(t){
  store.tab = t; save();
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $('#nextbar').hidden = true;
  $('#foot').hidden = t !== 'practice';
  clearInterval(B.tick);
  if(t === 'practice'){ if(P.answered) P.q = null; renderPractice(); }
  else if(t === 'ta') renderTA();
  else if(t === 'battle') renderBattle();
  else renderRank();
  window.scrollTo({top:0});
}
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  if(TA.phase === 'run' && b.dataset.tab !== 'ta'){ TA.phase = 'menu'; cancelAnimationFrame(TA.raf); }
  setTab(b.dataset.tab);
}));
const setupMsg = () => `<section class="card"><h2>オンライン機能は準備中</h2>
  <p class="note">firebase-config.js にFirebaseの設定を入れると、ランキングと対戦が使えるようになります。練習とタイムアタック（自己ベスト）はこのままで使えます。</p></section>`;

// ================= 練習 =================
const P = {q:null, answered:false, oya:false};
function renderPractice(){
  const s = store.stats[store.sub];
  const rate = s && s.n ? Math.round(s.ok / s.n * 100) : 0;
  const subs = [['quick','翻符→点'],['fu','符計算'],['full','手牌→点'],['table','早見表']]
    .map(([k, n]) => `<button data-sub="${k}" aria-pressed="${store.sub === k}">${n}</button>`).join('');
  let body = '';
  if(store.sub === 'table') body = tableHTML(P.oya);
  else {
    if(!P.q || P.q.kind !== store.sub){ P.q = genQ(store.sub); P.answered = false; }
    body = questionCard(P.q) + choicesHTML(P.q) + '<div id="after"></div>';
  }
  main.innerHTML = `<div class="stack">
    <div class="subtabs">${subs}</div>
    ${store.sub !== 'table' ? `<div class="stats">正解 <b>${s.ok}</b>/${s.n}（${rate}%）・連続 <b>${s.streak}</b>・最高 ${s.best}</div>` : ''}
    ${body}</div>`;
  main.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { store.sub = b.dataset.sub; save(); P.q = null; renderPractice(); $('#nextbar').hidden = true; });
  main.querySelectorAll('[data-oya]').forEach(b => b.onclick = () => { P.oya = b.dataset.oya === '1'; renderPractice(); });
  main.querySelectorAll('.choice').forEach(b => b.onclick = () => answerPractice(+b.dataset.i));
}
function markChoices(q, picked){
  const box = $('#choices'); box.classList.add('done');
  box.querySelectorAll('.choice').forEach(b => {
    const i = +b.dataset.i;
    if(q.choices[i] === q.correct) b.classList.add('ok'); else if(i === picked) b.classList.add('ng');
    b.disabled = true;
  });
}
function answerPractice(i){
  if(P.answered) return;
  P.answered = true;
  const q = P.q, ok = q.choices[i] === q.correct, s = store.stats[store.sub];
  s.n++;
  if(ok){ s.ok++; s.streak++; s.best = Math.max(s.best, s.streak); onCorrect(); } else { s.streak = 0; vibrate(40); }
  save();
  markChoices(q, i);
  $('#after').innerHTML = `<div class="stack" style="gap:10px">
    <div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? '正解！' : '不正解… 正解は ' + q.correct + (q.kind === 'fu' ? '符' : '')}</div>${explainHTML(q)}</div>`;
  const rate = Math.round(s.ok / s.n * 100);
  main.querySelector('.stats').innerHTML = `正解 <b>${s.ok}</b>/${s.n}（${rate}%）・連続 <b>${s.streak}</b>・最高 ${s.best}`;
  $('#nextbar').hidden = false;
}
$('#next').addEventListener('click', () => { P.q = null; renderPractice(); $('#nextbar').hidden = true; window.scrollTo({top:0}); });
let resetArm = false;
$('#reset').addEventListener('click', e => {
  if(!resetArm){ resetArm = true; e.target.textContent = 'もう一度押すとリセット'; setTimeout(() => { resetArm = false; e.target.textContent = '成績リセット'; }, 3000); return; }
  MODES.forEach(m => store.stats[m] = {n:0, ok:0, streak:0, best:0}); save();
  resetArm = false; e.target.textContent = '成績リセット';
  if(store.tab === 'practice') renderPractice();
});

// ================= タイムアタック =================
const TA = {mode: 'quick', phase: 'menu', qs: [], i: 0, elapsed: 0, qStart: 0, miss: 0, wrongs: [], lock: false, raf: 0, res: null};
function renderTA(){
  if(TA.phase === 'run') return renderTARun();
  if(TA.phase === 'result') return renderTAResult();
  const seg = MODES.map(m => `<button data-m="${m}" aria-pressed="${TA.mode === m}">${MODE_NAME[m]}</button>`).join('');
  const best = store.taBest[TA.mode];
  main.innerHTML = `<div class="stack">
    <section class="card">
      <h2>10問タイムアタック</h2>
      <p class="note">10問をできるだけ速く解く。<b>誤答は1問につき+5秒</b>。解説は最後にまとめて見られる。</p>
      <div class="seg full">${seg}</div>
      <div class="center note">自己ベスト：<b style="color:var(--gold);font-size:16px">${best ? fmtTime(best) + '秒' : '—'}</b></div>
    </section>
    <button class="btn" id="taStart">スタート</button>
  </div>`;
  main.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { TA.mode = b.dataset.m; renderTA(); });
  $('#taStart').onclick = startTA;
}
function startTA(){
  Object.assign(TA, {phase:'run', qs: Array.from({length: TA_N}, () => genQ(TA.mode)), i: 0, elapsed: 0, miss: 0, wrongs: [], lock: false, res: null});
  renderTARun();
  const loop = () => {
    if(TA.phase !== 'run') return;
    const el = $('#clock');
    if(el) el.textContent = fmtTime(TA.elapsed + (TA.lock ? 0 : performance.now() - TA.qStart) + TA.miss * TA_PENALTY).slice(0, -1);
    TA.raf = requestAnimationFrame(loop);
  };
  TA.raf = requestAnimationFrame(loop);
}
function renderTARun(){
  const q = TA.qs[TA.i];
  main.innerHTML = `<div class="stack">
    <div class="tabar"><span class="prog">${TA.i + 1} / ${TA_N}</span>
      <span class="pen">${TA.miss ? `ミス${TA.miss}（+${TA.miss * 5}秒）` : ''}</span>
      <span class="clock" id="clock">0.0</span></div>
    ${questionCard(q)}${choicesHTML(q)}</div>`;
  main.querySelectorAll('.choice').forEach(b => b.onclick = () => answerTA(+b.dataset.i));
  TA.qStart = performance.now(); TA.lock = false;
  window.scrollTo({top:0});
}
function answerTA(i){
  if(TA.lock) return;
  TA.lock = true;
  TA.elapsed += performance.now() - TA.qStart;          // 判定表示中は時計を止める
  const q = TA.qs[TA.i], ok = q.choices[i] === q.correct;
  if(ok) onCorrect(); else { TA.miss++; TA.wrongs.push({q, pick: q.choices[i]}); vibrate(40); }
  markChoices(q, i);
  setTimeout(() => {
    if(TA.phase !== 'run') return;
    TA.i++;
    if(TA.i >= TA_N) finishTA(); else renderTARun();
  }, ok ? 300 : 800);
}
function finishTA(){
  cancelAnimationFrame(TA.raf);
  const time = Math.round(TA.elapsed + TA.miss * TA_PENALTY);
  const prev = store.taBest[TA.mode];
  const pb = !prev || time < prev;
  if(pb){ store.taBest[TA.mode] = time; save(); }
  TA.res = {time, raw: Math.round(TA.elapsed), correct: TA_N - TA.miss, pb, sent: null};
  TA.phase = 'result';
  renderTAResult();
  submitTA();
}
function submitTA(){
  const r = TA.res;
  if(!Online.enabled || !store.name || r.sent) return;
  r.sent = 'sending';
  Online.submitTA(TA.mode, store.name, r.time, r.correct)
    .then(improved => { r.sent = improved ? 'best' : 'kept'; })
    .catch(() => { r.sent = 'error'; })
    .finally(() => { if(store.tab === 'ta' && TA.phase === 'result') renderTAResult(); });
}
function renderTAResult(){
  const r = TA.res;
  let rankMsg = '';
  if(!Online.enabled) rankMsg = '<p class="note center">オンライン未設定のため、記録はこの端末だけに保存</p>';
  else if(!store.name) rankMsg = `<section class="card">${nameFormHTML('名前を入れるとランキングに登録')}</section>`;
  else rankMsg = `<p class="note center">${{sending:'ランキングに送信中…', best:'ランキングの自己記録を更新しました', kept:'ランキングは前回の自己記録のまま', error:'送信に失敗しました（通信を確認）'}[r.sent] || ''}</p>`;
  const wrongs = TA.wrongs.map(w => {
    const title = w.q.kind === 'quick' ? `${w.q.han}翻${w.q.han < 5 ? w.q.fu + '符' : ''} ${w.q.oya ? '親' : '子'}${w.q.tsumo ? 'ツモ' : 'ロン'}` : '';
    return `<details class="card"><summary><b>${title}</b> 正解 <b style="color:var(--ok)">${w.q.correct}</b>／あなた <span style="color:var(--ng)">${w.pick}</span></summary>
      ${w.q.kind === 'quick' ? '' : condChips(w.q.h) + handHTML(w.q.h)}${explainHTML(w.q)}</details>`;
  }).join('');
  main.innerHTML = `<div class="stack">
    <section class="card">
      <div class="center lbl">${MODE_NAME[TA.mode]}　10問タイムアタック</div>
      <div class="bigtime">${fmtTime(r.time)}<small>秒</small></div>
      <div class="center">${r.pb ? '<span class="badge">自己ベスト更新！</span>' : `<span class="note">自己ベスト ${fmtTime(store.taBest[TA.mode])}秒</span>`}</div>
      <div class="center note">正解 ${r.correct}/${TA_N}　解答時間 ${fmtTime(r.raw)}秒 ＋ ペナルティ ${TA.miss * 5}秒</div>
    </section>
    ${rankMsg}
    ${wrongs ? `<span class="lbl">間違えた問題（タップで解説）</span>${wrongs}` : ''}
    <button class="btn" id="taAgain">もう一度</button>
    <button class="btn sub" id="taRank">ランキングを見る</button>
    <button class="btn sub" id="taMenu">モードを変える</button>
  </div>`;
  bindName(() => { submitTA(); renderTAResult(); });
  $('#taAgain').onclick = startTA;
  $('#taMenu').onclick = () => { TA.phase = 'menu'; renderTA(); };
  $('#taRank').onclick = () => { RK.mode = TA.mode; setTab('rank'); };
}

// ================= ランキング =================
const RK = {mode: 'quick'};
function rankRows(list, val){
  if(!list.length) return '<p class="note center">まだ記録がありません</p>';
  const me = Online.uid();
  return `<ol class="rank">${list.map((e, i) => `<li class="${e.uid === me ? 'me' : ''}"><span class="no">${i + 1}</span><span class="nm">${esc(e.name)}</span><span class="val">${val(e)}</span></li>`).join('')}</ol>`;
}
function top1(label, e, v){
  return e ? `<div class="top1"><span class="crown">${label}<br>TOP</span><span class="who">${esc(e.name)}</span><span class="v">${v}</span></div>` : '';
}
async function renderRank(){
  if(!Online.enabled){ main.innerHTML = setupMsg(); return; }
  const seg = MODES.map(m => `<button data-m="${m}" aria-pressed="${RK.mode === m}">${MODE_NAME[m]}</button>`).join('');
  main.innerHTML = `<div class="stack">
    ${store.name ? '' : `<section class="card">${nameFormHTML()}</section>`}
    <section class="card">
      <h2>解答速度（10問タイムアタック）</h2>
      <div class="seg full">${seg}</div>
      <div id="rkTA"><p class="note center">読み込み中…</p></div>
    </section>
    <section class="card">
      <h2>正解数（累計）</h2>
      <p class="note">練習・タイムアタック・対戦で正解した数の合計。あなた：<b>${store.total}</b>問</p>
      <div id="rkOK"><p class="note center">読み込み中…</p></div>
    </section>
  </div>`;
  bindName(renderRank);
  main.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { RK.mode = b.dataset.m; renderRank(); });
  const mode = RK.mode;
  try{
    const [ta, ok] = await Promise.all([Online.topTA(mode), Online.topCorrect()]);
    if(store.tab !== 'rank' || RK.mode !== mode) return;
    $('#rkTA').innerHTML = top1('最速', ta[0], ta[0] && fmtTime(ta[0].time) + '秒') + rankRows(ta, e => `${fmtTime(e.time)}<small>秒</small>`);
    $('#rkOK').innerHTML = top1('正解数', ok[0], ok[0] && ok[0].count + '問') + rankRows(ok, e => `${e.count}<small>問</small>`);
  }catch(e){
    if(store.tab === 'rank') $('#rkTA').innerHTML = $('#rkOK').innerHTML = `<p class="err">読み込めませんでした：${esc(e.message)}</p>`;
  }
}

// ================= 対戦（早押し）=================
const B = {code: null, room: null, unwatch: null, err: '', mode: 'quick', total: 10, busy: false,
           qjson: null, q: null, hostQ: -1, hostR: -1, qTimer: 0, pickTimer: 0, finished: -1, tick: 0, counted: -1};
const ROOM_KEY = 'mj-room';
function renderBattle(){
  clearInterval(B.tick);
  if(!Online.enabled){ main.innerHTML = setupMsg(); return; }
  if(!B.code) return renderBattleEntry();
  const r = B.room;
  if(!r){ main.innerHTML = '<p class="note center">接続中…</p>'; return; }
  if(r.status === 'lobby') return renderLobby(r);
  if(r.status === 'playing') return renderPlay(r);
  return renderDone(r);
}
function renderBattleEntry(){
  const seg = MODES.map(m => `<button data-m="${m}" aria-pressed="${B.mode === m}">${MODE_NAME[m]}</button>`).join('');
  const tot = [5,10,20].map(n => `<button data-n="${n}" aria-pressed="${B.total === n}">${n}問</button>`).join('');
  main.innerHTML = `<div class="stack">
    <section class="card">${nameFormHTML()}</section>
    ${B.err ? `<p class="err">${esc(B.err)}</p>` : ''}
    <section class="card">
      <h2>部屋を作る</h2>
      <p class="note">同じ問題が全員に同時に出る早押し戦。一番早く正解した人に1点。間違えるとその問題はお手つき。</p>
      <div class="seg full">${seg}</div>
      <div class="seg full">${tot}</div>
      <button class="btn" id="bCreate" ${store.name && !B.busy ? '' : 'disabled'}>部屋を作る</button>
    </section>
    <section class="card">
      <h2>部屋に入る</h2>
      <div class="field"><input class="txt code" id="bCode" inputmode="numeric" maxlength="4" placeholder="0000" autocomplete="off">
        <button class="btn" id="bJoin" ${store.name && !B.busy ? '' : 'disabled'}>入る</button></div>
    </section>
    ${store.name ? '' : '<p class="note center">先にニックネームを決めてください</p>'}
  </div>`;
  bindName(renderBattle);
  main.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { B.mode = b.dataset.m; renderBattle(); });
  main.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { B.total = +b.dataset.n; renderBattle(); });
  $('#bCreate').onclick = () => guard(async () => enterRoom(await Online.createRoom(store.name, B.mode, B.total)));
  $('#bJoin').onclick = () => {
    const code = $('#bCode').value.replace(/\D/g, '');
    if(code.length !== 4){ B.err = '4桁の部屋番号を入れてください'; renderBattle(); return; }
    guard(async () => enterRoom(await Online.joinRoom(code, store.name)));
  };
}
async function guard(fn){
  B.busy = true; B.err = ''; renderBattle();
  try{ await fn(); }catch(e){ B.err = e.message || String(e); }
  B.busy = false;
  if(store.tab === 'battle') renderBattle();
}
function enterRoom(code){
  B.code = code; B.room = null; B.hostQ = B.hostR = B.finished = B.counted = -1;
  try{ sessionStorage.setItem(ROOM_KEY, code); }catch(e){}
  B.unwatch = Online.watchRoom(code, r => {
    B.room = r;
    if(!r){ leaveRoom('部屋がなくなりました'); return; }
    hostDrive(r);
    if(store.tab === 'battle') renderBattle();
  });
}
function leaveRoom(msg){
  if(B.unwatch) B.unwatch();
  if(B.code) Online.leaveRoom(B.code).catch(() => {});
  clearTimeout(B.qTimer); clearTimeout(B.pickTimer); clearInterval(B.tick);
  Object.assign(B, {code: null, room: null, unwatch: null, err: msg || ''});
  try{ sessionStorage.removeItem(ROOM_KEY); }catch(e){}
  if(store.tab === 'battle') renderBattle();
}
const isHost = r => r && r.host === Online.uid();
const sortedPlayers = r => Object.entries(r.players || {}).map(([uid, p]) => ({uid, ...p}))
  .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.joinedAt || 0) - (b.joinedAt || 0));
function playersHTML(r, winner){
  const me = Online.uid();
  return `<div class="players">${sortedPlayers(r).map(p =>
    `<span class="pl ${p.uid === me ? 'me' : ''} ${p.uid === winner ? 'win' : ''}">${esc(p.name)}${p.uid === r.host ? '<small style="color:var(--gold);font-size:10px">HOST</small>' : ''}<b>${p.score || 0}</b></span>`).join('')}</div>`;
}
function renderLobby(r){
  B.counted = -1;
  const host = isHost(r);
  const seg = MODES.map(m => `<button data-m="${m}" aria-pressed="${r.mode === m}" ${host ? '' : 'disabled'}>${MODE_NAME[m]}</button>`).join('');
  const tot = [5,10,20].map(n => `<button data-n="${n}" aria-pressed="${r.total === n}" ${host ? '' : 'disabled'}>${n}問</button>`).join('');
  main.innerHTML = `<div class="stack">
    <section class="card">
      <div class="center lbl">部屋番号（みんなに伝えてね）</div>
      <div class="roomcode">${B.code}</div>
    </section>
    <section class="card">
      <span class="lbl">参加者 ${Object.keys(r.players || {}).length}人</span>
      ${playersHTML(r)}
      <div class="seg full">${seg}</div>
      <div class="seg full">${tot}</div>
    </section>
    ${host ? '<button class="btn" id="bStart">スタート</button>' : '<p class="status">ホストの開始を待っています…</p>'}
    <button class="btn sub" id="bLeave">退出</button>
  </div>`;
  if(host){
    main.querySelectorAll('[data-m]').forEach(b => b.onclick = () => Online.room(B.code).update({mode: b.dataset.m}));
    main.querySelectorAll('[data-n]').forEach(b => b.onclick = () => Online.room(B.code).update({total: +b.dataset.n}));
    $('#bStart').onclick = startGame;
  }
  $('#bLeave').onclick = () => leaveRoom();
}
function roomQ(r){
  if(B.qjson !== r.qjson){ B.qjson = r.qjson; B.q = r.qjson ? JSON.parse(r.qjson) : null; }
  return B.q;
}
function renderPlay(r){
  const q = roomQ(r);
  if(!q){ main.innerHTML = '<p class="status">問題を準備中…</p>'; return; }
  const me = Online.uid(), idx = r.qIndex;
  const ans = (r.answers && r.answers[idx]) || {};
  const mine = ans[me];
  const reveal = r.phase === 'reveal';
  if(mine && mine.c === q.correct && B.counted !== idx){ B.counted = idx; onCorrect(); }
  let status;
  if(reveal){
    const w = r.winner && r.players && r.players[r.winner];
    status = `<div class="status big" style="color:${r.winner === me ? 'var(--ok)' : 'var(--ink)'}">${r.winner ? (r.winner === me ? 'あなたが一番乗り！' : esc(w ? w.name : '？') + ' が正解！') : '正解者なし'}</div>`;
  } else if(mine){
    status = mine.c === q.correct ? '<div class="status">判定中…</div>' : '<div class="status" style="color:var(--ng)">お手つき！ ほかの人の解答待ち</div>';
  } else status = '<div class="status">残り <span id="bTime">--</span> 秒</div>';
  const choices = `<div class="choices ${reveal || mine ? 'done' : ''}" id="choices">${q.choices.map((c, i) => {
    let cls = '';
    if(reveal && c === q.correct) cls = 'ok';
    else if(mine && mine.c === c) cls = c === q.correct ? 'wait' : 'ng';
    return `<button class="choice ${cls}" data-i="${i}" ${reveal || mine ? 'disabled' : ''}>${c}${q.kind === 'fu' ? '<small>符</small>' : ''}</button>`;
  }).join('')}</div>`;
  main.innerHTML = `<div class="stack">
    <div class="tabar"><span class="prog">第${idx + 1}問 / ${r.total}</span><span class="note">部屋 ${B.code}</span></div>
    ${playersHTML(r, reveal ? r.winner : null)}
    ${questionCard(q)}${status}${choices}
    ${reveal && q.kind !== 'quick' ? `<div class="exp"><div class="res">${q.h.res.han}翻${q.h.res.fu}符${q.h.res.limit ? '・' + q.h.res.limit : ''}<b>${q.h.res.pay.label}</b></div></div>` : ''}
  </div>`;
  main.querySelectorAll('.choice:not([disabled])').forEach(b => b.onclick = () => {
    const c = q.choices[+b.dataset.i];
    b.classList.add('wait');
    main.querySelectorAll('.choice').forEach(x => x.disabled = true);
    Online.room(B.code).child(`answers/${idx}/${me}`).set({c, t: Online.TS()});
    if(c !== q.correct) vibrate(40);
  });
  if(!reveal && !mine){
    const upd = () => { const el = $('#bTime'); if(!el) return clearInterval(B.tick);
      el.textContent = Math.max(0, Math.ceil((QTIME - (Online.now() - (r.startAt || Online.now()))) / 1000)); };
    upd(); B.tick = setInterval(upd, 250);
  }
}
function renderDone(r){
  const ps = sortedPlayers(r), me = Online.uid();
  main.innerHTML = `<div class="stack">
    <section class="card">
      <div class="center lbl">結果（${MODE_NAME[r.mode]}・${r.total}問）</div>
      ${ps[0] ? `<div class="top1"><span class="crown">WINNER</span><span class="who">${esc(ps[0].name)}</span><span class="v">${ps[0].score || 0}点</span></div>` : ''}
      <ol class="rank">${ps.map((p, i) => `<li class="${p.uid === me ? 'me' : ''}"><span class="no">${i + 1}</span><span class="nm">${esc(p.name)}</span><span class="val">${p.score || 0}<small>点</small></span></li>`).join('')}</ol>
    </section>
    ${isHost(r) ? '<button class="btn" id="bAgain">もう一度（待合室へ）</button>' : '<p class="status">ホストの操作を待っています…</p>'}
    <button class="btn sub" id="bLeave">退出</button>
  </div>`;
  if(isHost(r)) $('#bAgain').onclick = () => {
    const upd = {status: 'lobby', qIndex: -1, qjson: null, phase: null, winner: null, answers: null};
    Object.keys(r.players || {}).forEach(u => upd[`players/${u}/score`] = 0);
    Online.room(B.code).update(upd);
  };
  $('#bLeave').onclick = () => leaveRoom();
}

// ----- ホストだけが進行を担当 -----
async function startGame(){
  const r = B.room; if(!isHost(r)) return;
  const upd = {status: 'playing', qIndex: -1, qjson: null, phase: null, winner: null, answers: null};
  Object.keys(r.players || {}).forEach(u => upd[`players/${u}/score`] = 0);
  B.hostQ = B.hostR = B.finished = -1;
  await Online.room(B.code).update(upd);
  nextQ(0);
}
async function nextQ(idx){
  const r = B.room; if(!isHost(r) || r.status !== 'playing') return;
  if(idx >= r.total){ await Online.room(B.code).update({status: 'done', phase: null}); return; }
  await Online.room(B.code).update({qIndex: idx, qjson: JSON.stringify(genQ(r.mode)), phase: 'ask', winner: null, startAt: Online.TS()});
}
function hostDrive(r){
  if(!isHost(r) || r.status !== 'playing' || r.qIndex < 0) return;
  const idx = r.qIndex;
  if(r.phase === 'ask'){
    if(B.hostQ !== idx){
      B.hostQ = idx; clearTimeout(B.qTimer);
      const left = typeof r.startAt === 'number' ? QTIME - (Online.now() - r.startAt) : QTIME;
      B.qTimer = setTimeout(() => finishQ(idx), Math.max(0, left) + 300);
    }
    const q = roomQ(r), ans = (r.answers && r.answers[idx]) || {};
    const anyOk = Object.values(ans).some(a => a.c === q.correct);
    const ids = Object.keys(r.players || {});
    const allIn = ids.length > 0 && ids.every(u => ans[u]);
    if(anyOk && !B.pickTimer) B.pickTimer = setTimeout(() => { B.pickTimer = 0; finishQ(idx); }, 500); // 通信差を少し待ってから最速を決める
    else if(allIn && !anyOk) finishQ(idx);
  } else if(r.phase === 'reveal' && B.hostR !== idx){
    B.hostR = idx;
    setTimeout(() => nextQ(idx + 1), REVEAL);
  }
}
async function finishQ(idx){
  const r = B.room;
  if(B.finished === idx || !r || r.qIndex !== idx || r.phase !== 'ask') return;
  B.finished = idx; clearTimeout(B.qTimer);
  const q = roomQ(r), ans = (r.answers && r.answers[idx]) || {};
  let win = null, best = Infinity;
  Object.entries(ans).forEach(([u, a]) => { if(a.c === q.correct && typeof a.t === 'number' && a.t < best){ best = a.t; win = u; } });
  const upd = {phase: 'reveal', winner: win};
  if(win && r.players && r.players[win]) upd[`players/${win}/score`] = (r.players[win].score || 0) + 1;
  await Online.room(B.code).update(upd);
}

// ----- 起動 -----
renderHeader();
(() => {
  let code = null; try{ code = sessionStorage.getItem(ROOM_KEY); }catch(e){}
  if(code && Online.enabled && store.name){
    Online.joinRoom(code, store.name).then(enterRoom).catch(() => { try{ sessionStorage.removeItem(ROOM_KEY); }catch(e){} });
  }
})();
setTab(store.tab);
