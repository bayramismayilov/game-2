class EventBus extends Phaser.Events.EventEmitter {}

class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.context = scene.sound.context;
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.bgmGain = this.context.createGain();
    this.bgmGain.connect(this.masterGain);
    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);
    this.isMuted = false;
    this.bgmInterval = null;
    this.bgmNodes = [];
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.masterGain.gain.value = muted ? 0 : 1;
    localStorage.setItem("fatemil-muted", muted ? "1" : "0");
  }

  playTone({ freq = 440, duration = 0.2, type = "sine", gain = 0.2, detune = 0 }) {
    if (this.isMuted) {
      return;
    }
    const osc = this.context.createOscillator();
    const gainNode = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gainNode.gain.value = gain;
    osc.connect(gainNode);
    gainNode.connect(this.sfxGain);
    osc.start();
    osc.stop(this.context.currentTime + duration);
  }

  playSfx(name) {
    const sounds = {
      uiClick: { freq: 620, duration: 0.12, type: "square", gain: 0.2 },
      jump: { freq: 540, duration: 0.15, type: "triangle", gain: 0.2 },
      land: { freq: 220, duration: 0.1, type: "sine", gain: 0.15 },
      goodPickup: { freq: 720, duration: 0.18, type: "sine", gain: 0.25 },
      badPickup: { freq: 140, duration: 0.2, type: "sawtooth", gain: 0.22 },
      powerupHoney: { freq: 860, duration: 0.24, type: "triangle", gain: 0.22 },
      powerupEggs: { freq: 680, duration: 0.24, type: "square", gain: 0.2 },
      powerupMeat: { freq: 480, duration: 0.3, type: "sawtooth", gain: 0.22 },
      enemyHit: { freq: 160, duration: 0.25, type: "sawtooth", gain: 0.25 },
      portalUnlock: { freq: 900, duration: 0.3, type: "sine", gain: 0.25 },
      portalEnter: { freq: 520, duration: 0.4, type: "triangle", gain: 0.2 },
      gameOver: { freq: 120, duration: 0.4, type: "sawtooth", gain: 0.3 },
      victory: { freq: 960, duration: 0.35, type: "sine", gain: 0.25 }
    };
    if (sounds[name]) {
      this.playTone(sounds[name]);
    }
  }

  startBgm() {
    if (this.bgmInterval) {
      return;
    }
    const pattern = [220, 262, 294, 330, 294, 262, 196, 220];
    const beat = 0.6;
    let index = 0;
    const playNote = () => {
      if (this.isMuted) {
        return;
      }
      const osc = this.context.createOscillator();
      const gainNode = this.context.createGain();
      osc.type = "triangle";
      osc.frequency.value = pattern[index % pattern.length];
      gainNode.gain.value = 0.08;
      osc.connect(gainNode);
      gainNode.connect(this.bgmGain);
      osc.start();
      osc.stop(this.context.currentTime + beat * 0.9);
      this.bgmNodes.push(osc);
      index += 1;
    };
    playNote();
    this.bgmInterval = setInterval(playNote, beat * 1000);
  }

  stopBgm() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmNodes.forEach((node) => {
      try {
        node.stop();
      } catch (error) {
        // ignore
      }
    });
    this.bgmNodes = [];
  }
}

