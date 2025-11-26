const canvas = document.getElementById("battlefield");
const ctx = canvas.getContext("2d");

const massValue = document.getElementById("mass-value");
const healthValue = document.getElementById("health-value");
const infectionValue = document.getElementById("infection-value");
const startPanel = document.getElementById("start-panel");
const gameShell = document.getElementById("game-shell");
const unitPanel = document.querySelector(".unit-grid");
const logList = document.getElementById("event-log");
const slimeButton = document.getElementById("slime-button");
const sneezeButton = document.getElementById("sneeze-button");
const levelButtons = document.querySelectorAll("[data-level-trigger]");
const outcomePanel = document.getElementById("outcome-panel");
const outcomeTitle = document.getElementById("outcome-title");
const outcomeMessage = document.getElementById("outcome-message");
const retryButton = document.getElementById("retry-button");
const levelSelectButton = document.getElementById("level-select-button");
const slimeStatusLabel = slimeButton?.querySelector(".ability-status") ?? null;
const sneezeStatusLabel = sneezeButton?.querySelector(".ability-status") ?? null;
const appHeader = document.querySelector("header");
const influenzaCard = document.getElementById("influenza-card");

const GameStages = {
  PREPARING: "pre",
  PLAYING: "playing",
  POST: "post",
};

const INFLUENZA_UNLOCK_KEY = "immune-response::influenzaUnlocked";

function readInfluenzaUnlock() {
  try {
    return localStorage.getItem(INFLUENZA_UNLOCK_KEY) === "true";
  } catch {
    return false;
  }
}

