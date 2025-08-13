window.CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  gravityY: 1700,
  speed: -300,

  // Spawn intervals (ms)
  spawn: { 
    donutMs: 1200,  // time between donut spawns
    cactusMs: 1600  // time between cactus spawns
  },

  audio: {
    initialVolume: 0.4,
    sfxBoost: 0.2,
    storageVolKey: 'marichibi_vol',
    storageMuteKey: 'marichibi_mute'
  },

  assets: {
    player: 'assets/marichibi.png',
    midbg: 'assets/mid-bg.png',
    ground: 'assets/ground_sidewalk_tile.png',
    donut: 'assets/donut.png',
    cactus: 'assets/cactus.png',
    bgm: ['assets/bgm.ogg', 'assets/bgm.mp3'],
    ding: ['assets/ding.ogg', 'assets/ding.mp3']
  },

  // Slightly larger donuts for easier mobile pickup
  donut: { size: 68 },

  // Cactus hitbox now respects downward offset for fairness
  cactus: { 
    w: 64,
    h: 80,
    bodyWScale: 0.55,
    bodyHScale: 0.70,
    bodyYOffsetScale: 0.10 // 10% downshift of collider
  },

  lanes: { 
    topMinPx: 64,
    topMinFrac: 0.18,
    maxAirAboveFloor: 220,
    floorInset: 8
  }
};

