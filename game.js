const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const levelValue = document.getElementById("levelValue");
const bestValue = document.getElementById("bestValue");
const stateValue = document.getElementById("stateValue");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const restartButton = document.getElementById("restartButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TAU = Math.PI * 2;
const GROUND_Y = 392;
const PAVEMENT_TOP = 392;
const CURB_TOP = 426;
const ROAD_TOP = 444;
const BEST_SCORE_KEY = "flappy-postman-runner-best";
const BASE_SPEED = 250;
const SPEED_STEP = 26;
const MAX_SPEED = 432;
const JUMP_VELOCITY = -700;
const GRAVITY = 1900;
const TOTAL_JUMP_TIME = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;

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
];

const game = {
  state: "ready",
  time: 0,
  distance: 0,
  score: 0,
  level: 1,
  best: readBestScore(),
  speed: BASE_SPEED,
  spawnTimer: 1.25,
  obstacles: [],
  particles: [],
  levelBanner: 0,
  cameraShake: 0,
  crashLabel: "a badly parked pram",
  lastObstacleKind: "",
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

function createPlayer() {
  return {
    x: 182,
    y: GROUND_Y,
    vy: 0,
    width: 36,
    height: 78,
    grounded: true,
    jumpBuffer: 0,
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
  scoreValue.textContent = String(game.score);
  levelValue.textContent = String(game.level);
  bestValue.textContent = String(game.best);
  stateValue.textContent =
    game.state === "running"
      ? "Running"
      : game.state === "gameover"
        ? "Crashed"
        : "Ready";
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
  game.particles = [];
  game.levelBanner = 0;
  game.cameraShake = 0;
  game.crashLabel = "a badly parked pram";
  game.lastObstacleKind = "";
  player = createPlayer();
  game.spawnTimer = (scheduleNextObstacle() + 120) / game.speed;

  if (game.state === "ready") {
    setOverlay(
      "Flappy Postman",
      "Tap the screen or press Up to start. Jump dogs, prams, post boxes, cats, holly bushes, and whatever else the street throws at you.",
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

function restartRun() {
  resetGame("running");
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
    `You hit ${label}. Score ${game.score}. Tap or press Up to try again, or use Space, Enter, or the button to restart.`,
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

function scheduleNextObstacle() {
  const jumpCover = game.speed * TOTAL_JUMP_TIME;
  const minGap = Math.max(170, jumpCover * 0.78);
  const maxGap = Math.max(minGap + 110, 320 + game.level * 16);
  return randomRange(minGap, maxGap);
}

function spawnObstacle() {
  const options = obstacleCatalog.filter(
    (entry) => entry.kind !== game.lastObstacleKind || Math.random() > 0.6,
  );
  const template = options[Math.floor(Math.random() * options.length)];

  game.obstacles.push({
    ...template,
    x: WIDTH + 120,
    passed: false,
  });

  game.lastObstacleKind = template.kind;
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
    emitBurst(WIDTH * 0.52, HEIGHT * 0.24, 20, ["#fff2d1", "#ffd05c", "#ff8c52"], 1.4);
  }

  syncHud();
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
    player.coyoteTimer = 0;
    emitDust(player.x - 6, GROUND_Y - 4, 8);
  }

  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  player.tilt = clamp(player.vy / 950, -0.28, 0.38);

  if (player.y >= GROUND_Y) {
    if (!player.grounded && player.vy > 120) {
      emitDust(player.x - 6, GROUND_Y - 2, 10);
    }

    player.y = GROUND_Y;
    player.vy = 0;
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
  ctx.arc(784, 92, 48, 0, TAU);
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
    ctx.fillRect(offset, ROAD_TOP + 36, 78, 10);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let x = -140; x < WIDTH + 160; x += 120) {
    const offset = x - wrapOffset(scroll * 1.15, 120);
    ctx.fillRect(offset, PAVEMENT_TOP + 10, 72, 5);
  }
}

function drawCloudBand(scroll) {
  for (let index = 0; index < 6; index += 1) {
    const x = index * 190 - wrapOffset(scroll + index * 40, WIDTH + 240) + 120;
    const y = 70 + (index % 3) * 28;
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
  const x = obstacle.x;
  const y = GROUND_Y;

  ctx.save();
  ctx.translate(x, y);

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

function drawObstacles() {
  for (const obstacle of game.obstacles) {
    drawObstacle(obstacle);
  }
}

function drawPlayer() {
  const runSwing = Math.sin(player.stepTime);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.tilt);

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 7, 0, 0, TAU);
  ctx.fill();

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

  ctx.fillStyle = "#214e8a";
  roundedRect(-16, -50, 32, 32, 10);
  ctx.fill();

  ctx.fillStyle = "#cf7f21";
  roundedRect(2, -44, 20, 20, 6);
  ctx.fill();

  ctx.fillStyle = "#f1ceb4";
  ctx.beginPath();
  ctx.arc(0, -64, 12, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "#c8392d";
  roundedRect(-14, -78, 26, 10, 6);
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

function drawLevelBanner() {
  if (game.levelBanner <= 0) {
    return;
  }

  const alpha = clamp(game.levelBanner / 1.45, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(26, 30, 36, 0.72)";
  roundedRect(WIDTH / 2 - 136, 48, 272, 68, 18);
  ctx.fill();
  ctx.fillStyle = "#ffd05c";
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("LEVEL UP", WIDTH / 2, 74);
  ctx.fillStyle = "#fff2d1";
  ctx.font = 'bold 28px Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
  ctx.fillText(`Level ${game.level}`, WIDTH / 2, 100);
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
  drawParticles();
  drawPlayer();
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
      queueJump();
      return;
    }

    if (event.code === "Space" || event.code === "Enter") {
      if (event.repeat) {
        return;
      }

      event.preventDefault();
      restartRun();
    }
  },
  { passive: false },
);

restartButton.addEventListener("click", () => {
  restartRun();
});

canvas.addEventListener("pointerdown", () => {
  queueJump();
});

resetGame("ready");
syncHud();
requestAnimationFrame(frame);