function persistInfluenzaUnlock(value) {
  try {
    localStorage.setItem(INFLUENZA_UNLOCK_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage failures (e.g., privacy mode).
  }
}

const immuneCatalog = {
  macrophage: {
    id: "macrophage",
    name: "Macrophage",
    cost: 30,
    hp: 120,
    speed: 22,
    range: 30,
    attackRate: 1,
    damage: 18,
    color: "#f1c40f",
    role: "melee",
  },
  neutrophil: {
    id: "neutrophil",
    name: "Neutrophil",
    cost: 45,
    hp: 90,
    speed: 45,
    range: 25,
    attackRate: 1.5,
    damage: 14,
    color: "#ff7f50",
    role: "melee",
  },
  tcell: {
    id: "tcell",
    name: "T Cell",
    cost: 60,
    hp: 70,
    speed: 20,
    range: 140,
    attackRate: 0.8,
    damage: 22,
    color: "#32d6ff",
    role: "ranged",
  },
};

const virusCatalog = {
  rhinovirus: {
    name: "Rhinovirus",
    hp: 55,
    speed: 25,
    damage: 12,
    color: "#ff0059",
  },
  mucus: {
    name: "Mucus Clump",
    hp: 140,
    speed: 12,
    damage: 10,
    color: "#9acd32",
  },
  influenza: {
    name: "Influenza A",
    hp: 80,
    speed: 32,
    damage: 16,
    color: "#ff8c42",
  },
  stormcell: {
    name: "Storm Cell",
    hp: 135,
    speed: 20,
    damage: 22,
    color: "#ff3d6e",
  },
};

const fieldAbilities = {
  slime: {
    duration: 4,
    cooldown: 12,
    slowMultiplier: 0.35,
  },
  sneeze: {
    cooldown: 18,
    pushDistance: 140,
  },
};

const rhinovirusWaves = [
  {
    name: "Drip Scouts",
    duration: 16,
    spawnInterval: 2,
    mix: () => "rhinovirus",
  },
  {
    name: "Sneeze Swell",
    duration: 20,
    spawnInterval: 1.2,
    mix: () => (Math.random() < 0.8 ? "rhinovirus" : "mucus"),
  },
  {
    name: "Congestion Push",
    duration: 24,
    spawnInterval: 1.6,
    mix: () => (Math.random() < 0.4 ? "mucus" : "rhinovirus"),
  },
];

const influenzaWaves = [
  {
    name: "Drifting Droplets",
    duration: 18,
    spawnInterval: 1.4,
    mix: () => (Math.random() < 0.7 ? "influenza" : "rhinovirus"),
  },
  {
    name: "Fever Pitch",
    duration: 22,
    spawnInterval: 1.1,
    mix: () => (Math.random() < 0.55 ? "influenza" : "stormcell"),
  },
  {
    name: "Cytokine Crash",
    duration: 28,
    spawnInterval: 1.3,
    mix: () => (Math.random() < 0.45 ? "stormcell" : "influenza"),
  },
];

const levelConfigs = {
  rhinovirus: {
    id: "rhinovirus",
    label: "Runny Nose Defense",
    introLog: "Scenario online: Runny Nose infiltration detected.",
    victoryLog: "Rhinovirus suppressed. Nasal tissue stabilizing.",
    defeatLog: "Health fully depleted. Mission failed.",
    successTitle: "Runny Nose Secured",
    successMessage: "The nasal wall is calm again. Prepare for new pathogens.",
    failureTitle: "Runny Nose Overrun",
    failureMessage: "Viruses broke through the nasal defenses. Recalibrate and retry.",
    startMass: 50,
    startInfection: 5,
    passiveGain: 5,
    infectionRate: 0.25,
    waves: rhinovirusWaves,
  },
  influenza: {
    id: "influenza",
    label: "Influenza Storm",
    introLog: "High alert: Influenza strain breaching airway tissue.",
    victoryLog: "Influenza particles neutralized. Airways decompress.",
    defeatLog: "Influenza ruptured tissue barriers. Mission failed.",
    successTitle: "Influenza Held Back",
    successMessage: "The viral storm breaks and the airway steadies.",
    failureTitle: "Influenza Storm Lost",
    failureMessage: "The surge overwhelmed our line. Regroup and strike again.",
    startMass: 70,
    startInfection: 12,
    passiveGain: 6,
    infectionRate: 0.32,
    waves: influenzaWaves,
  },
};

const DEPLOYMENT_MIN_X = 30;
const DEPLOYMENT_MAX_RATIO = 0.45;
const DEPLOYMENT_MIN_Y = 5;
const state = {
  running: false,
  immuneUnits: [],
  virusUnits: [],
  projectiles: [],
  selectedUnit: null,
  cellularMass: 50,
  passiveGain: 5,
  tissueHealth: 100,
  infection: 0,
  infectionRate: 0.25,
  waveIndex: 0,
  waveTimer: 0,
  spawnTimer: 0,
  lastTimestamp: 0,
  logHistory: [],
  currentLevelId: null,
  abilityStatus: {
    slimeActive: 0,
    slimeCooldown: 0,
    sneezeCooldown: 0,
  },
  influenzaUnlocked: readInfluenzaUnlock(),
};

function getCurrentLevel() {
  if (!state.currentLevelId) {
    return null;
  }
  return levelConfigs[state.currentLevelId] ?? null;
}

function setStartButtonsDisabled(disabled) {
  levelButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function syncLevelUnlocks() {
  if (!influenzaCard) {
    return;
  }
  influenzaCard.hidden = !state.influenzaUnlocked;
}

function hideOutcomePanel() {
  if (!outcomePanel) {
    return;
  }
  outcomePanel.dataset.visible = "false";
  delete outcomePanel.dataset.mode;
}

function showOutcomePanel(mode, title, message) {
  if (!outcomePanel) {
    return;
  }
  outcomePanel.dataset.visible = "true";
  outcomePanel.dataset.mode = mode;
  if (outcomeTitle) {
    outcomeTitle.textContent = title;
  }
  if (outcomeMessage) {
    outcomeMessage.textContent = message;
  }
}

function handleVictory(level) {
  if (!state.running) {
    return;
  }
  state.running = false;
  setGameStage(GameStages.POST);
  logEvent(level.victoryLog);
  unlockInfluenzaScenario(level.id);
  setStartButtonsDisabled(false);
  showOutcomePanel("success", level.successTitle, level.successMessage);
  updateAbilityButtons();
}

function handleDefeat(level) {
  if (!state.running) {
    return;
  }
  state.running = false;
  setGameStage(GameStages.POST);
  logEvent(level.defeatLog);
  setStartButtonsDisabled(false);
  showOutcomePanel("failure", level.failureTitle, level.failureMessage);
  updateAbilityButtons();
}

function resetState(levelId) {
  const level = levelConfigs[levelId];
  if (!level) {
    logEvent("Unable to load scenario directives.");
    return;
  }
  state.currentLevelId = levelId;
  state.running = true;
  state.immuneUnits = [];
  state.virusUnits = [];
  state.projectiles = [];
  state.cellularMass = level.startMass ?? 50;
  state.tissueHealth = 100;
  state.infection = level.startInfection ?? 5;
  state.passiveGain = level.passiveGain ?? 5;
  state.infectionRate = level.infectionRate ?? 0.25;
  state.waveIndex = 0;
  state.waveTimer = 0;
  state.spawnTimer = 0;
  state.lastTimestamp = performance.now();
  state.logHistory = [];
  state.abilityStatus.slimeActive = 0;
  state.abilityStatus.slimeCooldown = 0;
  state.abilityStatus.sneezeCooldown = 0;
  hideOutcomePanel();
  logEvent(level.introLog);
  setStartButtonsDisabled(true);
  updateAbilityButtons();
  updateHUD();
}

function revealGameShell() {
  if (gameShell && gameShell.dataset.visible !== "true") {
    gameShell.dataset.visible = "true";
  }
  startPanel?.setAttribute("data-armed", "true");
}

function startLevel(levelId) {
  if (!levelConfigs[levelId]) {
    logEvent("Scenario unavailable.");
    return;
  }
  if (state.running) {
    logEvent("Mission already underway.");
    return;
  }
  revealGameShell();
  setGameStage(GameStages.PLAYING);
  resetState(levelId);
}

function selectUnit(unitId) {
  if (!immuneCatalog[unitId]) {
    return;
  }
  state.selectedUnit = unitId;
  document.querySelectorAll(".unit-card").forEach((btn) =>
    btn.toggleAttribute("selected", btn.dataset.unit === unitId)
  );
}

function deployUnit(position) {
  if (!state.running) {
    logEvent("Start the level before deploying immune cells.");
    return;
  }
  const unitId = state.selectedUnit;
  if (!unitId) {
    logEvent("Select a unit card before deploying.");
    return;
  }
  const blueprint = immuneCatalog[unitId];
  if (state.cellularMass < blueprint.cost) {
    logEvent("Insufficient cellular mass.");
    return;
  }
  state.cellularMass -= blueprint.cost;
  const maxDeployX = canvas.width * DEPLOYMENT_MAX_RATIO;
  const clampedX = Math.min(
    Math.max(position.x, DEPLOYMENT_MIN_X),
    maxDeployX
  );
  const clampedY = Math.min(
    Math.max(position.y, DEPLOYMENT_MIN_Y),
    canvas.height - DEPLOYMENT_MIN_Y
  );
  const unit = {
    ...blueprint,
    x: clampedX,
    y: clampedY,
    hp: blueprint.hp,
    cooldown: 0,
  };
  state.immuneUnits.push(unit);
  logEvent(`${blueprint.name} deployed.`);
}

function spawnVirus(typeId) {
  const blueprint = virusCatalog[typeId];
  if (!blueprint) {
    return;
  }
  const entity = {
    ...blueprint,
    type: typeId,
    x: canvas.width - 40,
    y: 40 + Math.random() * (canvas.height - 80),
    hp: blueprint.hp,
  };
  state.virusUnits.push(entity);
}

function logEvent(message) {
  const timestamp = new Date().toLocaleTimeString();
  state.logHistory.unshift({ message, timestamp });
  state.logHistory = state.logHistory.slice(0, 6);

  logList.innerHTML = "";
  state.logHistory.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `[${entry.timestamp}] ${entry.message}`;
    logList.appendChild(li);
  });
}