class UIHUD {
  constructor(bus) {
    this.bus = bus;
    this.hud = document.getElementById("hud");
    this.scoreEl = document.getElementById("hud-score");
    this.sizeEl = document.getElementById("hud-size");
    this.powerEl = document.getElementById("hud-power");
    this.powerTimerEl = document.getElementById("hud-power-timer");
    this.comboEl = document.getElementById("hud-combo");
    this.comboTimerEl = document.getElementById("hud-combo-timer");
    this.goodEl = document.getElementById("hud-good");
    this.muteBtn = document.getElementById("mute-toggle");

    this.bus.on("score", (score) => {
      this.scoreEl.textContent = score;
    });
    this.bus.on("size", (size) => {
      this.sizeEl.textContent = `${size.toFixed(2)}x`;
    });
    this.bus.on("powerup", ({ name, time }) => {
      this.powerEl.textContent = name || "None";
      this.powerTimerEl.textContent = time ? `(${time.toFixed(1)}s)` : "";
    });
    this.bus.on("combo", ({ streak, multiplier, time }) => {
      const multiText = multiplier > 1 ? `x${multiplier.toFixed(1)}` : "";
      this.comboEl.textContent = `${streak} ${multiText}`;
      this.comboTimerEl.textContent = time ? `(${time.toFixed(1)}s)` : "";
    });
    this.bus.on("goodCount", (count) => {
      this.goodEl.textContent = count;
    });
  }

  show() {
    this.hud.classList.remove("hidden");
  }

  hide() {
    this.hud.classList.add("hidden");
  }
}

class ComboController {
  constructor(bus) {
    this.bus = bus;
    this.streak = 0;
    this.multiplier = 1;
    this.timer = 0;
    this.maxStreak = 0;
  }

  addGood() {
    this.streak += 1;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    if (this.streak >= 9) {
      this.multiplier = 3;
    } else if (this.streak >= 6) {
      this.multiplier = 2;
    } else if (this.streak >= 3) {
      this.multiplier = 1.5;
    } else {
      this.multiplier = 1;
    }
    this.timer = 10;
    this.emit();
  }

  reset() {
    this.streak = 0;
    this.multiplier = 1;
    this.timer = 0;
    this.emit();
  }

  update(delta) {
    if (this.timer > 0) {
      this.timer -= delta / 1000;
      if (this.timer <= 0) {
        this.reset();
      } else {
        this.emit();
      }
    }
  }

  emit() {
    this.bus.emit("combo", {
      streak: this.streak,
      multiplier: this.multiplier,
      time: this.timer
    });
  }
}

class PowerUpController {
  constructor(bus) {
    this.bus = bus;
    this.active = null;
    this.timer = 0;
  }

  setPower(name) {
    this.active = name;
    this.timer = 10;
    this.emit();
  }

  clear() {
    this.active = null;
    this.timer = 0;
    this.emit();
  }

  update(delta) {
    if (this.active && this.timer > 0) {
      this.timer -= delta / 1000;
      if (this.timer <= 0) {
        this.clear();
      } else {
        this.emit();
      }
    }
  }

  emit() {
    this.bus.emit("powerup", {
      name: this.active,
      time: this.timer
    });
  }
}

class CheckpointManager {
  constructor(scene) {
    this.scene = scene;
    this.checkpoints = [];
    this.current = { x: 120, y: 300 };
  }

  addCheckpoint(x, y) {
    const marker = this.scene.add.rectangle(x, y - 20, 30, 50, 0x64ffda, 0.6);
    this.scene.physics.add.existing(marker, true);
    marker.isCheckpoint = true;
    this.checkpoints.push(marker);
    return marker;
  }

  setCurrent(x, y) {
    this.current = { x, y };
  }
}

class EnemyPatrol {
  constructor(scene, x1, x2, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.rectangle(x1, y, 50, 40, 0xff5c5c);
    this.sprite.setStrokeStyle(2, 0x3b0b0b);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.left = x1;
    this.right = x2;
    this.speed = 60;
    this.sprite.body.setVelocityX(this.speed);
  }

  update() {
    if (this.sprite.x >= this.right) {
      this.sprite.body.setVelocityX(-this.speed);
    }
    if (this.sprite.x <= this.left) {
      this.sprite.body.setVelocityX(this.speed);
    }
  }
}

class PortalGoal {
  constructor(scene, x, y) {
    this.scene = scene;
    this.locked = true;
    this.sprite = scene.add.circle(x, y, 30, 0x5f5f7a, 0.9);
    this.ring = scene.add.circle(x, y, 36, 0x1b1b2a, 0.6).setStrokeStyle(4, 0x9999ff);
    scene.physics.add.existing(this.sprite, true);
  }

