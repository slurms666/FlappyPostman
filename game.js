const canvas = document.getElementById("gameCanvas");
const canvasShell = document.querySelector(".canvas-shell");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const levelValue = document.getElementById("levelValue");
const bestValue = document.getElementById("bestValue");
const stateValue = document.getElementById("stateValue");
const statusIndicator = document.getElementById("statusIndicator");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const restartButton = document.getElementById("restartButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TAU = Math.PI * 2;
const GROUND_Y = 688;
const PAVEMENT_TOP = 688;
const CURB_TOP = 748;
const ROAD_TOP = 790;
const BEST_SCORE_KEY = "flappy-postman-runner-best";
const PDA_SOUND_SRC = "assets/audio/pda-found.m4a";
const BASE_SPEED = 210;
const SPEED_STEP = 18;
const MAX_SPEED = 340;
const JUMP_VELOCITY = -780;
const GRAVITY = 1900;
const JUMP_HOLD_GRAVITY = 320;
const JUMP_HOLD_WINDOW = 0.16;
const DOUBLE_JUMP_VELOCITY = -1060;
const BUS_MIN_SCORE = 8;
const BUS_CHANCE = 0.08;
const BUS_COOLDOWN_OBSTACLES = 7;
const COIN_CHANCE = 0.68;
const COIN_RADIUS = 14;
const COIN_EDGE_MARGIN = 64;
const COIN_SPACING = 42;
const COIN_MIN_HEIGHT = 96;
const COIN_MAX_HEIGHT = 232;
const COIN_HIGH_HEIGHT = 286;
const PDA_CHANCE = 0.16;
const PDA_COOLDOWN_GAPS = 5;
const PDA_WIDTH = 28;
const PDA_HEIGHT = 38;
const PDA_MIN_HEIGHT = 114;
const PDA_MAX_HEIGHT = 248;
const PDA_HIGH_HEIGHT = 302;
const TOTAL_JUMP_TIME = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;

const inputState = {
  jumpHeld: false,
};

const audioState = {
  context: null,
  masterGain: null,
  pdaSound: null,
  pdaUnlocked: false,
};

const obstacleCatalog = [
  {
    kind: "dog",
    label: "a dog",
    width: 50,
    height: 36,
    hitbox: { left: 6, right: 6, top: 6, bottom: 2 },
  },
  {
    kind: "cat",
    label: "a cat",
    width: 34,
    height: 24,
    hitbox: { left: 4, right: 4, top: 4, bottom: 2 },
  },
  {
    kind: "pram",
    label: "a pram",
    width: 60,
    height: 58,
    hitbox: { left: 6, right: 8, top: 8, bottom: 2 },
  },
  {
    kind: "pushchair",
    label: "a pushchair",
    width: 56,
    height: 54,
    hitbox: { left: 6, right: 8, top: 8, bottom: 2 },
  },
  {
    kind: "postbox",
    label: "a post box",
    width: 42,
    height: 78,
    hitbox: { left: 4, right: 4, top: 6, bottom: 2 },
  },
  {
    kind: "holly",
    label: "a holly bush",
    width: 56,
    height: 44,
    hitbox: { left: 6, right: 6, top: 6, bottom: 2 },
  },
  {
    kind: "bollard",
    label: "a bollard",
    width: 22,
    height: 48,
    hitbox: { left: 2, right: 2, top: 4, bottom: 2 },
  },
  {
    kind: "bench",
    label: "a bench",
    width: 68,
    height: 36,
    hitbox: { left: 4, right: 4, top: 6, bottom: 2 },
  },
  {
    kind: "bus",
    label: "a bus",
    width: 174,
    height: 118,
    hitbox: { left: 10, right: 10, top: 10, bottom: 8 },
  },
];

const game = {
  state: "ready",
  time: 0,
  distance: 0,
  score: 0,
  level: 1,
  best: readBestScore(),
  speed: BASE_SPEED,
  spawnTimer: 1.4,
  obstacles: [],
  coins: [],
  coinScore: 0,
  pdaScore: 0,
  particles: [],
  levelBanner: 0,
  cameraShake: 0,
  crashLabel: "a badly parked pram",
  lastObstacleKind: "",
  obstaclesSinceBus: BUS_COOLDOWN_OBSTACLES,
  gapsSincePda: PDA_COOLDOWN_GAPS,
};

let player = createPlayer();
let lastFrameTime = performance.now();

function readBestScore() {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function writeBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch (error) {
    return;
  }
}

function ensureAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioState.context) {
    const context = new AudioContextConstructor();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(context.destination);
    audioState.context = context;
    audioState.masterGain = masterGain;
  }

  if (audioState.context.state === "suspended") {
    audioState.context.resume().catch(() => {});
  }

  return audioState.context;
}

