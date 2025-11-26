const canvas = document.getElementById("battlefield");
const ctx = canvas.getContext("2d");

const massValue = document.getElementById("mass-value");
const healthValue = document.getElementById("health-value");
const infectionValue = document.getElementById("infection-value");
const selectedUnitLabel = document.getElementById("selected-unit");
const startButton = document.getElementById("start-button");
const unitPanel = document.querySelector(".unit-grid");
const logList = document.getElementById("event-log");

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
};

const waves = [
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
};

function resetState() {
  state.running = true;
  state.immuneUnits = [];
  state.virusUnits = [];
  state.projectiles = [];
  state.cellularMass = 50;
  state.tissueHealth = 100;
  state.infection = 5;
  state.waveIndex = 0;
  state.waveTimer = 0;
  state.spawnTimer = 0;
  state.lastTimestamp = performance.now();
  state.logHistory = [];
  logEvent("Scenario online: Runny Nose infiltration detected.");
  startButton.disabled = true;
}

function selectUnit(unitId) {
  if (!immuneCatalog[unitId]) {
    return;
  }
  state.selectedUnit = unitId;
  selectedUnitLabel.textContent = immuneCatalog[unitId].name;
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
  const unit = {
    ...blueprint,
    x: Math.min(Math.max(position.x, 40), canvas.width / 2),
    y: Math.min(Math.max(position.y, 20), canvas.height - 20),
    hp: blueprint.hp,
    cooldown: 0,
  };
  state.immuneUnits.push(unit);
  logEvent(`${blueprint.name} deployed.`);
}

function spawnVirus(typeId) {
  const blueprint = virusCatalog[typeId];
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

function updateHUD() {
  massValue.textContent = Math.floor(state.cellularMass);
  healthValue.textContent = `${Math.max(state.tissueHealth, 0).toFixed(0)}%`;
  infectionValue.textContent = `${Math.min(state.infection, 100).toFixed(0)}%`;
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

  state.virusUnits.forEach((virus) => {
    const blocker = state.immuneUnits.find(
      (unit) => Math.hypot(virus.x - unit.x, virus.y - unit.y) < 25
    );
    if (blocker) {
      blocker.hp -= virus.damage * delta;
      virus.hp -= blocker.damage * delta * 0.5;
      return;
    }
    virus.x -= virus.speed * delta;
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
  state.cellularMass += state.passiveGain * delta;
  state.infection += state.virusUnits.length * state.infectionRate * delta;
  state.tissueHealth = Math.min(Math.max(state.tissueHealth, 0), 100);
  state.infection = Math.min(Math.max(state.infection, 0), 100);

  const wave = waves[state.waveIndex];
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
    logEvent("Rhinovirus suppressed. Nasal tissue stabilizing.");
    state.running = false;
    startButton.disabled = false;
  }

  if (state.tissueHealth <= 0 || state.infection >= 100) {
    logEvent("Infection overwhelms the tissue. Mission failed.");
    state.running = false;
    startButton.disabled = false;
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
  const delta = Math.min((timestamp - state.lastTimestamp) / 1000, 0.05);
  state.lastTimestamp = timestamp;

  handleCombat(delta);
  cleanupUnits();
  updateLevel(delta);
  updateHUD();
  drawField();

  requestAnimationFrame(gameLoop);
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  deployUnit({ x, y });
});

unitPanel.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-unit]");
  if (button) {
    selectUnit(button.dataset.unit);
  }
});

startButton.addEventListener("click", () => {
  if (!state.running) {
    resetState();
  }
});

selectUnit("macrophage");
updateHUD();
logEvent("Welcome Commander. Press Start to begin.");
requestAnimationFrame(gameLoop);
