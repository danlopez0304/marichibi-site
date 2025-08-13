// prevent page scroll on Space
window.addEventListener('keydown', e => { if (e.code === 'Space') e.preventDefault(); }, { passive: false });

// ----------------- CONFIG -----------------
const DEFAULTS = {
  WIDTH: 960, HEIGHT: 540, gravityY: 1700, speed: -300,
  spawn:{ donutMs:1000, cactusMs:1300 },
  audio:{ initialVolume:0.4, sfxBoost:0.2, storageVolKey:'marichibi_vol', storageMuteKey:'marichibi_mute' },
  assets:{ player:'marichibi.png', midbg:'mid-bg.png', ground:'ground_sidewalk_tile.png', donut:'donut.png', cactus:'cactus.png', bgm:['bgm.ogg','bgm.mp3'], ding:['ding.ogg','ding.mp3'] },
  donut:{ size:64 },
  cactus:{ w:64, h:80, bodyWScale:0.6, bodyHScale:0.9 },
  lanes:{ topMinPx:64, topMinFrac:0.18, maxAirAboveFloor:220, floorInset:8 }
};
const C = window.CONFIG || DEFAULTS;
const W = C.WIDTH, H = C.HEIGHT;
const SCORE_PER_DONUT = 1;

// ----------------- PHASER BOOT -----------------
const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: W, height: H,
  backgroundColor: '#fff8f0',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default:'arcade', arcade:{ gravity:{ y:C.gravityY }, debug:false }},
  scene: { preload, create, update, shutdown:onShutdown, destroy:onShutdown }
};
// guard against multiple games
if (window.__MARICHIBI_GAME__) { try { window.__MARICHIBI_GAME__.destroy(true); } catch(_){} }
window.__MARICHIBI_GAME__ = new Phaser.Game(phaserConfig);

// ----------------- STATE -----------------
let sceneRef, mid1, mid2, ground, floor, player, donuts, hazards, collectEmitter;
let keySpace, keyDown, keyS, keyDebug;
let music, sfxDing;
let score=0, paused=false, over=false, duck=false;
let donutTimer=null, cactusTimer=null, donutLoaded=false;

// UI refs
const elScore = document.getElementById('score');
const elVol   = document.getElementById('vol');
const elPass  = document.getElementById('test-pass');
const elTotal = document.getElementById('test-total');

// ----------------- HELPERS -----------------
function makeTexture(s,key,draw,w=64,h=64){ const g=s.make.graphics({x:0,y:0,add:false}); draw(g); g.generateTexture(key,w,h); g.destroy(); }
function mkTexIfMissing(s,key,draw,w,h){ if(!s.textures.exists(key)) makeTexture(s,key,draw,w,h); }
function playDingFallback(freq=1500,vol=0.24,dur=0.12){
  try{ const ctx=new (window.AudioContext||window.webkitAudioContext)(); const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.value=freq; g.gain.setValueAtTime(0.0001,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol,ctx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+dur+0.02);
  }catch(_){}
}
function floorTopY(){ return floor.y - floor.height/2; }
function groundYFor(h){ return floorTopY() - (h/2) + 4; }
function setScore(v){ elScore && (elScore.innerText = String(v)); }

// ----------------- SCENE -----------------
function preload(){
  this.load.image('marichibi', C.assets.player);
  this.load.image('midbg', C.assets.midbg);
  this.load.image('ground', C.assets.ground);

  this.load.on('loaderror', f => { if (f.key === 'donut') donutLoaded = false; });
  this.load.on('filecomplete-image-donut', ()=>{ donutLoaded = true; });
  this.load.image('donut', C.assets.donut);
  this.load.image('cactus', C.assets.cactus);

  makeTexture(this,'sprinkle',g=>{ g.fillStyle(0xffffff,1); g.fillRect(0,0,2,6); },2,6);

  if (C.assets.bgm)  this.load.audio('bgm', C.assets.bgm);
  if (C.assets.ding) this.load.audio('ding', C.assets.ding);
}