function playCoinChime() {
  const context = ensureAudioContext();

  if (!context || !audioState.masterGain || context.state !== "running") {
    return;
  }

  const start = context.currentTime;
  const partials = [
    { frequency: 1318.51, gain: 0.07, delay: 0, duration: 0.11, type: "triangle" },
    { frequency: 1760, gain: 0.045, delay: 0.04, duration: 0.09, type: "sine" },
  ];

  for (const partial of partials) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const noteStart = start + partial.delay;
    const noteEnd = noteStart + partial.duration;

    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(partial.frequency, noteStart);
    oscillator.frequency.exponentialRampToValueAtTime(partial.frequency * 1.06, noteEnd);

    gainNode.gain.setValueAtTime(0.0001, noteStart);
    gainNode.gain.exponentialRampToValueAtTime(partial.gain, noteStart + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gainNode);
    gainNode.connect(audioState.masterGain);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  }
}

function ensurePdaSound() {
  if (!audioState.pdaSound) {
    const sound = new Audio(PDA_SOUND_SRC);
    sound.preload = "auto";
    audioState.pdaSound = sound;
  }

  return audioState.pdaSound;
}

function primePdaSound() {
  const sound = ensurePdaSound();

  if (!sound || audioState.pdaUnlocked) {
    return;
  }

  const originalMuted = sound.muted;
  sound.muted = true;
  const playAttempt = sound.play();

  if (!playAttempt || typeof playAttempt.then !== "function") {
    sound.pause();
    sound.currentTime = 0;
    sound.muted = originalMuted;
    audioState.pdaUnlocked = true;
    return;
  }

  playAttempt
    .then(() => {
      sound.pause();
      sound.currentTime = 0;
      sound.muted = originalMuted;
      audioState.pdaUnlocked = true;
    })
    .catch(() => {
      sound.muted = originalMuted;
    });
}

function playPdaFoundSound() {
  const baseSound = ensurePdaSound();

  if (!baseSound) {
    return;
  }

  const sound = baseSound.paused ? baseSound : new Audio(PDA_SOUND_SRC);
  sound.currentTime = 0;
  sound.volume = 0.92;
  const playAttempt = sound.play();

  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {});
  }
}

function createPlayer() {
  return {
    x: 102,
    y: GROUND_Y,
    vy: 0,
    width: 36,
    height: 78,
    grounded: true,
    jumpBuffer: 0,
    jumpHoldTime: 0,
    doubleJumpAvailable: false,
    coyoteTimer: 0,
    stepTime: 0,
    tilt: 0,
  };
}

function setOverlay(title, message, visible) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.toggle("hidden", !visible);
}

function syncHud() {
  const isRunning = game.state === "running";
  scoreValue.textContent = String(game.score);
  levelValue.textContent = String(game.level);
  bestValue.textContent = String(game.best);
  stateValue.textContent = isRunning ? "Running" : "Stopped";
  statusIndicator.classList.toggle("is-running", isRunning);
  statusIndicator.classList.toggle("is-stopped", !isRunning);
}

function resetGame(nextState = "ready") {
  game.state = nextState;
  game.time = 0;
  game.distance = 0;
  game.score = 0;
  game.level = 1;
  game.speed = BASE_SPEED;
  game.spawnTimer = 1.4;
  game.obstacles = [];
  game.coins = [];
  game.coinScore = 0;
  game.pdaScore = 0;
  game.particles = [];
  game.levelBanner = 0;
  game.cameraShake = 0;
  game.crashLabel = "a badly parked pram";
  game.lastObstacleKind = "";
  game.obstaclesSinceBus = BUS_COOLDOWN_OBSTACLES;
  game.gapsSincePda = PDA_COOLDOWN_GAPS;
  player = createPlayer();
  game.spawnTimer = (scheduleNextObstacle() + 120) / game.speed;

  if (game.state === "ready") {
    setOverlay(
      "Flappy Postman",
      "Tap the screen or press Up to start. Carl needs to recover his lost PDAs, which appear rarely instead of coins. Hold briefly for extra lift, then tap again midair for the bus-clearing second jump.",
      true,
    );
  } else {
    setOverlay("", "", false);
  }

  syncHud();
}

function startRunning() {
  if (game.state === "running") {
    return;
  }

  if (game.state === "gameover") {
    resetGame("running");
  } else {
    game.state = "running";
    setOverlay("", "", false);
    syncHud();
  }
}

function queueJump() {
  if (game.state === "ready") {
    startRunning();
  } else if (game.state === "gameover") {
    resetGame("running");
  }

  player.jumpBuffer = 0.12;
}

function beginJumpInput() {
  ensureAudioContext();
  primePdaSound();
  inputState.jumpHeld = true;

  if (game.state === "running" && !player.grounded && player.coyoteTimer <= 0) {
    if (player.doubleJumpAvailable) {
      tryDoubleJump();
    }

    return;
  }

  queueJump();
}

function endJumpInput() {
  inputState.jumpHeld = false;
}

function restartRun() {
  resetGame("running");
}

function tryDoubleJump() {
  if (game.state !== "running") {
    return false;
  }

  if (player.grounded || !player.doubleJumpAvailable) {
    return false;
  }

  player.doubleJumpAvailable = false;
  player.jumpBuffer = 0;
  player.jumpHoldTime = JUMP_HOLD_WINDOW;
  player.vy = DOUBLE_JUMP_VELOCITY;
  game.cameraShake = Math.max(game.cameraShake, 6);
  emitBurst(player.x + 8, player.y - 42, 12, ["#fff2d1", "#9fd4f3", "#ff6d52"], 0.95);
  emitDust(player.x - 4, player.y - 2, 6);
  return true;
}

