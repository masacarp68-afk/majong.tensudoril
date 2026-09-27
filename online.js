// ===== Firebase（匿名ログイン + Realtime Database）=====
// rankings/ta/{mode}/{uid}   : タイムアタック自己ベスト {name, time(ms), correct, at}
// rankings/correct/{uid}     : 累計正解数 {name, count}
// rooms/{code}               : 対戦部屋
const Online = (() => {
  const cfg = window.FIREBASE_CONFIG;
  const enabled = !!(cfg && cfg.apiKey && cfg.databaseURL && window.firebase);
  let db = null, uid = null, offset = 0, ready = Promise.reject(new Error('オンライン機能が未設定です'));
  ready.catch(() => {});
  if(enabled){
    firebase.initializeApp(cfg);
    db = firebase.database();
    ready = firebase.auth().signInAnonymously().then(c => (uid = c.user.uid));
    ready.catch(() => {});
    db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
  }
  const TS = () => firebase.database.ServerValue.TIMESTAMP;
  const list = snap => { const a = []; snap.forEach(c => { a.push({uid: c.key, ...c.val()}); }); return a; };

  async function addCorrect(name){
    if(!enabled || !name) return;
    await ready;
    await db.ref('rankings/correct/' + uid).transaction(v => ({name, count: ((v && v.count) || 0) + 1}));
  }
  // 自己ベスト更新時だけ書く。更新したら true
  async function submitTA(mode, name, time, correct){
    await ready;
    let improved = false;
    await db.ref(`rankings/ta/${mode}/${uid}`).transaction(v => {
      if(v && v.time <= time){ improved = false; if(v.name !== name) return {...v, name}; return; }
      improved = true;
      return {name, time, correct, at: Date.now()};
    });
    return improved;
  }
  async function topTA(mode){
    await ready;
    return list(await db.ref(`rankings/ta/${mode}`).orderByChild('time').limitToFirst(20).once('value'));
  }
  async function topCorrect(){
    await ready;
    return list(await db.ref('rankings/correct').orderByChild('count').limitToLast(20).once('value')).reverse();
  }

  // ----- 対戦部屋 -----
  async function createRoom(name, mode, total){
    await ready;
    for(let i = 0; i < 15; i++){
      const code = String(1000 + Math.floor(Math.random() * 9000));
      const r = await db.ref('rooms/' + code).transaction(v => {
        if(v && v.createdAt > Date.now() - 6 * 3600e3) return;   // 使用中（6時間以内）
        return {host: uid, status: 'lobby', mode, total, qIndex: -1, createdAt: Date.now()};
      });
      if(r.committed){ await joinRoom(code, name); return code; }
    }
    throw new Error('部屋を作れませんでした。もう一度試してください');
  }
  async function joinRoom(code, name){
    await ready;
    const snap = await db.ref('rooms/' + code).once('value');
    if(!snap.exists()) throw new Error('部屋 ' + code + ' が見つかりません');
    const p = db.ref(`rooms/${code}/players/${uid}`);
    const cur = snap.child('players/' + uid).val();
    await p.set({name, score: cur ? cur.score || 0 : 0, joinedAt: TS()});
    p.onDisconnect().remove();
    return code;
  }
  function watchRoom(code, cb){
    const ref = db.ref('rooms/' + code);
    const h = ref.on('value', s => cb(s.val()));
    return () => ref.off('value', h);
  }
  function leaveRoom(code){
    const p = db.ref(`rooms/${code}/players/${uid}`);
    p.onDisconnect().cancel();
    return p.remove();
  }
  const room = code => db.ref('rooms/' + code);

  return {enabled, ready: () => ready, uid: () => uid, now: () => Date.now() + offset, TS,
          addCorrect, submitTA, topTA, topCorrect, createRoom, joinRoom, watchRoom, leaveRoom, room};
})();
