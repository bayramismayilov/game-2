const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const restartBtn = document.getElementById("restart");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;
const TARGET_SCORE = 10;

const keys = new Set();
let lastTime = 0;
let elapsed = 0;
let isRunning = true;

const player = {
  x: 120,
  y: 280,
  radius: 16,
  speed: 220
};

let score = 0;
let lives = 3;

const stars = [];
const rocks = [];

const rand = (min, max) => Math.random() * (max - min) + min;

const resetPlayer = () => {
  player.x = 120;
  player.y = 280;
};

const spawnStars = () => {
  stars.length = 0;
  for (let i = 0; i < TARGET_SCORE; i += 1) {
    stars.push({
      x: rand(160, GAME_WIDTH - 40),
      y: rand(60, GAME_HEIGHT - 40),
      radius: 10,
      wobble: rand(0, Math.PI * 2)
    });
  }
};

const spawnRocks = () => {
  rocks.length = 0;
  const rockCount = 5;
  for (let i = 0; i < rockCount; i += 1) {
    rocks.push({
      x: rand(200, GAME_WIDTH - 60),
      y: rand(60, GAME_HEIGHT - 60),
      radius: rand(14, 20),
      vx: rand(-70, 70),
      vy: rand(-70, 70)
    });
  }
};

const resetGame = () => {
  score = 0;
  lives = 3;
  elapsed = 0;
  isRunning = true;
  resetPlayer();
  spawnStars();
  spawnRocks();
  overlay.classList.add("hidden");
  updateHud();
};

const updateHud = () => {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  timeEl.textContent = elapsed.toFixed(1);
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

  player.x = Math.min(Math.max(player.radius, player.x), GAME_WIDTH - player.radius);
  player.y = Math.min(Math.max(player.radius, player.y), GAME_HEIGHT - player.radius);
};

const updateRocks = (delta) => {
  const step = delta / 1000;
  rocks.forEach((rock) => {
    rock.x += rock.vx * step;
    rock.y += rock.vy * step;

    if (rock.x < rock.radius || rock.x > GAME_WIDTH - rock.radius) {
      rock.vx *= -1;
    }
    if (rock.y < rock.radius || rock.y > GAME_HEIGHT - rock.radius) {
      rock.vy *= -1;
    }
  });
};

const checkCollisions = () => {
  stars.forEach((star, index) => {
    if (isColliding(player, star)) {
      stars.splice(index, 1);
      score += 1;
      updateHud();
    }
  });

  rocks.forEach((rock) => {
    if (isColliding(player, rock)) {
      lives -= 1;
      resetPlayer();
      updateHud();
      if (lives <= 0) {
        isRunning = false;
        showOverlay("Game Over", "The rocks got you. Try again!");
      }
    }
  });

  if (score >= TARGET_SCORE) {
    isRunning = false;
    showOverlay("You Win!", `You collected ${TARGET_SCORE} stars in ${elapsed.toFixed(1)}s.`);
  }
};

const drawBackground = () => {
  ctx.fillStyle = "#0d1224";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
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

const drawStars = (time) => {
  stars.forEach((star) => {
    star.wobble += 0.04;
    const pulse = Math.sin(star.wobble + time / 500) * 2;

    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius + pulse * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
};

const drawRocks = () => {
  rocks.forEach((rock) => {
    ctx.fillStyle = "#8a8f9e";
    ctx.beginPath();
    ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#545a6a";
    ctx.lineWidth = 2;
    ctx.stroke();
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
    handleInput(delta);
    updateRocks(delta);
    checkCollisions();
  }

  drawBackground();
  drawStars(timestamp);
  drawRocks();
  drawPlayer();
  updateHud();

  requestAnimationFrame(loop);
};

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

resetGame();
requestAnimationFrame(loop);