function setGameStage(stage) {
  document.body?.setAttribute("data-game-stage", stage);
  const showIntro = stage !== GameStages.PLAYING;
  if (startPanel) {
    startPanel.hidden = !showIntro;
  }
  if (appHeader) {
    appHeader.hidden = !showIntro;
  }
}

function unlockInfluenzaScenario(levelId) {
  if (levelId !== "rhinovirus" || state.influenzaUnlocked) {
    return;
  }
  state.influenzaUnlocked = true;
  persistInfluenzaUnlock(true);
  syncLevelUnlocks();
  logEvent("Advanced directive unlocked: Influenza Storm now available.");
}

function updateHUD() {
  massValue.textContent = Math.floor(state.cellularMass);
  healthValue.textContent = `${Math.max(state.tissueHealth, 0).toFixed(0)}%`;
  infectionValue.textContent = `${Math.min(state.infection, 100).toFixed(0)}%`;
}

function formatAbilityTimer(value) {
  return value <= 0 ? "Ready" : `${value.toFixed(1)}s`;
}

function formatSeconds(value) {
  return `${Math.max(0, value).toFixed(1)}s`;
}

function updateAbilityButtons() {
  if (slimeButton) {
    const cooldown = state.abilityStatus.slimeCooldown;
    const activeTime = state.abilityStatus.slimeActive;
    const ready = state.running && cooldown <= 0 && activeTime <= 0;
    slimeButton.disabled = !ready;
    if (slimeStatusLabel) {
      if (!state.running) {
        slimeStatusLabel.textContent = "Awaiting start";
      } else if (activeTime > 0) {
        slimeStatusLabel.textContent = `Active (${formatSeconds(activeTime)})`;
      } else {
        slimeStatusLabel.textContent = formatAbilityTimer(cooldown);
      }
    }
    const slimeProgress =
      state.running && cooldown > 0
        ? Math.min(cooldown / fieldAbilities.slime.cooldown, 1)
        : 0;
    slimeButton.style.setProperty(
      "--cooldown-progress",
      slimeProgress.toFixed(3)
    );
    slimeButton.classList.toggle("ability-active", activeTime > 0);
  }

  if (sneezeButton) {
    const cooldown = state.abilityStatus.sneezeCooldown;
    const ready = state.running && cooldown <= 0;
    sneezeButton.disabled = !ready;
    if (sneezeStatusLabel) {
      if (!state.running) {
        sneezeStatusLabel.textContent = "Awaiting start";
      } else {
        sneezeStatusLabel.textContent = formatAbilityTimer(cooldown);
      }
    }
    const sneezeProgress =
      state.running && cooldown > 0
        ? Math.min(cooldown / fieldAbilities.sneeze.cooldown, 1)
        : 0;
    sneezeButton.style.setProperty(
      "--cooldown-progress",
      sneezeProgress.toFixed(3)
    );
  }
}