  unlock() {
    if (!this.locked) {
      return;
    }
    this.locked = false;
    this.sprite.setFillStyle(0x7bff9d, 0.9);
    this.ring.setStrokeStyle(4, 0x7bff9d);
  }
}

class PlayerController {
  constructor(scene, x, y, faceTexture, playerName) {
    this.scene = scene;
    this.playerName = playerName;
    this.container = scene.add.container(x, y);
    this.bodyShape = scene.add.rectangle(0, 20, 36, 48, 0x5ab3ff);
    this.headShape = scene.add.circle(0, -8, 18, 0xffd1a9);
    this.face = scene.add.image(0, -8, faceTexture).setDisplaySize(28, 28);
    this.container.add([this.bodyShape, this.headShape, this.face]);
    scene.physics.add.existing(this.container);
    this.container.body.setCollideWorldBounds(true);
    this.container.body.setSize(36, 68);
    this.container.body.setOffset(-18, -6);
    this.container.body.setGravityY(900);

    this.nameText = scene.add.text(x, y - 60, playerName, {
      fontSize: "14px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5, 1);

    this.speed = 180;
    this.jumpStrength = 360;
    this.jumpCount = 0;
    this.maxJump = 1;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.sizeMultiplier = 1;
    this.speech = scene.add.text(x, y - 90, "", {
      fontSize: "12px",
      color: "#ffe7b8",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5, 1).setAlpha(0);
  }

  update(keys, powerUp, delta) {
    const body = this.container.body;
    if (!body) {
      return;
    }
    const sprint = keys.shift.isDown ? 1.35 : 1;
    const targetSpeed = this.speed * sprint;
    if (keys.left.isDown) {
      body.setVelocityX(-targetSpeed);
    } else if (keys.right.isDown) {
      body.setVelocityX(targetSpeed);
    } else {
      body.setVelocityX(0);
    }

    if (Phaser.Input.Keyboard.JustDown(keys.jump) || Phaser.Input.Keyboard.JustDown(keys.up)) {
      const canDoubleJump = powerUp === "Eggs";
      this.maxJump = canDoubleJump ? 2 : 1;
      if (this.jumpCount < this.maxJump) {
        body.setVelocityY(-this.jumpStrength);
        this.jumpCount += 1;
        this.scene.audioManager.playSfx("jump");
      }
    }

    if (body.blocked.down) {
      if (this.jumpCount > 0) {
        this.scene.audioManager.playSfx("land");
      }
      this.jumpCount = 0;
    }

    this.nameText.setPosition(this.container.x, this.container.y - 60 * this.sizeMultiplier);
    this.speech.setPosition(this.container.x, this.container.y - 90 * this.sizeMultiplier);

    if (this.invincible) {
      this.invincibleTimer -= delta / 1000;
      this.container.setAlpha(this.invincibleTimer % 0.2 > 0.1 ? 0.4 : 1);
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
        this.container.setAlpha(1);
      }
    }
  }

  applySize(multiplier) {
    this.sizeMultiplier = multiplier;
    this.container.setScale(multiplier);
    this.nameText.setScale(1);
  }

  speak(text) {
    this.speech.setText(text);
    this.speech.setAlpha(1);
    this.scene.tweens.add({
      targets: this.speech,
      alpha: 0,
      duration: 1500,
      ease: "Power1"
    });
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data) {
    this.playerName = data.playerName;
    this.faceTexture = data.faceTexture;
    this.audioManager = data.audioManager;
    this.bus = data.bus;
    this.hud = data.hud;
  }

  create() {
    this.score = 0;
    this.goodCount = 0;
    this.bus.emit("score", this.score);
    this.bus.emit("goodCount", this.goodCount);
    this.bus.emit("size", 1);

    this.combo = new ComboController(this.bus);
    this.powerUp = new PowerUpController(this.bus);
    this.checkpoints = new CheckpointManager(this);
    this.combo.emit();
    this.powerUp.emit();

    this.physics.world.setBounds(0, 0, 2000, 600);

    this.createWorld();
    this.player = new PlayerController(this, 120, 300, this.faceTexture, this.playerName);

    this.physics.add.collider(this.player.container, this.platforms);

    this.checkpoints.checkpoints.forEach((checkpoint) => {
      this.physics.add.overlap(this.player.container, checkpoint, () => {
        this.checkpoints.setCurrent(checkpoint.x, checkpoint.y - 40);
      });
    });

    this.setupPickups();
    this.setupEnemy();
    this.portal = new PortalGoal(this, 1750, 320);

    this.physics.add.overlap(this.player.container, this.portal.sprite, () => {
      if (this.portal.locked) {
        return;
      }
      this.audioManager.playSfx("portalEnter");
      this.audioManager.stopBgm();
      this.scene.pause();
      this.bus.emit("gameState", {
        state: "victory",
        score: this.score,
        maxCombo: this.combo.maxStreak
      });
    });

    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      b: Phaser.Input.Keyboard.KeyCodes.B
    });

    this.input.keyboard.on("keydown-B", () => {
      this.player.speak("I am fat");
    });

    this.cameras.main.startFollow(this.player.container, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, 2000, 600);

    this.honeyTrail = this.add.particles(0, 0, "particle", {
      speed: { min: 20, max: 60 },
      lifespan: 400,
      quantity: 2,
      scale: { start: 0.6, end: 0 },
      blendMode: "ADD"
    });
    this.honeyTrail.stop();

    this.vignette = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.4);
    this.vignette.setScrollFactor(0);
    this.vignette.setVisible(false);