function create(){
  sceneRef=this;

  // toggle physics debug with "D"
  keyDebug = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  keyDebug.on('down', ()=>{
    const world=this.physics.world;
    world.drawDebug = !world.drawDebug;
    if(!world.debugGraphic) world.createDebugGraphic();
    world.debugGraphic.clear().setVisible(world.drawDebug);
    // Show debug for all bodies
    hazards.children.iterate(h=>{ if(h && h.body) h.body.debugShowBody = world.drawDebug; });
    player.body.debugShowBody = world.drawDebug;
  });

  // fallbacks if images missing
  if (!donutLoaded){
    makeTexture(this,'donut',g=>{
      g.fillStyle(0xf2c94c,1); g.fillCircle(32,32,24);
      g.fillStyle(0xff7ab6,1); g.fillCircle(32,32,20);
      g.fillStyle(0xfff8f0,1); g.fillCircle(32,32,10);
    },64,64);
  }
  mkTexIfMissing(this,'midbg', g=>{
    g.fillStyle(0xfffbf3,1); g.fillRect(0,0,960,540);
    g.fillStyle(0xe9d8ff,1); for(let x=0;x<960;x+=120) g.fillCircle(x+60,400,120);
  },960,540);
  mkTexIfMissing(this,'ground', g=>{
    g.fillStyle(0xf7e7c6,1); g.fillRect(0,0,256,64);
    for(let x=8;x<256;x+=32) g.fillRect(x,44,16,6);
  },256,64);

  // background + ground
  mid1=this.add.image(0,0,'midbg').setOrigin(0,0).setDepth(0);
  mid2=this.add.image(W,0,'midbg').setOrigin(0,0).setDepth(0);
  mid1.setDisplaySize(W,H); mid2.setDisplaySize(W,H);
  ground=this.add.tileSprite(0, H-64, W*2, 64, 'ground').setOrigin(0,0).setDepth(1);

  // floor collider
  const FLOOR_Y = H - 77;
  floor=this.add.rectangle(W/2, FLOOR_Y+12, W*2, 24, 0, 0);
  this.physics.add.existing(floor, true);

  // player (slightly bigger hitbox)
  player=this.physics.add.sprite(170, FLOOR_Y-58, 'marichibi')
    .setDisplaySize(96,96).setCollideWorldBounds(true).setDepth(2);
  player.body.setSize(68,80).setOffset(14,8);
  player.body.enable = true;

  // groups
  donuts  = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, allowGravity:false });
  hazards = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, allowGravity:false });

  // collisions
  this.physics.add.collider(player, floor);
  this.physics.add.overlap(player, donuts,  collect, null, this); // donuts = overlap
  this.physics.add.collider(player, hazards, hit,   null, this);   // 👈 cactus = collider -> Game Over on touch

  // sprinkles
  collectEmitter = this.add.particles('sprinkle').createEmitter({
    on:false, speed:{min:120,max:320}, angle:{min:0,max:360}, gravityY:700,
    lifespan:{min:450,max:900}, rotate:{min:0,max:360}, scale:{start:1,end:0.2},
    tint:[0xff7ab6,0xf2c94c,0x7bdff2,0xab3cfc,0xfff8f0], quantity:1
  });

  // input
  keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  keyDown  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
  keyS     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  this.input.keyboard.on('keydown-UP', ()=>jump());
  this.input.on('pointerdown', p=>{
    const h=this.scale.gameSize.height;
    if (p.downY>h*0.65) setDuck(true); else jump();
  });
  this.input.on('pointerup', ()=>setDuck(false));

  // audio
  const savedVol = parseFloat(localStorage.getItem(C.audio.storageVolKey) ?? C.audio.initialVolume);
  elVol && (elVol.value = String(savedVol));
  const savedMute = localStorage.getItem(C.audio.storageMuteKey) === '1';

  try { music?.stop(); music?.destroy(); } catch(_){}
  if (this.cache.audio.exists('bgm'))  music  = this.sound.add('bgm', { loop:true, volume:savedVol });
  if (this.cache.audio.exists('ding')) sfxDing = this.sound.add('ding', { volume: Math.min(1, savedVol + C.audio.sfxBoost) });

  this.sound.mute = savedMute; music?.setMute(savedMute); sfxDing?.setMute(savedMute);
  const startMusic = () => { if (music && !music.isPlaying) music.play(); };
  if (this.sound.locked) this.sound.once('unlocked', startMusic); else startMusic();

  // buttons (bind once per page)
  if (!window.__MARICHIBI_UI_BOUND__) {
    document.getElementById('btn-pause')?.addEventListener('click', onTogglePause);
    document.getElementById('btn-restart')?.addEventListener('click', restart);
    document.getElementById('btn-tests')?.addEventListener('click', runTests);
    document.getElementById('btn-full')?.addEventListener('click', ()=>{
      const btn=document.getElementById('btn-full');
      if(!this.scale.isFullscreen){ this.scale.startFullscreen(); if(btn) btn.innerText='Exit Fullscreen'; }
      else { this.scale.stopFullscreen(); if(btn) btn.innerText='Fullscreen'; }
    });
    document.getElementById('btn-mute')?.addEventListener('click', ()=>{
      const m=!this.sound.mute; this.sound.mute=m; music?.setMute(m); sfxDing?.setMute(m);
      const btn=document.getElementById('btn-mute'); if(btn) btn.innerText=m?'Unmute':'Mute';
      localStorage.setItem(C.audio.storageMuteKey, m?'1':'0');
    });
    elVol?.addEventListener('input', e=>{
      const v=parseFloat(e.target.value)||0; music?.setVolume(v); sfxDing?.setVolume(Math.min(1, v + C.audio.sfxBoost));
      localStorage.setItem(C.audio.storageVolKey, v.toString());
    });
    window.__MARICHIBI_UI_BOUND__ = true;
  }

  // gravity scaling
  const hNow=this.scale.gameSize.height;
  this.physics.world.gravity.y = C.gravityY * (hNow / C.HEIGHT);

  // init
  score=0; setScore(score); paused=false; over=false;

  // timed spawns
  donutTimer?.remove(); cactusTimer?.remove();
  donutTimer = this.time.addEvent({ delay:C.spawn.donutMs,  loop:true, callback:spawnDonut,  callbackScope:this });
  cactusTimer= this.time.addEvent({ delay:C.spawn.cactusMs, loop:true, callback:spawnCactus, callbackScope:this });
}

