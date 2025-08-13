window.CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  gravityY: 1700,
  speed: -300,
  spawn: { donutMs: 1200, cactusMs: 1600 },
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
  bgm: ['assets/bgm.ogg','assets/bgm.mp3'],
  ding: ['assets/ding.ogg','assets/ding.mp3']
},
  donut: { size: 64 },
  cactus: { w: 64, h: 80, bodyWScale: 0.6, bodyHScale: 0.9, bodyYOffsetScale: 0.1 },
  lanes: { topMinPx: 64, topMinFrac: 0.18, maxAirAboveFloor: 220, floorInset: 8 }
};