    this.hud.show();
  }

  createWorld() {
    this.platforms = this.physics.add.staticGroup();
    const groundSegments = [
      { x: 300, w: 600 },
      { x: 900, w: 500 },
      { x: 1500, w: 700 }
    ];
    groundSegments.forEach((segment) => {
      const ground = this.add.rectangle(segment.x, 560, segment.w, 80, 0x2c6b2f);
      this.physics.add.existing(ground, true);
      this.platforms.add(ground);
    });

    const platformData = [
      { x: 300, y: 420, w: 200 },
      { x: 600, y: 340, w: 180 },
      { x: 900, y: 450, w: 220 },
      { x: 1200, y: 360, w: 180 },
      { x: 1500, y: 420, w: 200 }
    ];
    platformData.forEach((data) => {
      const plat = this.add.rectangle(data.x, data.y, data.w, 24, 0x4a90e2);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    this.checkpoints.addCheckpoint(700, 320);
    this.checkpoints.addCheckpoint(1300, 340);
  }

  setupPickups() {
    this.goodGroup = this.physics.add.group();
    this.badGroup = this.physics.add.group();

    const goods = [
      { x: 320, y: 380, type: "Red meat" },
      { x: 620, y: 300, type: "Eggs" },
      { x: 910, y: 410, type: "Honey" },
      { x: 1210, y: 320, type: "Red meat" },
      { x: 1500, y: 380, type: "Eggs" },
      { x: 1700, y: 500, type: "Honey" }
    ];

    const bads = [
      { x: 500, y: 520, type: "Burger" },
      { x: 800, y: 520, type: "Fries" },
      { x: 1100, y: 520, type: "Nuggets" },
      { x: 1400, y: 520, type: "Chips" },
      { x: 1600, y: 520, type: "Candies" }
    ];

    goods.forEach((item) => this.spawnPickup(item, true));
    bads.forEach((item) => this.spawnPickup(item, false));

    this.physics.add.overlap(this.player.container, this.goodGroup, (player, pickup) => {
      this.collectGood(pickup);
    });
    this.physics.add.overlap(this.player.container, this.badGroup, (player, pickup) => {
      this.collectBad(pickup);
    });
  }

  spawnPickup(data, isGood) {
    const color = isGood ? 0xff6f6f : 0xffd166;
    const shape = this.add.circle(data.x, data.y, 16, color);
    const label = this.add.text(data.x, data.y - 26, data.type, {
      fontSize: "12px",
      color: isGood ? "#ffd1d1" : "#ffe8b0",
      stroke: "#000000",
      strokeThickness: 2
    }).setOrigin(0.5, 1);
    this.physics.add.existing(shape);
    shape.body.setAllowGravity(false);
    shape.body.setImmovable(true);
    shape.isGood = isGood;
    shape.pickupType = data.type;
    shape.baseY = data.y;
    shape.label = label;
    if (isGood) {
      this.goodGroup.add(shape);
    } else {
      this.badGroup.add(shape);
    }
  }

  setupEnemy() {
    this.enemy = new EnemyPatrol(this, 1050, 1350, 520);
    this.physics.add.collider(this.enemy.sprite, this.platforms);
    this.physics.add.overlap(this.player.container, this.enemy.sprite, () => {
      if (this.player.invincible) {
        return;
      }
      this.score -= 15;
      this.bus.emit("score", this.score);
      this.audioManager.playSfx("enemyHit");
      this.cameras.main.shake(180, 0.01);
      this.player.invincible = true;
      this.player.invincibleTimer = 1.5;
      if (this.powerUp.active !== "Red meat") {
        const knockback = this.player.container.x < this.enemy.sprite.x ? -200 : 200;
        this.player.container.body.setVelocity(knockback, -200);
      }
      if (this.score < 0) {
        this.triggerGameOver();
      }
    });
  }

  collectGood(pickup) {
    pickup.destroy();
    pickup.label.destroy();
    this.combo.addGood();
    const multiplier = this.combo.multiplier;
    this.score += Math.round(10 * multiplier);
    this.bus.emit("score", this.score);
    this.goodCount += 1;
    this.bus.emit("goodCount", this.goodCount);
    this.audioManager.playSfx("goodPickup");
    this.add.particles(pickup.x, pickup.y, "particle", {
      speed: { min: 60, max: 140 },
      lifespan: 400,
      quantity: 12,
      scale: { start: 0.7, end: 0 },
      tint: 0xfff3a3
    });

    const nextSize = Math.min(this.player.sizeMultiplier * 1.15, 2.0);
    this.player.applySize(nextSize);
    this.bus.emit("size", this.player.sizeMultiplier);

    if (["Honey", "Eggs", "Red meat"].includes(pickup.pickupType)) {
      this.clearPowerUp();
      this.powerUp.setPower(pickup.pickupType);
      this.applyPowerUp(pickup.pickupType);
    }

    if (this.goodCount >= 5) {
      this.portal.unlock();
      this.audioManager.playSfx("portalUnlock");
    }
  }

  collectBad(pickup) {
    pickup.destroy();
    pickup.label.destroy();
    this.score -= 10;
    this.bus.emit("score", this.score);
    this.combo.reset();
    this.audioManager.playSfx("badPickup");
    this.cameras.main.flash(120, 255, 50, 50);
    this.cameras.main.shake(150, 0.008);
    if (this.score < 0) {
      this.triggerGameOver();
    }
  }

  applyPowerUp(type) {
    if (type === "Honey") {
      this.audioManager.playSfx("powerupHoney");
      this.honeyTrail.startFollow(this.player.container);
    }
    if (type === "Eggs") {
      this.audioManager.playSfx("powerupEggs");
    }
    if (type === "Red meat") {
      this.audioManager.playSfx("powerupMeat");
      const nextSize = Math.min(this.player.sizeMultiplier * 1.1, 2.0);
      this.player.applySize(nextSize);
      this.bus.emit("size", this.player.sizeMultiplier);
      this.vignette.setVisible(true);
    }
  }

  clearPowerUp() {
    this.honeyTrail.stop();
    this.vignette.setVisible(false);
  }

  triggerGameOver() {
    this.audioManager.playSfx("gameOver");
    this.audioManager.stopBgm();
    this.scene.pause();
    this.bus.emit("gameState", { state: "gameover" });
  }

  update(time, delta) {
    this.player.update(
      {
        left: { isDown: this.keys.left.isDown || this.keys.a.isDown },
        right: { isDown: this.keys.right.isDown || this.keys.d.isDown },
        jump: this.keys.jump,
        up: this.keys.up,
        shift: this.keys.shift
      },
      this.powerUp.active,
      delta
    );

    this.combo.update(delta);
    this.powerUp.update(delta);
    if (!this.powerUp.active) {
      this.clearPowerUp();
    }
    if (this.powerUp.active === "Honey") {
      this.player.speed = 230;
    } else {
      this.player.speed = 180;
    }

    this.enemy.update();

    this.goodGroup.getChildren().forEach((pickup) => {
      pickup.y = pickup.baseY + Math.sin((time + pickup.x) / 300) * 6;
      pickup.label.setPosition(pickup.x, pickup.y - 26);
    });
    this.badGroup.getChildren().forEach((pickup) => {
      pickup.y = pickup.baseY + Math.sin((time + pickup.x) / 320) * 6;
      pickup.label.setPosition(pickup.x, pickup.y - 26);
    });

    if (this.player.container.y > 800) {
      this.player.container.setPosition(this.checkpoints.current.x, this.checkpoints.current.y);
      this.player.container.body.setVelocity(0, 0);
      this.score -= 10;
      this.bus.emit("score", this.score);
      if (this.score < 0) {
        this.triggerGameOver();
      }
    }
  }
}

class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture("particle", 16, 16);
  }

  create() {
    this.scene.start("MenuScene");
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  init(data) {
    this.bus = data.bus;
    this.audioManager = data.audioManager;
    this.hud = data.hud;
  }

  create() {
    this.bus.on("gameState", (payload) => {
      if (payload.state === "gameover") {
        document.getElementById("game-over").classList.remove("hidden");
        document.getElementById("game-over").classList.add("active");
      }
      if (payload.state === "victory") {
        document.getElementById("final-score").textContent = payload.score ?? 0;
        document.getElementById("final-combo").textContent = payload.maxCombo ?? 0;
        document.getElementById("results").classList.remove("hidden");
        document.getElementById("results").classList.add("active");
      }
    });
  }
}