function update(_t, dt){
  if (paused || over) return;

  setDuck(keyDown?.isDown || keyS?.isDown);
  if (keySpace && Phaser.Input.Keyboard.JustDown(keySpace)) jump();

  const dx = (C.speed * dt)/1000 * 0.35;
  mid1.x += dx; mid2.x += dx;
  if (mid1.x <= -W) mid1.x = mid2.x + W;
  if (mid2.x <= -W) mid2.x = mid1.x + W;
  ground.tilePositionX += (-C.speed * dt)/1000;

  // Debug: log all hazards and their physics bodies every frame
  const hazardList = [];
  hazards.children.iterate(h=>{
    if(h) hazardList.push({ x: h.x, y: h.y, body: h.body, active: h.active });
    if(h && h.x < -80 && !Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), h.getBounds())) h.destroy();
  });
  if (hazardList.length) console.log('Hazards:', hazardList);
  donuts.children.iterate(d=>{ if(d && d.x < -80) d.destroy(); });
}

// ----------------- GAMEPLAY -----------------
function onTogglePause(){
  const btn=document.getElementById('btn-pause');
  paused=!paused;
  sceneRef.physics.world.isPaused=paused;
  paused ? music?.pause() : music?.resume();
  if (donutTimer) donutTimer.paused = paused;
  if (cactusTimer) cactusTimer.paused = paused;
  if (btn) btn.innerText = paused ? 'Resume' : 'Pause';
}

function setDuck(v){
  v=!!v; if(duck===v) return; duck=v;
  if(duck){ player.body.setSize(68,54).setOffset(14,34); }
  else    { player.body.setSize(68,80).setOffset(14, 8); }
}

function jump(){
  if (over || paused || duck) return;
  const factor = sceneRef.scale.gameSize.height / C.HEIGHT;
  player.setVelocityY(-1100 * factor);
}

function laneYFor(h){
  const ft = floorTopY();
  const low  = ft - (h/2 ?? C.lanes.floorInset);
  const topMin = Math.max(C.lanes.topMinPx, sceneRef.scale.gameSize.height*C.lanes.topMinFrac);
  const high = Math.max(topMin, ft - C.lanes.maxAirAboveFloor);
  const mid  = Math.round((low + high)/2);
  return [low, mid, high][(Math.random()*3)|0];
}
function cactusLaneY(){
  const ft = floorTopY();
  const gh = C.cactus.h;

  // low = on the ground (flush to floor)
  const low = groundYFor(gh);

  // top is clamped so cactus stays visible
  const topMin = Math.max(C.lanes.topMinPx, sceneRef.scale.gameSize.height * C.lanes.topMinFrac);
  const high   = Math.max(topMin, ft - C.lanes.maxAirAboveFloor);

  // mid = halfway
  const mid = Math.round((low + high) / 2);

  // pick one at random (low/mid/high)
  return [low, mid, high][(Math.random() * 3) | 0];
}

