const canvas = document.getElementById("game");
const ctx = canvas ? canvas.getContext("2d") : null;
const errorPanel = document.createElement("div");
errorPanel.style.color = "#ffd166";
errorPanel.style.marginTop = "12px";
errorPanel.style.fontSize = "14px";
errorPanel.style.textAlign = "center";

const scoreEl = document.getElementById("score");
const roundEl = document.getElementById("round");
const targetEl = document.getElementById("target");
const timeEl = document.getElementById("time");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const restartBtn = document.getElementById("restart");
const backgroundTrack = document.getElementById("bgm");

let gameWidth = canvas ? canvas.width : 0;
let gameHeight = canvas ? canvas.height : 0;
const ROUND_TIME = 60;
const rounds = [
  { name: "Easy", targetScore: 25, goodCount: 7, badCount: 3 },
  { name: "Medium", targetScore: 40, goodCount: 9, badCount: 4 },
  { name: "Impossible", targetScore: 60, goodCount: 11, badCount: 5 }
];

const keys = new Set();
let lastTime = 0;
let elapsed = 0;
let isRunning = true;
let roundIndex = 0;
let roundTimeRemaining = ROUND_TIME;
let awaitingNextRound = false;

const player = {
  x: 120,
  y: 280,
  radius: 18,
  speed: 220
};

let score = 0;
let lives = 3;
let badItemsEaten = 0;

const items = [];

const goodItems = [
  { name: "Strawberry", icon: "🍓", color: "#ff6b6b" },
  { name: "Steak", icon: "🥩", color: "#c44536" },
  { name: "Eggs", icon: "🥚", color: "#ffe8a3" },
  { name: "Honey", icon: "🍯", color: "#f6c453" }
];

const badItems = [
  { name: "Hamburger", icon: "🍔", color: "#f4a261" },
  { name: "Fries", icon: "🍟", color: "#e9c46a" },
  { name: "Coca-Cola", icon: "🥤", color: "#6d213c" }
];

let audioContext = null;
let soundEnabled = false;
let backgroundAudioReady = false;

const rand = (min, max) => Math.random() * (max - min) + min;

const resizeCanvas = () => {
  if (!canvas || !ctx) {
    return;
  }
  const { width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) {
    return;
  }
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  gameWidth = width;
  gameHeight = height;
};

const resetPlayer = () => {
  player.x = 120;
  player.y = 280;
  player.radius = 18;
};

const resetPlayerPosition = () => {
  player.x = 120;
  player.y = 280;
};

const initAudio = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  soundEnabled = true;
  if (backgroundTrack && !backgroundAudioReady) {
    backgroundTrack.volume = 0.35;
    backgroundTrack.loop = true;
    backgroundAudioReady = true;
  }
};

const startBackgroundMusic = () => {
  if (!backgroundTrack || !soundEnabled) {
    return;
  }
  backgroundTrack.play().catch(() => {});
};

const pauseBackgroundMusic = () => {
  if (!backgroundTrack) {
    return;
  }
  backgroundTrack.pause();
};

const stopBackgroundMusic = () => {
  if (!backgroundTrack) {
    return;
  }
  backgroundTrack.pause();
  backgroundTrack.currentTime = 0;
};

const playTone = (frequency, duration, type = "sine", volume = 0.2) => {
  if (!soundEnabled || !audioContext) {
    return;
  }
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
};

const playExplosion = () => {
  if (!soundEnabled || !audioContext) {
    return;
  }
  const duration = 0.7;
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 800;
  gain.gain.value = 0.6;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  noise.start();
};

const spawnItems = () => {
  items.length = 0;
  const currentRound = rounds[roundIndex];
  const totalGood = currentRound.goodCount;
  const totalBad = currentRound.badCount;
  for (let i = 0; i < totalGood; i += 1) {
    const type = goodItems[i % goodItems.length];
    items.push({
      x: rand(160, gameWidth - 40),
      y: rand(60, gameHeight - 40),
      radius: 12,
      wobble: rand(0, Math.PI * 2),
      kind: "good",
      label: type.name,
      color: type.color,
      icon: type.icon
    });
  }
  for (let i = 0; i < totalBad; i += 1) {
    const type = badItems[i % badItems.length];
    items.push({
      x: rand(200, gameWidth - 60),
      y: rand(80, gameHeight - 60),
      radius: 14,
      wobble: rand(0, Math.PI * 2),
      kind: "bad",
      label: type.name,
      color: type.color,
      icon: type.icon
    });
  }
};

const resetGame = () => {
  score = 0;
  elapsed = 0;
  isRunning = true;
  roundIndex = 0;
  roundTimeRemaining = ROUND_TIME;
  awaitingNextRound = false;
  lives = 3;
  badItemsEaten = 0;
  resetPlayer();
  spawnItems();
  overlay.classList.add("hidden");
  restartBtn.textContent = "Play Again";
  updateHud();
  startBackgroundMusic();
  playTone(440, 0.18, "triangle", 0.2);
};