class GameManager {
  constructor() {
    this.bus = new EventBus();
    this.hud = new UIHUD(this.bus);
    this.faceTextureKey = "default-face";
    this.playerName = "Player";
    this.audioManager = null;
  }

  init() {
    this.setupInputs();
    const config = {
      type: Phaser.AUTO,
      parent: "game-container",
      width: 800,
      height: 600,
      backgroundColor: "#1c1c2e",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scene: [BootScene, MenuScene, GameScene]
    };
    this.game = new Phaser.Game(config);

    this.game.events.on("ready", () => {
      const scene = this.game.scene.getScene("MenuScene");
      scene.scene.setVisible(true);
    });

    this.game.events.on("boot", () => {
      this.audioManager = new AudioManager(this.game.scene.getScene("BootScene"));
    });

    this.game.events.on("start", () => {
      if (!this.audioManager) {
        this.audioManager = new AudioManager(this.game.scene.getScene("BootScene"));
      }
    });

    this.game.events.on("poststep", () => {
      if (!this.audioManager) {
        return;
      }
    });
  }

  setupInputs() {
    const menuOverlay = document.getElementById("menu-overlay");
    const nameInput = document.getElementById("player-name");
    const faceInput = document.getElementById("player-face");
    const defaultBtn = document.getElementById("default-face");
    const startBtn = document.getElementById("start-game");
    const muteBtn = document.getElementById("mute-toggle");

    const restartBtn = document.getElementById("restart-game");
    const backBtn = document.getElementById("back-to-menu");
    const restartLevelBtn = document.getElementById("restart-level");

    const updateStartState = () => {
      const nameOk = nameInput.value.trim().length > 0;
      const faceOk = !!this.faceCanvas;
      startBtn.disabled = !(nameOk && faceOk);
    };

    nameInput.addEventListener("input", updateStartState);

    faceInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          this.faceCanvas = this.cropToSquare(img);
          updateStartState();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    defaultBtn.addEventListener("click", () => {
      this.faceCanvas = this.generateDefaultFace();
      updateStartState();
    });

    startBtn.addEventListener("click", () => {
      this.playerName = nameInput.value.trim();
      this.registerFaceTexture();
      menuOverlay.classList.remove("active");
      setTimeout(() => {
        menuOverlay.classList.add("hidden");
      }, 500);

      const bootScene = this.game.scene.getScene("BootScene");
      if (!this.audioManager) {
        this.audioManager = new AudioManager(bootScene);
      }
      this.audioManager.context.resume();
      this.audioManager.setMuted(this.getMutedState());
      this.audioManager.playSfx("uiClick");
      this.audioManager.startBgm();

      this.game.scene.stop("MenuScene");
      this.game.scene.start("GameScene", {
        playerName: this.playerName,
        faceTexture: this.faceTextureKey,
        audioManager: this.audioManager,
        bus: this.bus,
        hud: this.hud
      });
      this.hud.show();
    });

    muteBtn.addEventListener("click", () => {
      const next = !this.getMutedState();
      localStorage.setItem("fatemil-muted", next ? "1" : "0");
      if (this.audioManager) {
        this.audioManager.setMuted(next);
      }
      muteBtn.textContent = next ? "Unmute" : "Mute";
    });

    restartBtn.addEventListener("click", () => {
      this.audioManager.playSfx("uiClick");
      const gameOver = document.getElementById("game-over");
      gameOver.classList.add("hidden");
      gameOver.classList.remove("active");
      this.restartGame();
    });

    backBtn.addEventListener("click", () => {
      this.audioManager.playSfx("uiClick");
      document.getElementById("game-over").classList.add("hidden");
      window.location.reload();
    });

    restartLevelBtn.addEventListener("click", () => {
      this.audioManager.playSfx("uiClick");
      const results = document.getElementById("results");
      results.classList.add("hidden");
      results.classList.remove("active");
      this.restartGame();
    });

    const muted = this.getMutedState();
    muteBtn.textContent = muted ? "Unmute" : "Mute";
  }

