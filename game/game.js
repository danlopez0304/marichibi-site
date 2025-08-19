(() => {
  const W = CONFIG.WIDTH, H = CONFIG.HEIGHT;

  // --- Create Phaser with responsive scaling (no CSS transforms) ---
  const phaserConfig = {
    type: Phaser.AUTO,
    parent: CONFIG.ui.rootId,
    width: W,                   // logical world size
    height: H,
    backgroundColor: CONFIG.colors.background,
    scale: {
      mode: Phaser.Scale.FIT,   // <-- key change: let Phaser fit to parent
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: CONFIG.physics.gravityYBase }, debug: false }
    },
    scene: { preload, create, update }
  };

  const game = new Phaser.Game(phaserConfig);

  // --- State ---
  let sceneRef, player, ground, floor, obstacles, cacti, space, music, sfxDing,
      score = 0, best = 0, lastSpawn = 0, spawnMs = CONFIG.gameplay.initialSpawnMs,
      speed = CONFIG.gameplay.speedX, running = true, over = false,
      duck = false, keyDown = null, keyS = null, collectEmitter = null, donutLoaded = false,
      gameOverText = null, startAtMs = 0, fitBg = null;

  // --- Helpers ---
  function makeTexture(s, key, draw, w = 64, h = 64) {
    const g = s.make.graphics({ x: 0, y: 0, add: false });
    draw(g); g.generateTexture(key, w, h); g.destroy();
  }

  // --- Scene methods ---
  function preload() {
    // Backgrounds (any that exist)
    this.load.image('midbg_png', CONFIG.assets.midbg_png);
    this.load.image('midbg_jpg', CONFIG.assets.midbg_jpg);
    this.load.image('midbg_shadow_jpg', CONFIG.assets.midbg_shadow_jpg);

    this.load.on('loaderror', (file) => console.warn('Load error:', file?.src || file));

    // Core assets
    this.load.image('marichibi', CONFIG.assets.player);
    this.load.image('ground', CONFIG.assets.ground);
    this.load.image('cactus', CONFIG.assets.cactus);

    // Donut may fail to load; if so we generate a fallback
    this.load.on('filecomplete-image-donut', () => { donutLoaded = true; });
    this.load.image('donut', CONFIG.assets.donut);

    makeTexture(this, 'spark', g => { g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4); }, 8, 8);

    this.load.audio('bgm', CONFIG.assets.bgm);
    this.load.audio('ding', CONFIG.assets.ding);

    // Fallback if host is case-sensitive and player is .png not .PNG
    this.load.on('loaderror', (file) => {
      if (file?.key === 'marichibi' && CONFIG.assets.player.endsWith('.PNG')) {
        const alt = CONFIG.assets.player.replace('.PNG', '.png');
        if (!this.textures.exists('marichibi')) this.load.image('marichibi', alt);
      }
    });
  }

  function create() {
    sceneRef = this;

    // Background (fit to logical 960×540; Phaser will scale canvas to device)
    const bgKey =
      (this.textures.exists('midbg_png') && 'midbg_png') ||
      (this.textures.exists('midbg_jpg') && 'midbg_jpg') ||
      (this.textures.exists('midbg_shadow_jpg') && 'midbg_shadow_jpg');

    if (!donutLoaded) {
      makeTexture(this, 'donut', g => {
        g.fillStyle(0xf2c94c, 1); g.fillCircle(32, 32, 24);
        g.fillStyle(0xff7ab6, 1); g.fillCircle(32, 32, 20);
        g.fillStyle(0xfff8f0, 1); g.fillCircle(32, 32, 10);
      }, 64, 64);
    }

    if (!bgKey) {
      console.warn('No background found — drawing a fallback color.');
      this.add.rectangle(W/2, H/2, W, H, 0xfff8f0).setDepth(-10);
    } else {
      const bg = this.add.image(W/2, H, bgKey).setOrigin(0.5, 1).setScrollFactor(0).setDepth(0);
      const camW = W, camH = H;
      const fit = () => {
        const scaleX = camW / bg.width;
        const scaleY = camH / bg.height;
        bg.setScale(Math.max(scaleX, scaleY)).setPosition(W/2, H);
      };
      fitBg = fit; fit();
    }

    // Ground visuals (scrolling)
    const GROUND_H = 64;
    ground = this.add.tileSprite(0, H - GROUND_H, W * 2, GROUND_H, 'ground').setOrigin(0, 0).setDepth(1);

    // Invisible floor collider
    const FLOOR_Y = H - 77;
    const FLOOR_THICKNESS = 24;
    floor = this.add.rectangle(W / 2, FLOOR_Y + FLOOR_THICKNESS / 2, W * 2, FLOOR_THICKNESS, 0x000000, 0);
    this.physics.add.existing(floor, true);

    // Player
    player = this.physics.add.sprite(170, FLOOR_Y - 58, 'marichibi')
      .setDisplaySize(96, 96).setCollideWorldBounds(true).setDepth(2);
    player.body.setSize(52, 62).setOffset(22, 20);

    // Groups
    obstacles = this.physics.add.group();  // donuts (collect)
    cacti = this.physics.add.group();      // cactus (hazard)

    // Collisions / overlaps
    this.physics.add.collider(player, floor);
    this.physics.add.overlap(player, obstacles, collect, null, this);
    this.physics.add.overlap(player, cacti, crash, null, this);

    // Tick once to settle bodies
    this.physics.world.step(16);

    // Particles for collect
    collectEmitter = this.add.particles('spark').createEmitter({
      on: false, speed: { min: -200, max: 200 }, lifespan: 420, scale: { start: 0.9, end: 0 }, blendMode: 'ADD'
    });

    // Input
    space = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    keyDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.input.keyboard.on('keydown-UP', () => jump());

    // Tap bottom to duck, else jump — works with FIT scaling
    this.input.on('pointerdown', p => {
      const h = H; // logical height
      if (p.downY > (h * 0.65)) { setDuck(true); } else { jump(); }
    });
    this.input.on('pointerup', () => setDuck(false));

    // UI elements
    const ids = CONFIG.ui.ids;
    const pauseBtn = document.getElementById(ids.pause);
    const fullBtn  = document.getElementById(ids.full);
    const muteBtn  = document.getElementById(ids.mute);
    const vol      = document.getElementById(ids.vol);

    // High score load & show
    best = parseInt(localStorage.getItem(CONFIG.storage.bestKey) || '0', 10);
    const bestEl = document.getElementById('best'); if (bestEl) bestEl.innerText = best;

    // Audio setup & persistence
    const savedVol  = localStorage.getItem(CONFIG.storage.volKey);
    const savedMute = localStorage.getItem(CONFIG.storage.muteKey);
    if (savedVol !== null) vol.value = savedVol;

    if (!music) music = this.sound.add('bgm', { loop: true, volume: parseFloat(vol.value) });
    if (savedMute === '1') music.setMute(true);
    muteBtn.innerText = music.mute ? 'Unmute' : 'Mute';
    try { sfxDing = this.sound.add('ding', { volume: 0.9 }); } catch (e) { sfxDing = null; }

    const startAudioOnce = () => {
      try { if (sceneRef.sound.context && sceneRef.sound.context.state !== 'running') sceneRef.sound.context.resume(); } catch (e) {}
      try { if (music && !music.isPlaying) music.play(); } catch (e) {}
    };
    if (this.sound.locked) this.sound.once('unlocked', startAudioOnce);
    else { this.input.once('pointerdown', startAudioOnce); this.input.keyboard.once('keydown', startAudioOnce); }

    // Buttons
    pauseBtn.onclick = () => toggle();
    document.getElementById(ids.restart).onclick = () => restart();
    fullBtn.onclick = async () => {
      try {
        if (!document.fullscreenElement) {
          if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
          fullBtn.innerText = 'Exit Fullscreen';
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
          fullBtn.innerText = 'Fullscreen';
        }
        game.scale.refresh(); // nudge scaler after fullscreen change
      } catch (e) { console.warn('Fullscreen not allowed:', e); }
    };
    muteBtn.onclick = () => {
      const m = !music.mute; music.setMute(m);
      muteBtn.innerText = m ? 'Unmute' : 'Mute';
      localStorage.setItem(CONFIG.storage.muteKey, m ? '1' : '0');
    };
    vol.oninput = e => {
      const v = parseFloat(e.target.value); if (music) music.setVolume(v);
      localStorage.setItem(CONFIG.storage.volKey, v.toString());
    };

    // Refresh scale on orientation/resize (mobile address bar changes, etc.)
    const bump = () => game.scale.refresh();
    window.addEventListener('resize', bump, { passive: true });
    window.addEventListener('orientationchange', bump, { passive: true });
  }

  function update(t, dt) {
    // Difficulty scaling
    if (running && !over) {
      const secs = Math.max(0, (t - startAtMs) / 1000);
      const d = CONFIG.gameplay.difficulty;
      speed = Math.max(d.maxSpeedX, CONFIG.gameplay.speedX - d.speedGainPerSec * secs);
      spawnMs = Math.max(d.minSpawnMs, CONFIG.gameplay.initialSpawnMs - d.spawnReducePerSec * secs);
    }

    setDuck(keyDown.isDown || keyS.isDown);

    if (running) {
      if (space && Phaser.Input.Keyboard.JustDown(space)) jump();

      // Scroll ground (keeps motion feel)
      ground.tilePositionX += (-speed * dt) / 1000;

      setGroupSpeed(obstacles, speed);
      setGroupSpeed(cacti, speed);

      if (t - lastSpawn > spawnMs) { spawn(); lastSpawn = t; }
    }

    obstacles.children.iterate(o => { if (o && o.active && o.x < -80) o.destroy(); });
    cacti.children.iterate(o => { if (o && o.active && o.x < -80) o.destroy(); });
  }

  function setGroupSpeed(group, vx) {
    group.children.iterate(o => { if (o && o.active && o.body) o.setVelocityX(vx); });
  }

  // --- Gameplay functions ---
  function setDuck(v) {
    if (duck === v) return;
    duck = v;
    if (duck) player.body.setSize(52, 42).setOffset(22, 40);
    else      player.body.setSize(52, 62).setOffset(22, 20);
  }

  function jump() {
    if (over) { restart(); return; }
    if (!running || duck) return;
    player.setVelocityY(-1200);
    return true;
  }

  function spawn() {
    const floorTop = floor.y - floor.height / 2;
    const lowY  = floorTop - 6;           // bottom lane (near floor)
    const highY = Math.max(70, H * 0.18); // top lane
    const midY  = Math.round((lowY + highY) / 2);
    const lanes = [lowY, midY, highY];
    const y = lanes[Math.floor(Math.random() * lanes.length)];

    if (Math.random() < 0.6) {
      const d = obstacles.create(W + 40, y, 'donut').setDepth(2);
      d.setDisplaySize(64, 64); d.body.setAllowGravity(false); d.setVelocityX(speed);
      return;
    }
    const c = cacti.create(W + 40, y, 'cactus').setDepth(2);
    c.setDisplaySize(64, 80); c.body.setAllowGravity(false); c.setVelocityX(speed);
  }

  function collect(_playerRef, donut) {
    if (!donut.active) return;
    donut.disableBody(true, true);
    score += 5;
    document.getElementById(CONFIG.ui.ids.score).innerText = score;

    if (score > best) {
      best = score;
      localStorage.setItem(CONFIG.storage.bestKey, String(best));
      const bestEl = document.getElementById('best'); if (bestEl) bestEl.innerText = best;
    }

    if (collectEmitter) collectEmitter.explode(24, donut.x, donut.y);
    try {
      if (sceneRef.cache.audio.exists('ding')) {
        if (sceneRef.sound.locked) sceneRef.sound.once('unlocked', () => sceneRef.sound.play('ding', { volume: 0.9 }));
        else sceneRef.sound.play('ding', { volume: 0.9 });
      } else {
        playBeepFallback(sceneRef);
      }
    } catch (e) { playBeepFallback(sceneRef); }
  }

  function playBeepFallback(scene) {
    try {
      const ctx = scene.sound.context, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.16);
    } catch {}
  }

  function crash() {
    if (over) return;
    over = true; running = false;
    try { if (music && music.isPlaying) music.stop(); } catch {}
    sceneRef.physics.world.isPaused = true;
    try { player.setTint(0xff4d4d); } catch {}

    const centerX = W / 2;
    const centerY = H / 2;
    gameOverText = sceneRef.add.text(centerX, centerY, 'GAME OVER\nPress Space', {
      fontSize: '48px', fontFamily: 'Arial', color: '#ff4d4d', align: 'center', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10);
  }

  function restart() {
    if (gameOverText) { gameOverText.destroy(); gameOverText = null; }
    score = 0; document.getElementById(CONFIG.ui.ids.score).innerText = score;
    lastSpawn = 0; spawnMs = CONFIG.gameplay.initialSpawnMs; speed = CONFIG.gameplay.speedX;
    running = true; over = false; sceneRef.scene.restart();
  }

  function pauseGame(btn) { running = false; sceneRef.physics.world.isPaused = true; if (music) music.pause(); btn.innerText = 'Resume'; }
  function resumeGame(btn) { running = true; sceneRef.physics.world.isPaused = false; if (music) music.resume(); btn.innerText = 'Pause'; }
  function toggle() { const btn = document.getElementById(CONFIG.ui.ids.pause); if (running) pauseGame(btn); else resumeGame(btn); }
})();