function spawnDonut(){
  const y = laneYFor(C.donut.size);
  const o = sceneRef.physics.add.image(W+40, y, 'donut').setDepth(2);
  donuts.add(o);

  // visual size
  o.setDisplaySize(C.donut.size, C.donut.size);

  // RECTANGLE body (98% of display), centered
  const bw = Math.floor(o.width  * 0.98);
  const bh = Math.floor(o.height * 0.98);
  o.body.setSize(bw, bh);
  o.body.setOffset(Math.floor((o.width - bw)/2), Math.floor((o.height - bh)/2));

  o.body.setAllowGravity(false);
  o.setVelocityX(C.speed);
  o.body.enable = true;
}

function spawnCactus(){
  const y = cactusLaneY(); // now uses low/mid/top lanes
  const c = sceneRef.physics.add.sprite(W + 50, y, 'cactus').setDepth(2);
  hazards.add(c);

  c.setDisplaySize(C.cactus.w, C.cactus.h);
  // trunk collider from DISPLAY size, centered + immovable
  const dw = c.displayWidth, dh = c.displayHeight;
  const bw = Math.floor(dw * C.cactus.bodyWScale);
  const bh = Math.floor(dh * C.cactus.bodyHScale);
  c.body.setSize(bw, bh);
  c.body.setOffset(Math.floor((dw - bw)/2), Math.floor((dh - bh)/2));
  c.setImmovable(true);
  c.body.enable = true;
  c.body.setAllowGravity(false);
  c.setVelocityX(C.speed);
}

// ----------------- CALLBACKS -----------------
function collect(_p, donut){
  if(!donut || !donut.active || !donut.body || !donut.body.enable || donut._collected) return;
  donut._collected = true;

  const x=donut.x, y=donut.y;
  try { donut.disableBody(true,true); } catch(_) { donut.destroy(); }

  score += SCORE_PER_DONUT; setScore(score);
  try { collectEmitter?.explode(28, x, y); } catch(_){}
  sceneRef.cameras.main.shake(60, 0.002);

  if (!sceneRef.sound.mute){
    if (sfxDing){ try{ sfxDing.stop(); sfxDing.play(); }catch(_){ playDingFallback(); } }
    else playDingFallback();
  }
}

function hit(_p, hazard){
  if (over) return;
  over = true;
  // Do NOT disable hazard body immediately, let overlap finish
  music?.stop();

  sceneRef.cameras.main.shake(200, 0.004);
  player.setTint(0xff6b6b);
  sceneRef.add.text(W/2, H/2 - 24, 'Game Over', { fontFamily:'system-ui, sans-serif', fontSize:'48px', color:'#ab3cfc' }).setOrigin(0.5);
  sceneRef.add.text(W/2, H/2 + 14, 'Tap / Space to restart', { fontFamily:'system-ui, sans-serif', fontSize:'18px', color:'#4b2e83' }).setOrigin(0.5);

  sceneRef.input.once('pointerdown', restart);
  sceneRef.input.keyboard.once('keydown', restart);
}

function restart(){
  try { donutTimer?.remove(); cactusTimer?.remove(); } catch(_){}
  donutTimer = cactusTimer = null;
  music?.stop();
  paused=false; over=false;
  sceneRef.scene.restart();
}

// ----------------- TESTS (optional) -----------------
function setTC(p,t){ elPass && (elPass.innerText=p); elTotal && (elTotal.innerText=t); }
async function runTests(){
  let pass=0,total=0; const T=(n,f)=>{ total++; let ok=false; try{ ok=!!f(); }catch(e){ ok=false; } if(ok) pass++; console.log('[TEST]',n,ok?'PASS':'FAIL'); };
  T('PhaserLoaded',()=>!!window.Phaser);
  T('GameBooted',()=>!!sceneRef&&!!player);
  T('DonutSpawns',()=>{ const b=donuts.getChildren().length; spawnDonut(); return donuts.getChildren().length===b+1; });
  T('CactusSpawns',()=>{ const b=hazards.getChildren().length; spawnCactus(); return hazards.getChildren().length===b+1; });
  setTC(pass,total);
}

// ----------------- CLEANUP -----------------
function onShutdown(){
  try { donutTimer?.remove(); cactusTimer?.remove(); } catch(_){}
  donutTimer = cactusTimer = null;
  try { music && music.stop(); } catch(_){}
  music = null; sfxDing = null;
}