  getMutedState() {
    return localStorage.getItem("fatemil-muted") === "1";
  }

  registerFaceTexture() {
    const scene = this.game.scene.getScene("BootScene");
    const key = "face-upload";
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.textures.addCanvas(key, this.faceCanvas);
    this.faceTextureKey = key;
  }

  cropToSquare(image) {
    const size = Math.min(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const sx = (image.width - size) / 2;
    const sy = (image.height - size) / 2;
    ctx.drawImage(image, sx, sy, size, size, 0, 0, 128, 128);
    return canvas;
  }

  generateDefaultFace() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffdfb0";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(40, 50, 12, 0, Math.PI * 2);
    ctx.arc(88, 50, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333333";
    ctx.beginPath();
    ctx.arc(40, 50, 6, 0, Math.PI * 2);
    ctx.arc(88, 50, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a3e00";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 80, 24, 0, Math.PI);
    ctx.stroke();
    return canvas;
  }

  restartGame() {
    this.audioManager.stopBgm();
    this.audioManager.startBgm();
    this.game.scene.stop("GameScene");
    this.game.scene.start("GameScene", {
      playerName: this.playerName,
      faceTexture: this.faceTextureKey,
      audioManager: this.audioManager,
      bus: this.bus,
      hud: this.hud
    });
  }
}

window.addEventListener("load", () => {
  const manager = new GameManager();
  manager.init();
});