function crash(label) {
  if (game.state !== "running") {
    return;
  }

  game.state = "gameover";
  game.crashLabel = label;
  game.cameraShake = 14;
  emitBurst(player.x + 18, player.y - 40, 32, ["#fff2d1", "#ff7147", "#ffd05c"], 2.35);

  if (game.score > game.best) {
    game.best = game.score;
    writeBestScore(game.best);
  }

  setOverlay(
    "Route Wrecked",
    `You hit ${label}. Score ${game.score}. Coins ${game.coinScore}. PDAs ${game.pdaScore}. Tap or press Up to try again, and use the airborne second jump when a bus turns up.`,
    true,
  );
  syncHud();
}

function emitBurst(x, y, count, colors, speedScale) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * TAU;
    const speed = (50 + Math.random() * 180) * speedScale;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 4,
      life: 0.35 + Math.random() * 0.5,
      color: colors[index % colors.length],
      rotation: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 14,
    });
  }
}

function emitDust(x, y, amount) {
  for (let index = 0; index < amount; index += 1) {
    game.particles.push({
      x: x + (Math.random() * 2 - 1) * 10,
      y: y + (Math.random() * 2 - 1) * 4,
      vx: -40 - Math.random() * 120,
      vy: -20 - Math.random() * 60,
      size: 3 + Math.random() * 4,
      life: 0.18 + Math.random() * 0.18,
      color: "rgba(255, 240, 205, 0.8)",
      rotation: 0,
      spin: 0,
    });
  }
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function scheduleNextObstacle(template = null) {
  const jumpCover = game.speed * TOTAL_JUMP_TIME;
  let minGap = Math.max(170, jumpCover * 0.82);

  if (template) {
    minGap += template.width * 0.18;

    if (template.kind === "bus") {
      minGap += game.speed * 0.9;
    }
  }

  const maxGap = Math.max(minGap + 110, 320 + game.level * 18);
  return randomRange(minGap, maxGap);
}

function pickCoinOffsets(count) {
  const patterns =
    count === 1
      ? [[0], [14], [-14]]
      : count === 2
        ? [
            [-12, 10],
            [10, -12],
            [0, -16],
          ]
        : [
            [0, -18, 0],
            [-18, 0, 18],
            [18, 0, -18],
            [-8, -22, -8],
          ];

  return patterns[Math.floor(Math.random() * patterns.length)];
}

function spawnCoinsBetween(previousObstacle, obstacle) {
  if (!previousObstacle) {
    return;
  }

  if (Math.random() > COIN_CHANCE) {
    game.gapsSincePda += 1;
    return;
  }

  const laneStart = previousObstacle.x + previousObstacle.width + COIN_EDGE_MARGIN;
  const laneEnd = obstacle.x - COIN_EDGE_MARGIN;
  const laneWidth = laneEnd - laneStart;

  if (laneWidth < COIN_RADIUS * 5) {
    game.gapsSincePda += 1;
    return;
  }

  const baseHeightLimit =
    obstacle.kind === "bus" || previousObstacle.kind === "bus" ? COIN_HIGH_HEIGHT : COIN_MAX_HEIGHT;
  const pdaEligible = game.gapsSincePda >= PDA_COOLDOWN_GAPS && Math.random() < PDA_CHANCE;

  if (pdaEligible) {
    const pdaHeightLimit = Math.min(PDA_HIGH_HEIGHT, baseHeightLimit + 26);
    game.coins.push({
      kind: "pda",
      x: laneStart + laneWidth / 2,
      y: GROUND_Y - randomRange(PDA_MIN_HEIGHT, pdaHeightLimit),
      width: PDA_WIDTH,
      height: PDA_HEIGHT,
      phase: Math.random() * TAU,
    });
    game.gapsSincePda = 0;
    return;
  }

  const maxCoins = Math.min(3, Math.floor((laneWidth + COIN_SPACING * 0.35) / COIN_SPACING));

  if (maxCoins <= 0) {
    game.gapsSincePda += 1;
    return;
  }

  let coinCount = 1;

  if (maxCoins >= 2 && Math.random() < 0.72) {
    coinCount = 2;
  }

  if (maxCoins >= 3 && Math.random() < 0.46) {
    coinCount = 3;
  }

  const spacing = coinCount > 1 ? Math.min(COIN_SPACING, laneWidth / (coinCount - 1 + 0.6)) : 0;
  const totalSpan = coinCount > 1 ? spacing * (coinCount - 1) : 0;
  const startX = laneStart + Math.max(0, (laneWidth - totalSpan) / 2);
  const baseHeight = randomRange(COIN_MIN_HEIGHT, baseHeightLimit);
  const offsets = pickCoinOffsets(coinCount);

  for (let index = 0; index < coinCount; index += 1) {
    const airHeight = clamp(baseHeight + offsets[index], COIN_MIN_HEIGHT, baseHeightLimit);
    game.coins.push({
      kind: "coin",
      x: startX + spacing * index,
      y: GROUND_Y - airHeight,
      radius: COIN_RADIUS,
      phase: Math.random() * TAU,
    });
  }

  game.gapsSincePda += 1;
}

function spawnObstacle() {
  const busEligible =
    game.score >= BUS_MIN_SCORE &&
    game.obstaclesSinceBus >= BUS_COOLDOWN_OBSTACLES &&
    Math.random() < BUS_CHANCE;

  const options = obstacleCatalog.filter(
    (entry) =>
      (busEligible ? entry.kind === "bus" : entry.kind !== "bus") &&
      (entry.kind !== game.lastObstacleKind || Math.random() > 0.6),
  );
  const template = options[Math.floor(Math.random() * options.length)];
  const previousObstacle = game.obstacles[game.obstacles.length - 1];
  const leadGap = scheduleNextObstacle(template);
  const spawnX = previousObstacle
    ? Math.max(WIDTH + 160, previousObstacle.x + previousObstacle.width + leadGap)
    : WIDTH + 160;

  game.obstacles.push({
    ...template,
    x: spawnX,
    passed: false,
  });

  spawnCoinsBetween(previousObstacle, game.obstacles[game.obstacles.length - 1]);

  game.lastObstacleKind = template.kind;
  game.obstaclesSinceBus = template.kind === "bus" ? 0 : game.obstaclesSinceBus + 1;
  const nextGap = scheduleNextObstacle();
  game.spawnTimer = (template.width + nextGap) / game.speed;
}

function scoreObstacle() {
  game.score += 1;

  if (game.score > game.best) {
    game.best = game.score;
    writeBestScore(game.best);
  }

  emitBurst(player.x + 24, player.y - 52, 10, ["#fff2d1", "#ffd05c", "#ffb54a"], 1.05);

  if (game.score % 10 === 0) {
    game.level += 1;
    game.speed = Math.min(MAX_SPEED, BASE_SPEED + (game.level - 1) * SPEED_STEP);
    game.levelBanner = 1.45;
    emitBurst(WIDTH * 0.52, HEIGHT * 0.2, 20, ["#fff2d1", "#ffd05c", "#ff8c52"], 1.4);
  }

  syncHud();
}

function coinBounds(coin) {
  if (coin.kind === "pda") {
    return {
      left: coin.x - coin.width / 2 + 2,
      right: coin.x + coin.width / 2 - 2,
      top: coin.y - coin.height / 2 + 2,
      bottom: coin.y + coin.height / 2 - 2,
    };
  }

  return {
    left: coin.x - coin.radius + 2,
    right: coin.x + coin.radius - 2,
    top: coin.y - coin.radius + 2,
    bottom: coin.y + coin.radius - 2,
  };
}

function playerBounds() {
  return {
    left: player.x - 14,
    right: player.x + 16,
    top: player.y - 78,
    bottom: player.y - 2,
  };
}

function obstacleBounds(obstacle) {
  const hitbox = obstacle.hitbox;
  return {
    left: obstacle.x + hitbox.left,
    right: obstacle.x + obstacle.width - hitbox.right,
    top: GROUND_Y - obstacle.height + hitbox.top,
    bottom: GROUND_Y - hitbox.bottom,
  };
}

function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function updatePlayer(dt) {
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  if (player.grounded) {
    player.coyoteTimer = 0.09;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
    player.vy = JUMP_VELOCITY;
    player.grounded = false;
    player.jumpBuffer = 0;
    player.jumpHoldTime = JUMP_HOLD_WINDOW;
    player.doubleJumpAvailable = true;
    player.coyoteTimer = 0;
    emitDust(player.x - 6, GROUND_Y - 4, 8);
  }

  const gravity =
    inputState.jumpHeld && player.jumpHoldTime > 0 && player.vy < 0
      ? JUMP_HOLD_GRAVITY
      : GRAVITY;

  player.jumpHoldTime = Math.max(0, player.jumpHoldTime - dt);
  player.vy += gravity * dt;
  player.y += player.vy * dt;
  player.tilt = clamp(player.vy / 950, -0.28, 0.38);

  if (player.y >= GROUND_Y) {
    if (!player.grounded && player.vy > 120) {
      emitDust(player.x - 6, GROUND_Y - 2, 10);
    }

    player.y = GROUND_Y;
    player.vy = 0;
    player.jumpHoldTime = 0;
    player.doubleJumpAvailable = false;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  player.stepTime += dt * (player.grounded ? 8 + game.speed * 0.012 : 2.6);
}

function updateObstacles(dt) {
  game.distance += game.speed * dt;
  game.spawnTimer -= dt;

  if (game.spawnTimer <= 0) {
    spawnObstacle();
  }

  const playerHitbox = playerBounds();

  for (let index = game.obstacles.length - 1; index >= 0; index -= 1) {
    const obstacle = game.obstacles[index];
    obstacle.x -= game.speed * dt;

    if (intersects(playerHitbox, obstacleBounds(obstacle))) {
      crash(obstacle.label);
      return;
    }

    if (!obstacle.passed && obstacle.x + obstacle.width < player.x - player.width / 2) {
      obstacle.passed = true;
      scoreObstacle();
    }

    if (obstacle.x + obstacle.width < -120) {
      game.obstacles.splice(index, 1);
    }
  }
}

function collectCoin(coin) {
  if (coin.kind === "pda") {
    game.pdaScore += 1;
    playPdaFoundSound();
    game.cameraShake = Math.max(game.cameraShake, 4);
    emitBurst(coin.x, coin.y, 14, ["#d7f2ff", "#92d8ff", "#ff6d52"], 0.92);
    return;
  }

  game.coinScore += 1;
  playCoinChime();
  emitBurst(coin.x, coin.y, 9, ["#fff4bf", "#ffd95c", "#ffb347"], 0.78);
}

function updateCoins(dt) {
  const playerHitbox = playerBounds();

  for (let index = game.coins.length - 1; index >= 0; index -= 1) {
    const coin = game.coins[index];
    const trailingEdge = coin.kind === "pda" ? coin.width / 2 : coin.radius;
    coin.x -= game.speed * dt;

    if (intersects(playerHitbox, coinBounds(coin))) {
      collectCoin(coin);
      game.coins.splice(index, 1);
      continue;
    }

    if (coin.x + trailingEdge < -80) {
      game.coins.splice(index, 1);
    }
  }
}

function updateParticles(dt) {
  for (let index = game.particles.length - 1; index >= 0; index -= 1) {
    const particle = game.particles[index];
    particle.life -= dt;

    if (particle.life <= 0) {
      game.particles.splice(index, 1);
      continue;
    }

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.exp(-dt * 1.8);
    particle.vy *= Math.exp(-dt * 1.8);
    particle.rotation += particle.spin * dt;
  }
}

function update(dt) {
  game.time += dt;

  if (game.state === "running") {
    updatePlayer(dt);
    updateObstacles(dt);

    if (game.state === "running") {
      updateCoins(dt);
    }
  } else if (game.state === "ready") {
    player.stepTime += dt * 4.5;
    player.y = GROUND_Y + Math.sin(game.time * 2.4) * 2.5;
  } else {
    player.stepTime += dt * 1.2;
  }

  updateParticles(dt);
  game.levelBanner = Math.max(0, game.levelBanner - dt);
  game.cameraShake *= Math.exp(-dt * 7);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function wrapOffset(value, span) {
  return ((value % span) + span) % span;
}

function drawBackground() {
  const scroll = game.distance;
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#f6d8a5");
  sky.addColorStop(0.45, "#ee9256");
  sky.addColorStop(1, "#2f3b4a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255, 241, 200, 0.85)";
  ctx.beginPath();
  ctx.arc(WIDTH - 92, 128, 54, 0, TAU);
  ctx.fill();

  drawCloudBand(scroll * 0.08);
  drawHouseBand(scroll * 0.18);
  drawFrontGardens(scroll * 0.32);

  ctx.fillStyle = "#dcc7a3";
  ctx.fillRect(0, PAVEMENT_TOP, WIDTH, CURB_TOP - PAVEMENT_TOP);

  ctx.fillStyle = "#b68f6d";
  ctx.fillRect(0, CURB_TOP, WIDTH, ROAD_TOP - CURB_TOP);

  ctx.fillStyle = "#3b3d42";
  ctx.fillRect(0, ROAD_TOP, WIDTH, HEIGHT - ROAD_TOP);

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let x = -120; x < WIDTH + 140; x += 140) {
    const offset = x - wrapOffset(scroll * 0.95, 140);
    ctx.fillRect(offset, ROAD_TOP + 52, 78, 10);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let x = -140; x < WIDTH + 160; x += 120) {
    const offset = x - wrapOffset(scroll * 1.15, 120);
    ctx.fillRect(offset, PAVEMENT_TOP + 18, 72, 5);
  }
}

function drawCloudBand(scroll) {
  for (let index = 0; index < 6; index += 1) {
    const x = index * 190 - wrapOffset(scroll + index * 40, WIDTH + 240) + 120;
    const y = 110 + (index % 3) * 34;
    drawCloud(x, y, 1 + (index % 2) * 0.18);
  }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255, 248, 230, 0.88)";
  ctx.beginPath();
  ctx.arc(-26, 8, 18, 0, TAU);
  ctx.arc(0, 0, 22, 0, TAU);
  ctx.arc(28, 8, 18, 0, TAU);
  ctx.arc(4, 16, 22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawHouseBand(scroll) {
  for (let index = 0; index < 9; index += 1) {
    const span = 150;
    const x = index * span - wrapOffset(scroll + index * 13, WIDTH + span) - 50;
    const width = 118 + (index % 3) * 18;
    const height = 132 + (index % 4) * 16;
    const baseY = PAVEMENT_TOP;
    const wallColor = ["#f2d2b7", "#f4c6a1", "#e7b288", "#d3c7b3"][index % 4];
    const roofColor = ["#835148", "#6e4348", "#82472a", "#5b4a44"][index % 4];

    ctx.fillStyle = wallColor;
    ctx.fillRect(x, baseY - height, width, height);
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(x - 8, baseY - height + 10);
    ctx.lineTo(x + width / 2, baseY - height - 30);
    ctx.lineTo(x + width + 8, baseY - height + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#5f463f";
    ctx.fillRect(x + width * 0.42, baseY - 56, 18, 56);

    ctx.fillStyle = "rgba(255, 245, 210, 0.86)";
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) {
        ctx.fillRect(x + 18 + column * 36, baseY - height + 26 + row * 42, 18, 24);
      }
    }
  }
}

function drawFrontGardens(scroll) {
  for (let index = 0; index < 8; index += 1) {
    const span = 136;
    const x = index * span - wrapOffset(scroll + index * 22, WIDTH + span) - 80;
    ctx.fillStyle = ["#72905b", "#668350", "#7b9964"][index % 3];
    ctx.fillRect(x, PAVEMENT_TOP - 28, 92, 20);

    ctx.fillStyle = "#47332a";
    ctx.fillRect(x + 24, PAVEMENT_TOP - 52, 6, 24);
    ctx.fillStyle = "#d5b38e";
    ctx.fillRect(x + 8, PAVEMENT_TOP - 12, 8, 12);
    ctx.fillRect(x + 72, PAVEMENT_TOP - 12, 8, 12);
  }
}

function drawObstacle(obstacle) {
  ctx.save();
  ctx.translate(obstacle.x, GROUND_Y);

  switch (obstacle.kind) {
    case "dog":
      drawDog();
      break;
    case "cat":
      drawCat();
      break;
    case "pram":
      drawPram("#596f89", "#f7e8c9");
      break;
    case "pushchair":
      drawPram("#8f6587", "#f4ead4");
      break;
    case "postbox":
      drawPostBox();
      break;
    case "holly":
      drawHollyBush();
      break;
    case "bollard":
      drawBollard();
      break;
    case "bench":
      drawBench();
      break;
    case "bus":
      drawBus();
      break;
    default:
      break;
  }

  ctx.restore();
}

function drawDog() {
  ctx.fillStyle = "#6d4a34";
  roundedRect(4, -26, 32, 20, 8);
  ctx.fill();
  roundedRect(28, -36, 16, 14, 6);
  ctx.fill();
  ctx.fillRect(10, -8, 5, 8);
  ctx.fillRect(24, -8, 5, 8);
  ctx.fillRect(34, -8, 5, 8);
  ctx.beginPath();
  ctx.moveTo(40, -34);
  ctx.lineTo(48, -44);
  ctx.lineTo(36, -39);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -24);
  ctx.lineTo(-8, -34);
  ctx.lineTo(0, -18);
  ctx.strokeStyle = "#6d4a34";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawCat() {
  ctx.fillStyle = "#3d4149";
  roundedRect(4, -18, 20, 14, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(24, -16, 9, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, -22);
  ctx.lineTo(21, -31);
  ctx.lineTo(24, -22);
  ctx.moveTo(26, -22);
  ctx.lineTo(30, -31);
  ctx.lineTo(32, -22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -15);
  ctx.quadraticCurveTo(-10, -28, -2, -6);
  ctx.strokeStyle = "#3d4149";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawPram(frameColor, hoodColor) {
  ctx.fillStyle = frameColor;
  ctx.lineWidth = 4;
  ctx.strokeStyle = frameColor;
  ctx.beginPath();
  ctx.moveTo(12, -8);
  ctx.lineTo(22, -34);
  ctx.lineTo(42, -34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22, -34);
  ctx.lineTo(12, -50);
  ctx.lineTo(42, -50);
  ctx.lineTo(42, -34);
  ctx.closePath();
  ctx.fillStyle = hoodColor;
  ctx.fill();
  ctx.fillStyle = frameColor;
  ctx.beginPath();
  ctx.arc(18, -2, 8, 0, TAU);
  ctx.arc(42, -2, 8, 0, TAU);
  ctx.fill();
}

function drawPostBox() {
  ctx.fillStyle = "#be2d2f";
  roundedRect(4, -78, 34, 78, 8);
  ctx.fill();
  ctx.fillStyle = "#8f1719";
  ctx.fillRect(10, -58, 22, 5);
  ctx.fillStyle = "#f3d5a0";
  ctx.fillRect(14, -48, 14, 12);
}

function drawHollyBush() {
  ctx.fillStyle = "#2f6d42";
  ctx.beginPath();
  ctx.arc(18, -16, 18, 0, TAU);
  ctx.arc(34, -22, 16, 0, TAU);
  ctx.arc(44, -12, 14, 0, TAU);
  ctx.arc(8, -8, 14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#d43a34";
  ctx.beginPath();
  ctx.arc(18, -20, 3, 0, TAU);
  ctx.arc(28, -12, 3, 0, TAU);
  ctx.arc(38, -20, 3, 0, TAU);
  ctx.fill();
}

function drawBollard() {
  ctx.fillStyle = "#b9c3cf";
  roundedRect(2, -48, 18, 48, 6);
  ctx.fill();
  ctx.fillStyle = "#f2cc42";
  ctx.fillRect(4, -34, 14, 8);
}

function drawBench() {
  ctx.fillStyle = "#7b5138";
  ctx.fillRect(8, -28, 46, 6);
  ctx.fillRect(8, -18, 46, 6);
  ctx.fillStyle = "#4b3228";
  ctx.fillRect(14, -12, 6, 12);
  ctx.fillRect(42, -12, 6, 12);
}

function drawBus() {
  ctx.fillStyle = "#c62c29";
  roundedRect(4, -108, 154, 92, 12);
  ctx.fill();

  ctx.fillStyle = "#8e1717";
  roundedRect(118, -96, 28, 80, 8);
  ctx.fill();

  ctx.fillStyle = "#f5e8bf";
  for (let index = 0; index < 5; index += 1) {
    ctx.fillRect(16 + index * 24, -92, 18, 22);
    ctx.fillRect(16 + index * 24, -64, 18, 22);
  }

  ctx.fillRect(124, -88, 16, 54);

  ctx.fillStyle = "#f1c94a";
  ctx.fillRect(18, -34, 42, 10);

  ctx.fillStyle = "#1f2024";
  ctx.beginPath();
  ctx.arc(36, -10, 12, 0, TAU);
  ctx.arc(126, -10, 12, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#9aa2ae";
  ctx.beginPath();
  ctx.arc(36, -10, 5, 0, TAU);
  ctx.arc(126, -10, 5, 0, TAU);
  ctx.fill();
}

function drawCoinGlyph(radius) {
  ctx.fillStyle = "#ffd447";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#fff2b8";
  ctx.beginPath();
  ctx.arc(-radius * 0.1, -radius * 0.1, radius * 0.62, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "#d38d1f";
  ctx.lineWidth = Math.max(2, radius * 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, radius - 1.5, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.arc(-radius * 0.34, -radius * 0.32, radius * 0.2, 0, TAU);
  ctx.fill();
}

function drawPdaGlyph(scale = 1) {
  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = "#22384c";
  roundedRect(-14, -18, 28, 36, 6);
  ctx.fill();

  ctx.fillStyle = "#365d78";
  roundedRect(-11, -15, 22, 20, 4);
  ctx.fill();

  const screenGlow = ctx.createLinearGradient(-10, -14, 10, 5);
  screenGlow.addColorStop(0, "#d9f6ff");
  screenGlow.addColorStop(1, "#7bc5ef");
  ctx.fillStyle = screenGlow;
  roundedRect(-9, -13, 18, 16, 3);
  ctx.fill();

  ctx.fillStyle = "#ff6d52";
  ctx.beginPath();
  ctx.arc(0, 11, 2.3, 0, TAU);
  ctx.arc(-6, 11, 1.6, 0, TAU);
  ctx.arc(6, 11, 1.6, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = "#9edfff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, -13);
  ctx.lineTo(16, -20);
  ctx.stroke();

  ctx.fillStyle = "#9edfff";
  ctx.beginPath();
  ctx.arc(16, -20, 1.6, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawCoin(coin) {
  const bob = Math.sin(game.time * 6.5 + coin.phase) * 2.4;
  const shimmer = 0.78 + Math.abs(Math.sin(game.time * 10 + coin.phase)) * 0.22;

  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.scale(shimmer, 1);
  drawCoinGlyph(coin.radius);
  ctx.restore();
}

function drawPda(coin) {
  const bob = Math.sin(game.time * 5.4 + coin.phase) * 2.6;
  const wobble = Math.sin(game.time * 4.1 + coin.phase) * 0.08;

  ctx.save();
  ctx.translate(coin.x, coin.y + bob);
  ctx.rotate(wobble);
  drawPdaGlyph();
  ctx.restore();
}

function drawCoins() {
  for (const coin of game.coins) {
    if (coin.kind === "pda") {
      drawPda(coin);
    } else {
      drawCoin(coin);
    }
  }
}

function drawObstacles() {
  for (const obstacle of game.obstacles) {
    drawObstacle(obstacle);
  }
}

function drawPlayer() {
  const runSwing = Math.sin(player.stepTime);
  const shirtColor = "#9fd4f3";
  const capColor = "#17375b";
  const bagColor = "#c63c33";
  const skinColor = "#f1ceb4";
  const altitude = Math.max(0, GROUND_Y - player.y);
  const shadowFade = clamp(1 - altitude / 210, 0, 1);
  const shadowWidth = 24 - (1 - shadowFade) * 15;
  const shadowHeight = 7 - (1 - shadowFade) * 5;

  if (shadowFade > 0.02) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.22 * shadowFade})`;
    ctx.beginPath();
    ctx.ellipse(
      player.x,
      GROUND_Y + 4,
      Math.max(6, shadowWidth),
      Math.max(1.5, shadowHeight),
      0,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.tilt);

  ctx.strokeStyle = "#352319";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();

  if (player.grounded) {
    ctx.moveTo(-4, -44);
    ctx.lineTo(-12, -24 + runSwing * 7);
    ctx.moveTo(8, -44);
    ctx.lineTo(18, -24 - runSwing * 7);
    ctx.moveTo(-2, -18);
    ctx.lineTo(-12, 0 - runSwing * 6);
    ctx.moveTo(8, -18);
    ctx.lineTo(18, 0 + runSwing * 6);
  } else {
    ctx.moveTo(-4, -44);
    ctx.lineTo(-18, -28);
    ctx.moveTo(8, -44);
    ctx.lineTo(22, -30);
    ctx.moveTo(-2, -18);
    ctx.lineTo(-14, -6);
    ctx.moveTo(8, -18);
    ctx.lineTo(20, -4);
  }

  ctx.stroke();

  ctx.fillStyle = shirtColor;
  roundedRect(-16, -50, 32, 32, 10);
  ctx.fill();

  ctx.fillStyle = shirtColor;
  roundedRect(-20, -48, 10, 12, 5);
  ctx.fill();
  roundedRect(10, -48, 10, 12, 5);
  ctx.fill();

  ctx.fillStyle = bagColor;
  roundedRect(2, -44, 20, 20, 6);
  ctx.fill();

  ctx.strokeStyle = "#8f2420";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -47);
  ctx.lineTo(-4, -20);
  ctx.stroke();

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, -64, 12, 0, TAU);
  ctx.fill();

  ctx.fillStyle = capColor;
  roundedRect(-14, -78, 24, 10, 6);
  ctx.fill();
  roundedRect(6, -75, 12, 4, 2);
  ctx.fill();

  ctx.fillStyle = "#efe8d8";
  roundedRect(-13, -54, 10, 8, 3);
  ctx.fill();
  ctx.fillRect(-9, -52, 2, 4);
  ctx.fillRect(-6, -52, 2, 4);

  ctx.restore();
}

function drawParticles() {
  for (const particle of game.particles) {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = clamp(particle.life * 2, 0, 1);
    ctx.fillStyle = particle.color;
    roundedRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.7, 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCollectibleCounter() {
  const coinLabel = `Coins ${game.coinScore}`;
  const pdaLabel = `PDAs ${game.pdaScore}`;

  ctx.save();
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const coinWidth = ctx.measureText(coinLabel).width;
  const pdaWidth = ctx.measureText(pdaLabel).width;
  const boxWidth = coinWidth + pdaWidth + 126;
  const x = WIDTH - boxWidth - 18;
  const y = 20;

  ctx.fillStyle = "rgba(18, 21, 28, 0.58)";
  roundedRect(x, y, boxWidth, 36, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  roundedRect(x, y, boxWidth, 36, 18);
  ctx.stroke();

  ctx.save();
  ctx.translate(x + 20, y + 18);
  drawCoinGlyph(9);
  ctx.restore();

  ctx.fillStyle = "#fff4d9";
  ctx.fillText(coinLabel, x + 36, y + 19);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.moveTo(x + 66 + coinWidth, y + 8);
  ctx.lineTo(x + 66 + coinWidth, y + 28);
  ctx.stroke();

  ctx.save();
  ctx.translate(x + 90 + coinWidth, y + 18);
  drawPdaGlyph(0.56);
  ctx.restore();

  ctx.fillStyle = "#dff6ff";
  ctx.fillText(pdaLabel, x + 106 + coinWidth, y + 19);
  ctx.restore();
}

function drawLevelBanner() {
  if (game.levelBanner <= 0) {
    return;
  }

  const alpha = clamp(game.levelBanner / 1.45, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(26, 30, 36, 0.72)";
  roundedRect(WIDTH / 2 - 136, 56, 272, 68, 18);
  ctx.fill();
  ctx.fillStyle = "#ffd05c";
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("LEVEL UP", WIDTH / 2, 82);
  ctx.fillStyle = "#fff2d1";
  ctx.font = 'bold 28px Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
  ctx.fillText(`Level ${game.level}`, WIDTH / 2, 108);
  ctx.restore();
}

function drawScene() {
  ctx.save();

  if (game.cameraShake > 0.1) {
    ctx.translate(
      (Math.random() - 0.5) * game.cameraShake,
      (Math.random() - 0.5) * game.cameraShake,
    );
  }

  drawBackground();
  drawObstacles();
  drawCoins();
  drawParticles();
  drawPlayer();
  drawCollectibleCounter();
  drawLevelBanner();

  ctx.restore();
}

function frame(time) {
  const dt = Math.min((time - lastFrameTime) / 1000, 0.032);
  lastFrameTime = time;
  update(dt);
  drawScene();
  requestAnimationFrame(frame);
}

window.addEventListener(
  "keydown",
  (event) => {
    if (event.code === "ArrowUp") {
      if (event.repeat) {
        return;
      }

      event.preventDefault();
      beginJumpInput();
      return;
    }

    if (event.code === "Space" || event.code === "Enter") {
      if (event.repeat) {
        return;
      }

      event.preventDefault();
      endJumpInput();
      restartRun();
    }
  },
  { passive: false },
);

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowUp") {
    endJumpInput();
  }
});

window.addEventListener("blur", () => {
  endJumpInput();
});

restartButton.addEventListener("click", () => {
  endJumpInput();
  restartRun();
});

canvasShell.addEventListener("pointerdown", (event) => {
  if (canvasShell.setPointerCapture) {
    canvasShell.setPointerCapture(event.pointerId);
  }

  beginJumpInput();
});

canvasShell.addEventListener("pointerup", () => {
  endJumpInput();
});

canvasShell.addEventListener("pointercancel", () => {
  endJumpInput();
});

canvasShell.addEventListener("lostpointercapture", () => {
  endJumpInput();
});

resetGame("ready");
syncHud();
requestAnimationFrame(frame);