const updateHud = () => {
  const roundData = rounds[roundIndex];
  scoreEl.textContent = score;
  roundEl.textContent = `${roundIndex + 1} / ${rounds.length} (${roundData.name})`;
  targetEl.textContent = roundData.targetScore;
  timeEl.textContent = roundTimeRemaining.toFixed(1);
  if (livesEl) {
    livesEl.textContent = lives;
  }
};

const showOverlay = (title, message) => {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.remove("hidden");
};

const isColliding = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  return dist < a.radius + b.radius;
};

const handleInput = (delta) => {
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) {
    dx -= 1;
  }
  if (keys.has("ArrowRight") || keys.has("d")) {
    dx += 1;
  }
  if (keys.has("ArrowUp") || keys.has("w")) {
    dy -= 1;
  }
  if (keys.has("ArrowDown") || keys.has("s")) {
    dy += 1;
  }

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    const speed = player.speed * (delta / 1000);
    player.x += (dx / length) * speed;
    player.y += (dy / length) * speed;
  }

  player.x = Math.min(Math.max(player.radius, player.x), gameWidth - player.radius);
  player.y = Math.min(Math.max(player.radius, player.y), gameHeight - player.radius);
};

const checkCollisions = () => {
  items.forEach((item, index) => {
    if (isColliding(player, item)) {
      items.splice(index, 1);
      if (item.kind === "good") {
        score += 5;
        playTone(640, 0.12, "sine", 0.18);
      } else {
        badItemsEaten += 1;
        lives = Math.max(0, 3 - badItemsEaten);
        player.radius += 6;
        if (badItemsEaten >= 3) {
          playExplosion();
          endGame(false, "Boom! Emil ate too much junk food.");
        } else {
          playTone(220, 0.14, "square", 0.18);
        }
      }
      updateHud();
    }
  });
};

const advanceRound = () => {
  if (roundIndex < rounds.length - 1) {
    roundIndex += 1;
    roundTimeRemaining = ROUND_TIME;
    resetPlayerPosition();
    spawnItems();
    overlay.classList.add("hidden");
    awaitingNextRound = false;
    isRunning = true;
    startBackgroundMusic();
    playTone(520, 0.16, "triangle", 0.2);
  } else {
    endGame(true, "Congrats! You helped Emil to be healthy.");
  }
};

const endGame = (won, message) => {
  isRunning = false;
  awaitingNextRound = false;
  stopBackgroundMusic();
  const title = won ? "Victory!" : "Game Over";
  showOverlay(title, message);
  restartBtn.textContent = "Play Again";
};

const drawBackground = () => {
  ctx.fillStyle = "#0d1224";
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  const gradient = ctx.createLinearGradient(0, 0, gameWidth, gameHeight);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, gameWidth, gameHeight);
};

const drawPlayer = () => {
  ctx.fillStyle = "#47c5ff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(player.x + 6, player.y - 4, 3, 0, Math.PI * 2);
  ctx.arc(player.x - 6, player.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
};

const drawItems = (time) => {
  items.forEach((item) => {
    item.wobble += 0.04;
    const pulse = Math.sin(item.wobble + time / 500) * 2;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius + pulse * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "22px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.icon, item.x, item.y);

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(item.label, item.x, item.y - item.radius - 8);
  });
};

const loop = (timestamp) => {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if (isRunning) {
    elapsed += delta / 1000;
    roundTimeRemaining = Math.max(0, roundTimeRemaining - delta / 1000);
    handleInput(delta);
    checkCollisions();

    const currentRound = rounds[roundIndex];
    if (score >= currentRound.targetScore) {
      if (roundIndex === rounds.length - 1) {
        endGame(true, "Congrats! You helped Emil to be healthy.");
      } else {
        isRunning = false;
        awaitingNextRound = true;
        pauseBackgroundMusic();
        const nextRound = rounds[roundIndex + 1];
        showOverlay(
          "Round Cleared!",
          `You hit ${currentRound.targetScore} points. Get ready for ${nextRound ? nextRound.name : "the next round"}!`
        );
        restartBtn.textContent = "Start Next Round";
        playTone(720, 0.2, "triangle", 0.24);
      }
    } else if (roundTimeRemaining <= 0) {
      endGame(false, "Come on! You are making Emil fat ass!!!");
    }
  }

  drawBackground();
  drawItems(timestamp);
  drawPlayer();
  updateHud();

  requestAnimationFrame(loop);
};

window.addEventListener("keydown", (event) => {
  if (!soundEnabled) {
    initAudio();
  }
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

restartBtn.addEventListener("click", () => {
  if (!soundEnabled) {
    initAudio();
  }
  if (awaitingNextRound) {
    advanceRound();
  } else {
    resetGame();
  }
});

if (!canvas || !ctx) {
  const hud = document.querySelector(".hud-left");
  if (hud) {
    errorPanel.textContent = "Canvas failed to load. Please refresh or try another browser.";
    hud.appendChild(errorPanel);
  }
} else {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  resetGame();
  requestAnimationFrame(loop);
}