function ensureScenarioRunning() {
  if (state.running) {
    return true;
  }
  logEvent("Start the level to trigger field events.");
  return false;
}

function tickAbilityTimers(elapsedSeconds) {
  if (!elapsedSeconds || elapsedSeconds <= 0) {
    return;
  }
  state.abilityStatus.slimeCooldown = Math.max(
    0,
    state.abilityStatus.slimeCooldown - elapsedSeconds
  );
  state.abilityStatus.sneezeCooldown = Math.max(
    0,
    state.abilityStatus.sneezeCooldown - elapsedSeconds
  );
  state.abilityStatus.slimeActive = Math.max(
    0,
    state.abilityStatus.slimeActive - elapsedSeconds
  );
}

function activateSlime() {
  if (!ensureScenarioRunning()) {
    return;
  }
  if (state.abilityStatus.slimeCooldown > 0 || state.abilityStatus.slimeActive > 0) {
    logEvent("Slime flood is still recharging.");
    return;
  }
  state.abilityStatus.slimeActive = fieldAbilities.slime.duration;
  state.abilityStatus.slimeCooldown = fieldAbilities.slime.cooldown;
  logEvent("Slime flood deployed. Viruses slowed by sticky mucus.");
  updateAbilityButtons();
}

function activateSneeze() {
  if (!ensureScenarioRunning()) {
    return;
  }
  if (state.abilityStatus.sneezeCooldown > 0) {
    logEvent("Sneeze reflex is recovering.");
    return;
  }
  state.abilityStatus.sneezeCooldown = fieldAbilities.sneeze.cooldown;
  state.virusUnits.forEach((virus) => {
    virus.x = Math.min(canvas.width - 40, virus.x + fieldAbilities.sneeze.pushDistance);
  });
  logEvent("Reflex sneeze blasts enemy cells backward!");
  updateAbilityButtons();
}

