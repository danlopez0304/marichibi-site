// Prevent page scroll on Space (desktop)
window.addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
}, { passive: false });

window.CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,

  colors: { background: '#fff8f0' },

  physics: { gravityYBase: 1700 },

  gameplay: {
    initialSpawnMs: 1000,
    speedX: -300,
    difficulty: {
      maxSpeedX: -500,
      speedGainPerSec: 8,
      minSpawnMs: 800,
      spawnReducePerSec: 15
    }
  },

  storage: {
    volKey:  'marichibi_vol',
    muteKey: 'marichibi_mute',
    bestKey: 'marichibi_best'
  },

  assets: {
    // Provide whichever of these exist in /assets (at least one!)
    midbg_png: 'assets/mid-bg.png',   // landscape
    midbg_jpg: 'assets/mid-bg.jpg',   // alt landscape
    // midbg_shadow_jpg is optional; only if you actually have it
    // midbg_shadow_jpg: 'assets/mid-bg-shadow.jpg',

    // Prefer lowercase to avoid case-sensitive hosting issues
    player: 'assets/marichibi.png',   // if your file is PNG uppercase, either rename it or keep game.js fallback
    ground: 'assets/ground_sidewalk_tile.png',
    donut:  'assets/donut.png',
    cactus: 'assets/cactus.png',

    bgm:  ['assets/bgm.ogg',  'assets/bgm.mp3'],
    ding: ['assets/ding.ogg', 'assets/ding.mp3']
  },

  ui: {
    rootId: 'game-root',
    ids: {
      pause:   'btn-pause',
      restart: 'btn-restart',
      full:    'btn-full',
      mute:    'btn-mute',
      vol:     'vol',
      score:   'score'
    }
  }
};