function handleCombat(delta) {
  state.immuneUnits.forEach((unit) => {
    unit.cooldown = Math.max(0, unit.cooldown - delta);
    let target = null;
    let closest = Infinity;
    state.virusUnits.forEach((virus) => {
      const dist = Math.hypot(virus.x - unit.x, virus.y - unit.y);
      if (dist < closest) {
        closest = dist;
        target = virus;
      }
    });

    if (target && closest <= unit.range) {
      if (unit.cooldown <= 0) {
        unit.cooldown = 1 / unit.attackRate;
        if (unit.role === "ranged") {
          state.projectiles.push({
            x: unit.x,
            y: unit.y,
            target,
            speed: 260,
            damage: unit.damage,
            color: unit.color,
          });
        } else {
          target.hp -= unit.damage;
        }
      }
    } else if (target) {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const len = Math.hypot(dx, dy) || 1;
      unit.x += (dx / len) * unit.speed * delta;
      unit.y += (dy / len) * unit.speed * delta;
    } else {
      unit.x += unit.speed * delta * 0.4;
    }
  });

  state.projectiles = state.projectiles.filter((proj) => {
    if (!proj.target || proj.target.hp <= 0) {
      return false;
    }
    const dx = proj.target.x - proj.x;
    const dy = proj.target.y - proj.y;
    const len = Math.hypot(dx, dy) || 1;
    proj.x += (dx / len) * proj.speed * delta;
    proj.y += (dy / len) * proj.speed * delta;
    if (len < 5) {
      proj.target.hp -= proj.damage;
      return false;
    }
    return true;
  });

  const slimeSlowFactor =
    state.abilityStatus.slimeActive > 0 ? fieldAbilities.slime.slowMultiplier : 1;
  state.virusUnits.forEach((virus) => {
    const blocker = state.immuneUnits.find(
      (unit) => Math.hypot(virus.x - unit.x, virus.y - unit.y) < 25
    );
    if (blocker) {
      blocker.hp -= virus.damage * delta;
      virus.hp -= blocker.damage * delta * 0.5;
      return;
    }
    virus.x -= virus.speed * slimeSlowFactor * delta;
    if (virus.x <= 35) {
      state.tissueHealth -= virus.damage * 0.8;
      state.infection += virus.damage * 0.5;
      virus.hp = 0;
    }
  });
}

function cleanupUnits() {
  state.immuneUnits = state.immuneUnits.filter((unit) => unit.hp > 0);
  const before = state.virusUnits.length;
  state.virusUnits = state.virusUnits.filter((virus) => virus.hp > 0);
  const removed = before - state.virusUnits.length;
  if (removed > 0) {
    state.cellularMass += removed * 8;
  }
}

function updateLevel(delta) {
  if (!state.running) {
    return;
  }
  const level = getCurrentLevel();
  if (!level) {
    return;
  }
  state.cellularMass += state.passiveGain * delta;
  state.infection += state.virusUnits.length * state.infectionRate * delta;
  state.tissueHealth = Math.min(Math.max(state.tissueHealth, 0), 100);
  state.infection = Math.min(Math.max(state.infection, 0), 100);

  const wave = level.waves?.[state.waveIndex];
  if (wave) {
    state.waveTimer += delta;
    state.spawnTimer -= delta;
    if (state.spawnTimer <= 0) {
      spawnVirus(wave.mix());
      state.spawnTimer = wave.spawnInterval;
    }
    if (state.waveTimer >= wave.duration) {
      logEvent(`${wave.name} repelled.`);
      state.waveIndex += 1;
      state.waveTimer = 0;
      state.spawnTimer = 1.5;
    }
  } else if (state.virusUnits.length === 0) {
    handleVictory(level);
    return;
  }

  if (state.tissueHealth <= 0) {
    handleDefeat(level);
  }
}

function drawField() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 1; i < 6; i += 1) {
    ctx.fillRect(0, (canvas.height / 6) * i, canvas.width, 1);
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,255,204,0.08)";
  ctx.fillRect(0, 0, canvas.width / 2.4, canvas.height);
  ctx.restore();

  if (state.abilityStatus.slimeActive > 0) {
    const strength = state.abilityStatus.slimeActive / fieldAbilities.slime.duration;
    const alpha = 0.12 + 0.18 * strength;
    ctx.fillStyle = `rgba(102, 255, 204, ${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  state.immuneUnits.forEach((unit) => {
    ctx.fillStyle = unit.color;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(unit.x - 16, unit.y - 20, 32, 6);
    ctx.fillStyle = "#15ffb0";
    ctx.fillRect(
      unit.x - 16,
      unit.y - 20,
      32 * (unit.hp / immuneCatalog[unit.id].hp),
      6
    );
  });

  state.virusUnits.forEach((virus) => {
    ctx.fillStyle = virus.color;
    ctx.beginPath();
    ctx.rect(virus.x - 12, virus.y - 12, 24, 24);
    ctx.fill();
    ctx.fillStyle = "#ffdeeb";
    ctx.fillRect(virus.x - 14, virus.y + 14, 28, 4);
    ctx.fillStyle = "#ff007f";
    ctx.fillRect(
      virus.x - 14,
      virus.y + 14,
      28 * (virus.hp / virusCatalog[virus.type].hp),
      4
    );
  });

  state.projectiles.forEach((proj) => {
    ctx.strokeStyle = proj.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(proj.x, proj.y);
    ctx.lineTo(
      proj.x - (proj.target ? proj.target.x - proj.x : 0) * 0.1,
      proj.y - (proj.target ? proj.target.y - proj.y : 0) * 0.1
    );
    ctx.stroke();
  });
}

function gameLoop(timestamp) {
  if (!state.lastTimestamp) {
    state.lastTimestamp = timestamp;
  }
  const elapsed = Math.max((timestamp - state.lastTimestamp) / 1000, 0);
  const delta = Math.min(elapsed, 0.05);
  state.lastTimestamp = timestamp;

  tickAbilityTimers(elapsed);
  handleCombat(delta);
  cleanupUnits();
  updateLevel(delta);
  updateHUD();
  updateAbilityButtons();
  drawField();

  requestAnimationFrame(gameLoop);
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  deployUnit({ x, y });
});

unitPanel?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-unit]");
  if (button) {
    selectUnit(button.dataset.unit);
  }
});

levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const levelId = button.dataset.levelTrigger;
    if (levelId) {
      startLevel(levelId);
    }
  });
});

retryButton?.addEventListener("click", () => {
  if (state.currentLevelId) {
    startLevel(state.currentLevelId);
  } else {
    hideOutcomePanel();
  }
});

levelSelectButton?.addEventListener("click", () => {
  hideOutcomePanel();
  setStartButtonsDisabled(false);
  setGameStage(GameStages.PREPARING);
  startPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
});

if (slimeButton) {
  slimeButton.addEventListener("click", activateSlime);
}

if (sneezeButton) {
  sneezeButton.addEventListener("click", activateSneeze);
}

selectUnit("macrophage");
syncLevelUnlocks();
setGameStage(GameStages.PREPARING);
updateHUD();
updateAbilityButtons();
logEvent("Welcome Commander. Choose a scenario to begin.");
requestAnimationFrame(gameLoop);
