/* До сирен — фан-трибьют.
   Джейсон Вурхиз, Майкл Майерс и образ из «Крика» принадлежат законным правообладателям.
   Карта Клён-Хилл и правила этой ночи — оригинальные. */
"use strict";

const T = 44;
const COLS = 36;
const ROWS = 54;
const WORLD_W = COLS * T;
const WORLD_H = ROWS * T;
const POLICE_START = 120;
const SAVE_KEY = "dosiren-v1";

const F_GRASS = 0, F_WOOD = 1, F_MARBLE = 2, F_ROAD = 3, F_WATER = 4;
const F_CARPET = 5, F_TILE = 6, F_CORN = 7, F_PORCH = 8;

const CHARS = {
  michael: { name: "Майкл", role: "Спринтер", color: "#3c6ea5", hair: "#161616", speed: 128, hp: 2, repair: 1, sense: 1, stamina: 0.82, blurb: "Самый быстрый. Рывок кончается раньше." },
  alice: { name: "Алиса", role: "Слух", color: "#c56b8c", hair: "#6a3318", speed: 108, hp: 2, repair: 1, sense: 1.58, stamina: 1, blurb: "Слышит шаги гораздо дальше остальных." },
  daniel: { name: "Дэнил", role: "Руки", color: "#d0863c", hair: "#24180f", speed: 100, hp: 3, repair: 1.5, sense: 1, stamina: 1.08, blurb: "Держит три удара и быстрее чинит щитки." },
  sarah: { name: "Сара", role: "Бот", color: "#6d8f5c", hair: "#111111", speed: 110, hp: 2, repair: 1.12, sense: 1.12, stamina: 1, blurb: "" },
  jake: { name: "Джейк", role: "Бот", color: "#8d6a45", hair: "#3a2818", speed: 106, hp: 2, repair: 1.08, sense: 1, stamina: 1, blurb: "" },
};

const KILLERS = {
  jason: { name: "Джейсон Вурхиз", ability: "Ярость", speed: 102, blurb: "Тяжёлый. В ярости быстрее, ломает двери почти сразу и бьёт на две раны. Чувствует всех, пока ярость не спадёт." },
  myers: { name: "Майкл Майерс", ability: "Взгляд", speed: 114, blurb: "Тихий. Удерживай взгляд на человеке вдалеке — потом один удар решает. Почти без сердцебиения, пока не сорвётся." },
  scream: { name: "Крик", ability: "Плащ", speed: 130, blurb: "Пропадает. Под плащом метит того, на кого смотрит: меченый падает с первого удара." },
};

const ITEMS = [
  { id: "med", name: "Аптечка", price: 40, desc: "Одна перевязка за ночь. Закрывает одну рану." },
  { id: "light", name: "Фонарь", price: 50, desc: "Свет дальше, чем карманный." },
  { id: "map", name: "План участка", price: 45, desc: "Миникарта. Киллер виден, если он рядом или шумит." },
  { id: "shoes", name: "Кроссовки", price: 70, desc: "Чуть выше скорость всю ночь." },
  { id: "flare", name: "Петарда", price: 80, desc: "Один раз. Оглушает киллера, если он в упор." },
];

const $ = (id) => document.getElementById(id);

let solid, floors, deco, doors, gens, hides, lights, props, patrol;
let actors = [];
let player = null;
let mode = "lobby";
let police = POLICE_START;
let camX = 0, camY = 0, shake = 0;
let noiseX = 0, noiseY = 0, noiseT = 0;
let toast = "";
let toastT = 0;
let matchToken = 0;
let youKiller = false;
let personaId = "jason";
let particles = [];
let keys = new Set();
let joyOn = false, jx = 0, jy = 0, joyPtr = -1;
let actionHeld = false, altHeld = false;
let actionEdge = false, altEdge = false, attackEdge = false;
let eWas = false, fWas = false, spaceWas = false;
let viewW = 360, viewH = 640, dpr = 1;
let actx = null, drone = null;
let heartAcc = 0;
let lastTs = 0, acc = 0;
let revealTimer = 0;

const canvas = $("c");
const ctx = canvas.getContext("2d");
const mini = $("mini");
const mctx = mini.getContext("2d");
const lightCanvas = document.createElement("canvas");
const lctx = lightCanvas.getContext("2d");

function defaultSave() {
  return {
    v: 1, coins: 60, character: "michael", sound: true, nights: 0, wins: 0,
    owned: { med: false, light: false, map: false, shoes: false, flare: false },
    equipped: { med: false, light: false, map: false, shoes: false, flare: false },
  };
}
let save = loadSave();

function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!raw || raw.v !== 1) return defaultSave();
    return Object.assign(defaultSave(), raw, {
      owned: Object.assign(defaultSave().owned, raw.owned || {}),
      equipped: Object.assign(defaultSave().equipped, raw.equipped || {}),
    });
  } catch {
    return defaultSave();
  }
}
function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function showFatal(msg) {
  const el = $("fatal");
  el.style.display = "block";
  el.textContent = String(msg);
  try { parent.postMessage({ type: "dosiren-error", msg: String(msg) }, "*"); } catch { /* standalone */ }
}
window.addEventListener("error", (e) => showFatal(e.message || e.error));

function rand(a, b) { return a + Math.random() * (b - a); }
function irand(n) { return (Math.random() * n) | 0; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = irand(i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function inb(x, y) { return x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1; }
function tileOf(v) { return clamp(Math.floor(v / T), 0, 999); }

function buildWorld() {
  solid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  floors = Array.from({ length: ROWS }, () => Array(COLS).fill(F_GRASS));
  deco = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  doors = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        solid[y][x] = 1;
        deco[y][x] = "hedge";
      }
    }
  }
  carveRoom(5, 1, 24, 16, F_MARBLE, "wallm");
  openTile(23, 16, F_MARBLE);
  openTile(24, 16, F_MARBLE);
  vwall(13, 2, 8, "wallm"); openTile(13, 5, F_WOOD);
  vwall(20, 2, 8, "wallm"); openTile(20, 6, F_CARPET);
  hwall(6, 9, 22, "wallm"); openTile(10, 9, F_MARBLE); openTile(24, 9, F_TILE);
  fillFloor(6, 2, 7, 7, F_WOOD);
  fillFloor(21, 2, 7, 7, F_CARPET);
  fillFloor(6, 10, 7, 5, F_CARPET);
  fillFloor(21, 10, 7, 5, F_TILE);
  addDoor(13, 5, true);
  addDoor(20, 6, false);
  addDoor(10, 9, true);
  addDoor(24, 9, false);

  for (let x = 2; x <= 21; x++) { setFence(x, 29); setFence(x, 51); }
  for (let y = 29; y <= 51; y++) { setFence(2, y); setFence(21, y); }

  carveRoom(4, 31, 12, 12, F_WOOD, "wallh");
  openTile(8, 42, F_WOOD);
  openTile(9, 42, F_PORCH);
  openTile(15, 36, F_WOOD);
  hwall(5, 36, 10, "wallh");
  openTile(8, 36, F_WOOD);
  addDoor(8, 42, true);
  addDoor(9, 42, false);
  addDoor(15, 36, true);
  addDoor(8, 36, false);
  for (let x = 6; x <= 11; x++) {
    if (!solid[43][x]) floors[43][x] = F_PORCH;
  }

  clearGate(21, 40);
  clearGate(21, 41);

  for (let y = 17; y <= 52; y++) {
    for (let x = 23; x <= 26; x++) {
      solid[y][x] = 0;
      floors[y][x] = F_ROAD;
      deco[y][x] = "";
    }
  }

  for (let y = 20; y <= 25; y++) {
    for (let x = 29; x <= 33; x++) {
      solid[y][x] = 1;
      floors[y][x] = F_WATER;
      deco[y][x] = "pool";
    }
  }

  for (let y = 32; y <= 50; y++) {
    for (let x = 28; x <= 34; x++) {
      if (x === 0 || x === COLS - 1 || y === ROWS - 1) continue;
      if (deco[y][x] === "hedge" || deco[y][x] === "pool") continue;
      floors[y][x] = F_CORN;
      if (y % 2 === 0 && x % 3 !== 1) {
        solid[y][x] = 1;
        deco[y][x] = "corn";
      } else {
        solid[y][x] = 0;
        deco[y][x] = "";
      }
    }
  }

  [[12, 22], [13, 22], [12, 23]].forEach(([x, y]) => {
    if (floors[y][x] === F_GRASS) {
      solid[y][x] = 1;
      deco[y][x] = "fountain";
    }
  });

  [[8, 20], [11, 26], [16, 19], [18, 24], [7, 27], [20, 21], [4, 12], [30, 28], [15, 27]].forEach(([x, y]) => {
    if (!solid[y][x] && floors[y][x] === F_GRASS) {
      solid[y][x] = 1;
      deco[y][x] = "tree";
    }
  });

  const place = (tx, ty, kind) => {
    const n = nearestOpen(tx, ty);
    return { kind, tx: n.x, ty: n.y, x: n.x * T + T / 2, y: n.y * T + T / 2 };
  };
  hides = [
    place(7, 3, "closet"), place(23, 3, "bed"), place(8, 12, "closet"), place(16, 12, "bed"),
    place(6, 33, "closet"), place(12, 33, "bed"), place(7, 40, "closet"),
    place(10, 46, "bush"), place(17, 46, "bush"), place(18, 34, "bush"),
    place(30, 36, "corn"), place(31, 44, "corn"),
  ];
  gens = [place(23, 12, "gen"), place(7, 39, "gen")].map((g, i) => ({
    ...g,
    progress: 0,
    done: false,
    name: i === 0 ? "Щиток особняка" : "Щиток дома",
  }));
  props = [
    place(24, 48, "mailbox"), place(8, 46, "swing"), place(16, 47, "grill"),
    place(18, 44, "hoop"), place(24, 30, "truck"),
  ];
  lights = [
    { x: 16 * T, y: 12 * T, r: 170, col: "255,206,140" },
    { x: 24 * T, y: 12 * T, r: 110, col: "255,196,120" },
    { x: 9 * T, y: 34 * T, r: 120, col: "255,186,110" },
    { x: 10 * T, y: 46 * T, r: 90, col: "255,170,90" },
    { x: 31 * T, y: 22 * T, r: 120, col: "140,210,220" },
  ];
  patrol = [
    place(16, 12, "p"), place(14, 24, "p"), place(11, 46, "p"),
    place(30, 40, "p"), place(24, 36, "p"), place(3, 22, "p"),
  ];
  assertConnected();
}

function carveRoom(x, y, w, h, floor, wall) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j;
      if (!inb(X, Y)) continue;
      const border = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      if (border) { solid[Y][X] = 1; deco[Y][X] = wall; }
      else { solid[Y][X] = 0; floors[Y][X] = floor; deco[Y][X] = ""; }
    }
  }
}
function fillFloor(x, y, w, h, floor) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j;
    if (inb(X, Y) && !solid[Y][X]) floors[Y][X] = floor;
  }
}
function vwall(x, y, h, d) {
  for (let j = 0; j < h; j++) if (inb(x, y + j)) { solid[y + j][x] = 1; deco[y + j][x] = d; }
}
function hwall(x, y, w, d) {
  for (let i = 0; i < w; i++) if (inb(x + i, y)) { solid[y][x + i] = 1; deco[y][x + i] = d; }
}
function openTile(x, y, floor) {
  if (!inb(x, y)) return;
  solid[y][x] = 0;
  deco[y][x] = "";
  if (floor) floors[y][x] = floor;
}
function setFence(x, y) {
  if (!inb(x, y)) return;
  const d = deco[y][x];
  if (d === "wallh" || d === "wallm" || d === "hedge") return;
  const f = floors[y][x];
  if (f === F_WOOD || f === F_MARBLE || f === F_TILE || f === F_CARPET || f === F_PORCH) return;
  solid[y][x] = 1;
  deco[y][x] = "fence";
}
function clearGate(x, y) {
  solid[y][x] = 0;
  deco[y][x] = "";
  floors[y][x] = F_GRASS;
}
function addDoor(x, y, closed) {
  openTile(x, y, floors[y][x] === F_GRASS ? F_WOOD : floors[y][x]);
  doors.push({
    tx: x, ty: y, x: x * T + T / 2, y: y * T + T / 2,
    state: closed ? "closed" : "open", breakP: 0,
  });
}
function nearestOpen(tx, ty) {
  let best = { x: 1, y: 1 }, bd = 1e9;
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
    if (solid[y][x]) continue;
    const d = Math.abs(x - tx) + Math.abs(y - ty);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
function assertConnected() {
  let open = 0;
  const seen = new Uint8Array(COLS * ROWS);
  let sx = 2, sy = 2;
  const start = nearestOpen(2, 20);
  sx = start.x; sy = start.y;
  const q = [[sx, sy]];
  seen[sy * COLS + sx] = 1;
  let reach = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!solid[y][x]) open++;
  for (let qi = 0; qi < q.length; qi++) {
    const x = q[qi][0], y = q[qi][1];
    reach++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || solid[ny][nx]) continue;
      const i = ny * COLS + nx;
      if (seen[i]) continue;
      seen[i] = 1;
      q.push([nx, ny]);
    }
  }
  if (reach !== open) throw new Error("Карта разорвана: " + reach + "/" + open);
}

function doorAt(x, y) {
  for (const d of doors) if (d.tx === x && d.ty === y) return d;
  return null;
}
function bodyBlocked(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  if (solid[y][x]) return true;
  const d = doorAt(x, y);
  return !!(d && d.state === "closed");
}
function sightBlocked(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  if (solid[y][x]) return true;
  const d = doorAt(x, y);
  return !!(d && d.state === "closed");
}
function hitsWorld(a) {
  const r = 12;
  const x0 = Math.floor((a.x - r) / T), x1 = Math.floor((a.x + r) / T);
  const y0 = Math.floor((a.y - r) / T), y1 = Math.floor((a.y + r) / T);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!bodyBlocked(x, y)) continue;
    const nx = clamp(a.x, x * T, x * T + T);
    const ny = clamp(a.y, y * T, y * T + T);
    const dx = a.x - nx, dy = a.y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
function los(a, b) {
  if (b.hiding && dist(a, b) > 40) return false;
  const steps = Math.ceil(dist(a, b) / 12);
  for (let i = 1; i < steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps;
    const y = a.y + (b.y - a.y) * i / steps;
    if (sightBlocked(Math.floor(x / T), Math.floor(y / T))) return false;
  }
  return true;
}
function terrorOf(k) {
  if (!k || k.shroud > 0) return 0;
  if (k.persona === "myers") return k.evil > 0 ? 260 : 88;
  if (k.persona === "jason") return 210;
  return 165;
}
function killer() {
  for (const a of actors) if (a.kind === "killer") return a;
  return null;
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function astar(sx, sy, gx, gy) {
  const s = nearestOpen(sx, sy);
  const g0 = nearestOpen(gx, gy);
  sx = s.x; sy = s.y; gx = g0.x; gy = g0.y;
  const key = (x, y) => x + y * COLS;
  const gScore = new Map([[key(sx, sy), 0]]);
  const prev = new Map();
  const open = [[sx, sy]];
  const seen = new Set();
  let guard = 0;
  while (open.length && guard++ < 4000) {
    let bi = 0, best = 1e9;
    for (let i = 0; i < open.length; i++) {
      const [x, y] = open[i];
      const f = (gScore.get(key(x, y)) || 0) + Math.abs(x - gx) + Math.abs(y - gy);
      if (f < best) { best = f; bi = i; }
    }
    const cur = open.splice(bi, 1)[0];
    const [x, y] = cur;
    const k = key(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    if (x === gx && y === gy) {
      const path = [];
      let ck = k;
      const startK = key(sx, sy);
      let g2 = 0;
      while (ck !== startK && g2++ < 800) {
        const px = ck % COLS, py = (ck / COLS) | 0;
        path.push({ x: px * T + T / 2, y: py * T + T / 2 });
        ck = prev.get(ck);
        if (ck == null) break;
      }
      path.reverse();
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || solid[ny][nx]) continue;
      const nk = key(nx, ny);
      const ng = (gScore.get(k) || 0) + 1;
      if (ng < (gScore.get(nk) ?? 1e9)) {
        gScore.set(nk, ng);
        prev.set(nk, k);
        open.push([nx, ny]);
      }
    }
  }
  return [];
}

function worldFromTile(tx, ty) {
  const n = nearestOpen(tx, ty);
  return { x: n.x * T + T / 2, y: n.y * T + T / 2 };
}

function setupMatch() {
  buildWorld();
  particles = [];
  police = POLICE_START;
  noiseT = 0;
  shake = 0;
  const params = new URLSearchParams(location.search);
  const force = params.get("role");
  youKiller = force === "killer" ? true : force === "survivor" ? false : Math.random() < 0.22;
  const fk = params.get("killer");
  personaId = KILLERS[fk] ? fk : ["jason", "myers", "scream"][irand(3)];
  const picked = CHARS[save.character] ? save.character : "michael";
  const rest = shuffle(["michael", "alice", "daniel", "sarah", "jake"].filter((id) => id !== picked));
  const spots = shuffle([
    worldFromTile(8, 4), worldFromTile(16, 12), worldFromTile(8, 34), worldFromTile(10, 46),
  ]);
  const kSpot = worldFromTile(3, 20);
  actors = [];
  if (!youKiller) actors.push(makeSurvivor(picked, spots.pop(), false));
  else actors.push(makeKiller(personaId, kSpot, false));
  const botIds = youKiller ? rest.slice(0, 4) : rest.slice(0, 3);
  for (const id of botIds) actors.push(makeSurvivor(id, spots.pop() || worldFromTile(16, 24), true));
  if (!youKiller) actors.push(makeKiller(personaId, kSpot, true));
  player = actors[0];
  const k = killer();
  $("reveal-kicker").textContent = youKiller ? "Роль выпала" : "Клён-Хилл · Огайо";
  $("reveal-title").textContent = youKiller ? "ТЫ\nКИЛЛЕР" : "ТЫ\nЖИВОЙ";
  $("reveal-title").style.whiteSpace = "pre-line";
  if (youKiller) {
    $("reveal-text").textContent = KILLERS[personaId].name + ". " + KILLERS[personaId].blurb + " Не оставь никого к сиренам.";
  } else {
    $("reveal-text").textContent = "Ты — " + player.name + ". Где-то здесь " + KILLERS[personaId].name + ". Доживи до сирен. Два щитка зовут полицию раньше. Прячься и захлопывай двери.";
  }
  toast = youKiller ? "Не дай им дождаться сирен" : "Дождись сирен";
  toastT = 3.2;
  k.abilityCd = 2.2;
}

function makeSurvivor(id, spot, bot) {
  const c = CHARS[id];
  const shoes = !bot && save.equipped.shoes && save.owned.shoes;
  return {
    kind: "survivor", bot, id, name: c.name, color: c.color, hair: c.hair,
    x: spot.x, y: spot.y, facing: rand(-1, 1),
    hp: c.hp, maxHp: c.hp, alive: true,
    speed: c.speed * (shoes ? 1.12 : 1),
    sense: c.sense, repair: c.repair, stamina: 1, staminaMax: c.stamina,
    hiding: null, hideT: 0, iFrame: 0, exposed: 0, stun: 0,
    step: rand(0, 6), vx: 0, vy: 0, sprinting: false,
    path: null, pathAge: 9, pathI: 0, fear: 0, wander: null, stuckT: 0, lastX: spot.x, lastY: spot.y,
    med: !bot && save.equipped.med && save.owned.med ? 1 : 0,
    flare: !bot && save.equipped.flare && save.owned.flare ? 1 : 0,
    light: !bot && save.equipped.light && save.owned.light,
    map: !bot && save.equipped.map && save.owned.map,
    healing: 0,
  };
}
function makeKiller(persona, spot, bot) {
  const k = KILLERS[persona];
  return {
    kind: "killer", bot, persona, name: k.name,
    x: spot.x, y: spot.y, facing: 0,
    hp: 99, maxHp: 99, alive: true, speed: k.speed,
    step: 0, stun: 0, atkCd: 0, atkAnim: 0,
    abilityCd: 2, rage: 0, evil: 0, stalk: 0, stalking: false, shroud: 0, markT: 0,
    vx: 0, vy: 0, kills: 0, searchT: 0,
    path: null, pathAge: 9, pathI: 0, patrolI: 0, stuckT: 0, lastX: spot.x, lastY: spot.y,
    sprinting: false,
  };
}

function moveDir(a, dx, dy, dt, wantSprint) {
  const len = Math.hypot(dx, dy);
  if (len < 0.001 || a.stun > 0) { a.vx = 0; a.vy = 0; a.sprinting = false; return; }
  const throttle = Math.min(1, len);
  dx /= len; dy /= len;
  let sp = a.speed * throttle;
  const sprint = !!(wantSprint && a.kind === "survivor" && a.stamina > 0.05);
  if (sprint) {
    sp *= 1.34;
    a.stamina = Math.max(0, a.stamina - dt * 0.36);
    a.sprinting = true;
    noiseX = a.x; noiseY = a.y; noiseT = 1.15;
  } else {
    a.sprinting = false;
    if (a.kind === "survivor") a.stamina = Math.min(1, a.stamina + dt * 0.22 * (a.staminaMax || 1));
  }
  const tx = Math.floor(a.x / T), ty = Math.floor(a.y / T);
  if (floors[ty] && floors[ty][tx] === F_CORN) sp *= 0.74;
  if (a.kind === "killer") {
    if (a.rage > 0) sp *= 1.4;
    if (a.evil > 0) sp *= 1.26;
    if (a.stalking) sp *= 0.7;
  }
  a.facing = Math.atan2(dy, dx);
  a.step += dt * sp * 0.11;
  a.vx = dx * sp;
  a.vy = dy * sp;
  const ox = a.x, oy = a.y;
  const mx = dx * sp * dt, my = dy * sp * dt;
  a.x += mx;
  if (hitsWorld(a)) a.x -= mx;
  a.y += my;
  if (hitsWorld(a)) a.y -= my;
  a.x = clamp(a.x, T, WORLD_W - T);
  a.y = clamp(a.y, T, WORLD_H - T);
  if (Math.hypot(a.x - ox, a.y - oy) < 0.35) { a.vx = 0; a.vy = 0; }
}

function goToward(a, tx, ty, dt, sprint) {
  a.pathAge = (a.pathAge || 9) + dt;
  const goalMoved = !a.goal || Math.hypot(a.goal.x - tx, a.goal.y - ty) > 56;
  if (!a.path || a.pathAge > 0.6 || goalMoved) {
    a.goal = { x: tx, y: ty };
    a.path = astar(Math.floor(a.x / T), Math.floor(a.y / T), Math.floor(tx / T), Math.floor(ty / T));
    a.pathAge = 0;
    a.pathI = 0;
  }
  const path = a.path;
  if (!path || !path.length) { moveDir(a, tx - a.x, ty - a.y, dt, sprint); return; }
  while (a.pathI < path.length - 1 && Math.hypot(path[a.pathI].x - a.x, path[a.pathI].y - a.y) < 18) a.pathI++;
  const wp = path[Math.min(a.pathI, path.length - 1)];
  moveDir(a, wp.x - a.x, wp.y - a.y, dt, sprint);
}

function noteStuck(a, dt) {
  const moved = Math.hypot(a.x - a.lastX, a.y - a.lastY);
  a.stuckT = moved < 10 * dt ? (a.stuckT || 0) + dt : 0;
  a.lastX = a.x; a.lastY = a.y;
  if (a.stuckT > 0.9) {
    a.path = null;
    a.pathAge = 9;
    a.stuckT = 0;
    const n = nearestOpen(Math.floor(a.x / T) + irand(7) - 3, Math.floor(a.y / T) + irand(7) - 3);
    a.wander = { x: n.x * T + T / 2, y: n.y * T + T / 2 };
  }
}
function separate(a, dt) {
  if (a.hiding) return;
  for (const b of actors) {
    if (b === a || !b.alive || b.hiding) continue;
    let dx = a.x - b.x, dy = a.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < 24) {
      const push = (24 - d) * 3.2 * dt;
      dx /= d; dy /= d;
      a.x += dx * push;
      if (hitsWorld(a)) a.x -= dx * push;
      a.y += dy * push;
      if (hitsWorld(a)) a.y -= dy * push;
    }
  }
}

function nearestDoor(a, r) {
  let best = null, bd = r;
  for (const d of doors) {
    const dd = dist(a, d);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
function nearestHideSpot(a, r) {
  let best = null, bd = r;
  for (const h of hides) {
    const dd = Math.hypot(a.x - h.x, a.y - h.y);
    if (dd < bd) { bd = dd; best = h; }
  }
  return best;
}
function nearestGen(a, r) {
  let best = null, bd = r;
  for (const g of gens) {
    if (g.done) continue;
    const dd = Math.hypot(a.x - g.x, a.y - g.y);
    if (dd < bd) { bd = dd; best = g; }
  }
  return best;
}
function hideTaken(h, self) {
  return actors.some((o) => o !== self && o.alive && o.hiding === h);
}

function contextOf(a) {
  if (!a.alive) return null;
  if (a.hiding) return "leave";
  if (a.kind === "killer") return "attack";
  const d = nearestDoor(a, 42);
  if (d && d.state !== "broken") return d.state === "open" ? "slam" : "open";
  if (nearestHideSpot(a, 36) && !hideTaken(nearestHideSpot(a, 36), a)) return "hide";
  const g = nearestGen(a, 46);
  if (g) return "repair";
  const k = killer();
  if (a.flare > 0 && k && dist(a, k) < 82) return "flare";
  if (a.med > 0 && a.hp < a.maxHp) return "heal";
  return null;
}
const LABELS = {
  hide: "ПРЯТАТЬСЯ", leave: "ВЫЙТИ", open: "ОТКРЫТЬ", slam: "ЗАХЛОП",
  repair: "ЧИНИТЬ", heal: "БИНТ", flare: "ПЕТАРДА", attack: "УДАР",
};

function toggleDoor(a) {
  const d = nearestDoor(a, 46);
  if (!d || d.state === "broken") return;
  d.state = d.state === "open" ? "closed" : "open";
  d.breakP = 0;
  blip(d.state === "closed" ? 180 : 240, 0.07, "square", 0.05);
}
function doHide(a) {
  const h = nearestHideSpot(a, 42);
  if (!h || hideTaken(h, a)) return;
  a.hiding = h;
  a.x = h.x; a.y = h.y;
  a.hideT = 0;
  a.vx = 0; a.vy = 0;
}
function doFlare(a) {
  const k = killer();
  if (!k || a.flare <= 0 || dist(a, k) > 86) return;
  a.flare = 0;
  k.stun = 2.35;
  k.rage = 0;
  k.shroud = 0;
  k.stalking = false;
  shake = 9;
  blip(520, 0.12, "sawtooth", 0.08);
  burst(k.x, k.y, "#e2a15a", 14);
}
function repairTick(a, dt) {
  const g = nearestGen(a, 48);
  if (!g) return;
  g.progress += dt * 0.15 * (a.repair || 1) * (a.bot ? 0.62 : 1);
  if (Math.random() < dt * 6) blip(90 + g.progress * 80, 0.03, "square", 0.03);
  if (g.progress >= 1) {
    g.progress = 1;
    g.done = true;
    police = Math.max(12, police - 28);
    toast = g.name + " ожил";
    toastT = 1.6;
    blip(660, 0.12, "square", 0.06);
  }
}
function healTick(a, dt) {
  a.healing += dt;
  if (a.healing >= 1.45) {
    a.hp = Math.min(a.maxHp, a.hp + 1);
    a.med = 0;
    a.healing = 0;
    blip(480, 0.1, "sine", 0.05);
  }
}

function triggerAbility(k) {
  if (k.abilityCd > 0 || k.stun > 0 || k.persona === "myers") return;
  if (k.persona === "jason") { k.rage = 4.6; k.abilityCd = 18; blip(90, 0.2, "sawtooth", 0.07); }
  if (k.persona === "scream") { k.shroud = 6; k.abilityCd = 17; k.markT = 0; blip(700, 0.08, "sine", 0.04); }
}
function lookTarget(k, range) {
  let best = null, bd = range;
  for (const s of actors) {
    if (s.kind !== "survivor" || !s.alive || s.hiding) continue;
    const d = dist(k, s);
    if (d > bd || !los(k, s)) continue;
    const ang = Math.atan2(s.y - k.y, s.x - k.x);
    let diff = Math.atan2(Math.sin(ang - k.facing), Math.cos(ang - k.facing));
    if (Math.abs(diff) > 0.65) continue;
    bd = d; best = s;
  }
  return best;
}
function tryAttack(k) {
  if (k.atkCd > 0 || k.stun > 0 || !k.alive) return;
  k.atkCd = k.persona === "jason" ? 0.95 : 0.82;
  k.atkAnim = 0.16;
  blip(140, 0.06, "sawtooth", 0.05);
  let hit = null, bd = 54;
  for (const s of actors) {
    if (s.kind !== "survivor" || !s.alive) continue;
    const d = dist(k, s);
    const limit = s.hiding ? 38 : 54;
    if (d > limit) continue;
    const ang = Math.atan2(s.y - k.y, s.x - k.x);
    const diff = Math.abs(Math.atan2(Math.sin(ang - k.facing), Math.cos(ang - k.facing)));
    if (diff > 1.05 && d > 30) continue;
    if (d < bd) { bd = d; hit = s; }
  }
  if (hit) hitSurvivor(hit, k);
}
function hitSurvivor(s, k) {
  if (s.iFrame > 0 || !s.alive) return;
  let dmg = 1;
  if (k.persona === "jason" && k.rage > 0) dmg = 2;
  if (k.persona === "myers" && k.evil > 0) dmg = 99;
  if (s.exposed > 0) dmg = 99;
  s.hp -= dmg;
  s.exposed = 0;
  s.iFrame = 0.45;
  s.hiding = null;
  const ang = Math.atan2(s.y - k.y, s.x - k.x);
  s.x += Math.cos(ang) * 16;
  s.y += Math.sin(ang) * 16;
  if (hitsWorld(s)) { s.x -= Math.cos(ang) * 16; s.y -= Math.sin(ang) * 16; }
  burst(s.x, s.y, "#7a1e1e", 8);
  shake = Math.max(shake, s === player || k === player ? 8 : 3);
  blip(70, 0.1, "square", 0.08);
  if (navigator.vibrate && (s === player || k === player)) navigator.vibrate(30);
  if (s.hp <= 0) {
    s.hp = 0;
    s.alive = false;
    k.kills = (k.kills || 0) + 1;
    toast = s.name + " больше не ответит";
    toastT = 1.5;
    burst(s.x, s.y, "#3a1010", 16);
  }
}

function tickKillerPowers(k, dt) {
  if (k.atkCd > 0) k.atkCd -= dt;
  if (k.atkAnim > 0) k.atkAnim -= dt;
  if (k.abilityCd > 0) k.abilityCd -= dt;
  if (k.rage > 0) k.rage -= dt;
  if (k.evil > 0) k.evil -= dt;
  if (k.shroud > 0) k.shroud -= dt;
  if (k.stun > 0) k.stun -= dt;
  if (k.stalking && k.evil <= 0 && k.abilityCd <= 0) {
    const target = lookTarget(k, 280);
    if (target && dist(k, target) > 54) {
      k.stalk = Math.min(1, k.stalk + dt * 0.3);
      if (k.stalk >= 1) {
        k.evil = 7.2;
        k.stalk = 0;
        k.abilityCd = 14;
        k.stalking = false;
        blip(50, 0.25, "sine", 0.08);
      }
    } else k.stalk = Math.max(0, k.stalk - dt * 0.12);
  } else if (!k.stalking) k.stalk = Math.max(0, k.stalk - dt * 0.18);
  if (k.shroud > 0) {
    const t = lookTarget(k, 230);
    if (t) {
      k.markT += dt;
      if (k.markT > 1.15) { t.exposed = 9; k.markT = 0; toast = t.name + " под меткой"; toastT = 1.2; }
    } else k.markT = Math.max(0, k.markT - dt);
  }
  const door = nearestDoor(k, 36);
  if (door && door.state === "closed") {
    let rate = k.persona === "jason" ? 1.35 : 0.72;
    if (k.rage > 0) rate = 5;
    door.breakP += dt * rate;
    if (door.breakP >= 1) {
      door.state = "broken";
      door.breakP = 1;
      blip(80, 0.08, "square", 0.05);
    }
  }
}

function updateSurvivorBot(b, dt) {
  if (!b.alive) return;
  if (b.iFrame > 0) b.iFrame -= dt;
  if (b.hiding) {
    b.hideT += dt;
    const k = killer();
    if (k && dist(b, k) > 300 && b.hideT > 2.4) b.hiding = null;
    return;
  }
  const k = killer();
  const d = k ? dist(b, k) : 9999;
  const hear = k ? terrorOf(k) * b.sense : 0;
  const danger = k && k.stun <= 0 && d < Math.max(150, hear) && (los(b, k) || d < 70) && k.shroud <= 0;
  if (danger && d < 210) {
    const h = nearestHideSpot(b, 110);
    if (h && d < 130 && !hideTaken(h, b)) {
      goToward(b, h.x, h.y, dt, true);
      if (Math.hypot(b.x - h.x, b.y - h.y) < 28) doHide(b);
    } else {
      const ang = Math.atan2(b.y - k.y, b.x - k.x);
      goToward(b, clamp(b.x + Math.cos(ang) * 140, T, WORLD_W - T), clamp(b.y + Math.sin(ang) * 140, T, WORLD_H - T), dt, d < 150);
    }
    botDoors(b, dt);
    return;
  }
  const g = gens.filter((x) => !x.done).sort((a, c) => dist(b, a) - dist(b, c))[0];
  if (g) {
    if (dist(b, g) > 40) goToward(b, g.x, g.y, dt, false);
    else repairTick(b, dt);
    botDoors(b, dt);
    return;
  }
  if (!b.wander || dist(b, b.wander) < 24) {
    const n = nearestOpen(irand(COLS - 2) + 1, irand(ROWS - 2) + 1);
    b.wander = { x: n.x * T + T / 2, y: n.y * T + T / 2 };
  }
  goToward(b, b.wander.x, b.wander.y, dt, false);
  botDoors(b, dt);
}
function botDoors(a, dt) {
  const d = nearestDoor(a, 34);
  if (!d || d.state !== "closed") return;
  if (a.kind === "survivor") d.state = "open";
  else {
    d.breakP += dt * (a.rage > 0 ? 4 : 1);
    if (d.breakP >= 1) d.state = "broken";
  }
}
function chooseTarget(k) {
  let best = null, score = 1e9;
  for (const s of actors) {
    if (s.kind !== "survivor" || !s.alive) continue;
    const d = dist(k, s);
    const seen = !s.hiding && d < 320 && los(k, s);
    const closeHide = s.hiding && d < 42;
    const heard = !s.hiding && d < 120;
    if (!(seen || closeHide || heard)) continue;
    const sc = d - (s.exposed > 0 ? 90 : 0) - (s.hp < s.maxHp ? 24 : 0);
    if (sc < score) { score = sc; best = s; }
  }
  return best;
}
function updateKillerBot(k, dt) {
  if (k.stun > 0) { k.vx = 0; k.vy = 0; return; }
  const target = chooseTarget(k);
  if (k.persona === "jason" && target && dist(k, target) < 160 && k.abilityCd <= 0) triggerAbility(k);
  if (k.persona === "scream" && k.shroud <= 0 && k.abilityCd <= 0 && target && dist(k, target) > 70 && dist(k, target) < 280) triggerAbility(k);
  if (k.persona === "myers") {
    k.stalking = !!(target && k.evil <= 0 && dist(k, target) > 64 && dist(k, target) < 300 && los(k, target));
  }
  if (target) {
    const d = dist(k, target);
    if (d < (target.hiding ? 40 : 50)) tryAttack(k);
    else goToward(k, target.x, target.y, dt, false);
  } else if (noiseT > 0) {
    goToward(k, noiseX, noiseY, dt, false);
  } else {
    const p = patrol[k.patrolI % patrol.length];
    if (dist(k, p) < 36) k.patrolI++;
    goToward(k, p.x, p.y, dt, false);
  }
  botDoors(k, dt);
}

function inputVec() {
  if (joyOn) {
    const len = Math.hypot(jx, jy);
    if (len < 0.18) return { x: 0, y: 0 };
    return { x: jx / len, y: jy / len, mag: Math.min(1, len) };
  }
  let x = 0, y = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
  return { x, y, mag: Math.hypot(x, y) > 0 ? 1 : 0 };
}
function consumeEdges() {
  const e = keys.has("KeyE"), f = keys.has("KeyF"), s = keys.has("Space");
  if (e && !eWas) actionEdge = true;
  if (f && !fWas) altEdge = true;
  if (s && !spaceWas) attackEdge = true;
  eWas = e; fWas = f; spaceWas = s;
}

function updatePlayer(dt) {
  const p = player;
  if (!p.alive) { p.vx = 0; p.vy = 0; return; }
  if (p.iFrame > 0) p.iFrame -= dt;
  if (p.exposed > 0) p.exposed -= dt;
  if (p.hiding) {
    if (actionEdge) p.hiding = null;
    p.vx = 0; p.vy = 0;
    return;
  }
  if (p.stun > 0) { p.stun -= dt; p.vx = 0; p.vy = 0; return; }
  const v = inputVec();
  const sprint = p.kind === "survivor" && (altHeld || keys.has("ShiftLeft") || keys.has("ShiftRight"));
  if (v.mag > 0) moveDir(p, v.x * v.mag, v.y * v.mag, dt, sprint);
  else {
    p.vx = 0; p.vy = 0; p.sprinting = false;
    if (p.kind === "survivor") p.stamina = Math.min(1, p.stamina + dt * 0.22 * (p.staminaMax || 1));
  }
  if (p.kind === "killer") {
    tickKillerPowers(p, dt);
    if (p.persona === "myers") p.stalking = altHeld || keys.has("KeyF");
    else if (altEdge) triggerAbility(p);
    if (attackEdge || actionEdge) tryAttack(p);
  } else {
    const ctxA = contextOf(p);
    const hold = actionHeld || keys.has("KeyE");
    if (ctxA === "repair" && hold) repairTick(p, dt);
    else if (ctxA === "heal" && hold) healTick(p, dt);
    else p.healing = 0;
    if (actionEdge) {
      if (ctxA === "hide") doHide(p);
      else if (ctxA === "open" || ctxA === "slam") toggleDoor(p);
      else if (ctxA === "flare") doFlare(p);
    }
  }
}

function update(dt) {
  if (mode !== "play") return;
  consumeEdges();
  police -= dt;
  if (noiseT > 0) noiseT -= dt;
  if (toastT > 0) toastT -= dt;
  for (const a of actors) {
    if (a.bot && a.kind === "survivor") updateSurvivorBot(a, dt);
    else if (a.bot && a.kind === "killer") updateKillerBot(a, dt);
    else updatePlayer(dt);
    if (a.bot) noteStuck(a, dt);
    if (a !== player) {
      if (a.iFrame > 0 && a.kind === "killer") a.iFrame -= dt;
    }
    separate(a, dt);
  }
  const k = killer();
  if (k && k.bot) tickKillerPowers(k, dt);
  for (const s of actors) if (s.kind === "survivor" && s.exposed > 0 && s !== player) s.exposed -= dt;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  actionEdge = false; altEdge = false; attackEdge = false;
  audioTick(dt);
  updateHud();
  checkEnd();
}

function checkEnd() {
  if (mode !== "play") return;
  const aliveS = actors.filter((a) => a.kind === "survivor" && a.alive);
  if (player.kind === "survivor" && !player.alive) return finish(false, "Тебя нашли раньше сирен.");
  if (player.kind === "killer" && aliveS.length === 0) return finish(true, "На участке тихо. Полиции некого спасать.");
  if (police <= 0) {
    if (player.kind === "survivor") return finish(true, "Сирены на Коламбус-роуд. Полиция Клён-Хилл забирает живых.");
    const left = aliveS.length;
    return finish(false, left ? "Полиция уже во дворе. Ушли живыми: " + left + "." : "Все лежат — но сирены всё равно приехали.");
  }
}

function award(win) {
  let c = 10;
  const kills = killer()?.kills || 0;
  if (player.kind === "survivor" && win) c = 42 + gens.filter((g) => g.done).length * 12;
  else if (player.kind === "killer" && win) c = 52 + kills * 8;
  else if (player.kind === "killer") c = 14 + kills * 6;
  else c = POLICE_START - police > 45 ? 16 : 8;
  save.coins += c;
  save.nights = (save.nights || 0) + 1;
  if (win) save.wins = (save.wins || 0) + 1;
  persist();
  return c;
}
function finish(win, line) {
  if (mode === "result") return;
  mode = "result";
  const coins = award(win);
  $("result-title").textContent = win ? "НОЧЬ ТВОЯ" : "НОЧЬ ЗАБРАЛА";
  $("result-line").textContent = line;
  $("result-coins").textContent = "+" + coins + " монет";
  const k = killer();
  $("result-note").textContent = "Киллер ночи: " + (k ? k.name : "—") + ". Фан-трибьют, права у законных владельцев.";
  $("result").classList.add("on");
  $("controls").style.display = "none";
  if (win) blip(520, 0.18, "sawtooth", 0.05);
  paintLobbyBits();
}

function updateHud() {
  const sec = Math.max(0, Math.ceil(police));
  $("timer").textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  const done = gens.filter((g) => g.done).length;
  $("gens").textContent = "Щитки " + done + "/2";
  if (player.kind === "survivor") {
    $("hearts").textContent = "♥".repeat(Math.max(0, player.hp)) + "·".repeat(Math.max(0, player.maxHp - player.hp));
    $("meter-label").textContent = "Рывок";
    $("meter-fill").style.width = (player.stamina * 100) + "%";
    $("meter-fill").className = "";
    const ctxA = contextOf(player);
    $("btn-main").textContent = LABELS[ctxA] || "—";
    $("btn-alt").textContent = "Рывок";
  } else {
    $("hearts").textContent = player.name.split(" ")[0];
    const k = player;
    $("meter-label").textContent = k.persona === "myers" ? "Взгляд" : k.persona === "jason" ? (k.rage > 0 ? "Ярость" : "Ярость ждёт") : (k.shroud > 0 ? "Плащ" : "Плащ ждёт");
    let w = 0;
    if (k.persona === "myers") w = k.evil > 0 ? k.evil / 7.2 : k.stalk;
    else if (k.persona === "jason") w = k.rage > 0 ? k.rage / 4.6 : 1 - Math.min(1, k.abilityCd / 18);
    else w = k.shroud > 0 ? k.shroud / 6 : 1 - Math.min(1, k.abilityCd / 17);
    $("meter-fill").style.width = (clamp(w, 0, 1) * 100) + "%";
    $("meter-fill").className = "blood";
    $("btn-main").textContent = "УДАР";
    $("btn-alt").textContent = KILLERS[k.persona].ability;
  }
  $("toast").textContent = toastT > 0 ? toast : "";
  const showMini = player.kind === "killer" || player.map;
  mini.style.display = showMini ? "block" : "none";
}

function resize() {
  const r = $("app").getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  viewW = r.width;
  viewH = r.height;
  canvas.width = Math.max(1, Math.floor(viewW * dpr));
  canvas.height = Math.max(1, Math.floor(viewH * dpr));
  lightCanvas.width = canvas.width;
  lightCanvas.height = canvas.height;
  mini.width = 92 * dpr;
  mini.height = 120 * dpr;
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);
  if (!player || (mode !== "play" && mode !== "result")) {
    ctx.fillStyle = "#07080a";
    ctx.fillRect(0, 0, viewW, viewH);
    return;
  }
  const tx = clamp(player.x - viewW / 2, 0, Math.max(0, WORLD_W - viewW));
  const ty = clamp(player.y - viewH * 0.46, 0, Math.max(0, WORLD_H - viewH));
  camX += (tx - camX) * 0.18;
  camY += (ty - camY) * 0.18;
  ctx.save();
  if (shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake *= 0.86;
  }
  ctx.translate(-camX, -camY);
  const x0 = Math.max(0, Math.floor(camX / T) - 1);
  const y0 = Math.max(0, Math.floor(camY / T) - 1);
  const x1 = Math.min(COLS - 1, Math.ceil((camX + viewW) / T) + 1);
  const y1 = Math.min(ROWS - 1, Math.ceil((camY + viewH) / T) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (solid[y][x] && deco[y][x] !== "pool") continue;
      drawFloor(x, y);
    }
  }
  drawProps();
  for (const g of gens) drawGen(g);
  for (const h of hides) drawHide(h);
  for (const d of doors) drawDoor(d);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!solid[y][x]) continue;
      drawSolid(x, y);
    }
  }
  const order = actors.slice().sort((a, b) => a.y - b.y);
  for (const a of order) drawActor(a);
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawDark();
  if (police < 14 && mode === "play") {
    ctx.fillStyle = Math.floor(performance.now() / 180) % 2 === 0 ? "rgba(40,70,180,.14)" : "rgba(160,30,30,.14)";
    ctx.fillRect(0, 0, viewW, viewH);
  }
  if ((player.kind === "killer" || player.map) && mode === "play") drawMini();
}

function drawFloor(x, y) {
  const f = floors[y][x];
  const n = hash(x, y);
  let col = "#1a3326";
  if (f === F_GRASS) col = n > 0.5 ? "#1a3326" : "#14281e";
  else if (f === F_WOOD) col = n > 0.5 ? "#4a3426" : "#3d2b20";
  else if (f === F_MARBLE) col = n > 0.7 ? "#3e4650" : "#343a42";
  else if (f === F_ROAD) col = "#2a2926";
  else if (f === F_WATER) col = "#143e48";
  else if (f === F_CARPET) col = n > 0.5 ? "#4a2432" : "#3e1d2b";
  else if (f === F_TILE) col = (x + y) % 2 ? "#243330" : "#2c3c38";
  else if (f === F_CORN) col = n > 0.5 ? "#3a4a18" : "#314014";
  else if (f === F_PORCH) col = "#3a3128";
  ctx.fillStyle = col;
  ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
  if (f === F_ROAD && x === 24) {
    ctx.fillStyle = "rgba(226,161,90,.35)";
    ctx.fillRect(x * T + T / 2 - 1, y * T + 8, 2, 10);
  }
  if (f === F_WATER) {
    ctx.fillStyle = "rgba(180,230,230,.18)";
    ctx.beginPath();
    ctx.ellipse(x * T + T / 2, y * T + T / 2, 10, 4, n * 3, 0, 7);
    ctx.fill();
  }
}
function drawSolid(x, y) {
  const d = deco[y][x];
  const px = x * T, py = y * T;
  if (d === "pool") { drawFloor(x, y); return; }
  if (d === "tree") {
    ctx.fillStyle = "#24160f";
    ctx.fillRect(px + 18, py + 20, 8, 16);
    ctx.fillStyle = hash(x, y) > 0.5 ? "#1d3a24" : "#16321c";
    ctx.beginPath();
    ctx.arc(px + T / 2, py + 16, 16, 0, 7);
    ctx.fill();
    return;
  }
  if (d === "fountain") {
    ctx.fillStyle = "#6d7074";
    ctx.beginPath();
    ctx.arc(px + T / 2, py + T / 2, 16, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#7eb8c4";
    ctx.beginPath();
    ctx.arc(px + T / 2, py + T / 2, 8, 0, 7);
    ctx.fill();
    return;
  }
  if (d === "corn") {
    ctx.fillStyle = "#243610";
    ctx.fillRect(px, py, T, T);
    ctx.strokeStyle = "#6a8030";
    ctx.lineWidth = 2;
    for (let i = 6; i < T; i += 8) {
      ctx.beginPath();
      ctx.moveTo(px + i, py + T);
      ctx.lineTo(px + i + 2, py + 6);
      ctx.stroke();
    }
    return;
  }
  let top = "#3a403f", face = "#222624";
  if (d === "wallm") { top = "#6a7078"; face = "#3c4148"; }
  else if (d === "wallh") { top = "#7a6552"; face = "#3e3228"; }
  else if (d === "fence") { top = "#8a734c"; face = "#4a3b28"; }
  else if (d === "hedge") { top = "#1c3a22"; face = "#102616"; }
  const lip = d === "fence" ? 6 : d === "hedge" ? 8 : 12;
  ctx.fillStyle = top;
  ctx.fillRect(px, py - lip * 0.3, T + 0.5, T);
  ctx.fillStyle = face;
  ctx.fillRect(px, py + T - lip, T + 0.5, lip);
}
function drawDoor(d) {
  if (d.state === "open") return;
  ctx.fillStyle = d.state === "broken" ? "#2a2018" : "#6a4e34";
  ctx.fillRect(d.tx * T + 6, d.ty * T + 4, T - 12, T - 8);
  if (d.state === "closed") {
    ctx.fillStyle = "#e2a15a";
    ctx.fillRect(d.x + 6, d.y - 2, 3, 3);
    if (d.breakP > 0) {
      ctx.fillStyle = "#c44b3c";
      ctx.fillRect(d.tx * T + 6, d.ty * T + T - 6, (T - 12) * d.breakP, 3);
    }
  }
}
function drawHide(h) {
  const x = h.x, y = h.y;
  if (h.kind === "closet") {
    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(x - 12, y - 14, 24, 26);
    ctx.strokeStyle = "#c8b090";
    ctx.strokeRect(x - 12, y - 14, 24, 26);
  } else if (h.kind === "bed") {
    ctx.fillStyle = "#6a3038";
    ctx.fillRect(x - 16, y - 10, 32, 20);
    ctx.fillStyle = "#efe6d6";
    ctx.fillRect(x - 14, y - 8, 12, 8);
  } else if (h.kind === "bush") {
    ctx.fillStyle = "#1e4628";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#2f6a38";
    ctx.beginPath();
    ctx.arc(x - 6, y - 2, 8, 0, 7);
    ctx.fill();
  }
}
function drawGen(g) {
  ctx.fillStyle = g.done ? "#245c38" : "#2a2418";
  ctx.fillRect(g.x - 12, g.y - 10, 24, 20);
  ctx.strokeStyle = g.done ? "#8fd0a0" : "#e2a15a";
  ctx.strokeRect(g.x - 12, g.y - 10, 24, 20);
  ctx.fillStyle = "#e2a15a";
  ctx.fillRect(g.x - 10, g.y + 4, 20 * (g.done ? 1 : g.progress), 3);
}
function drawProps() {
  for (const p of props) {
    if (p.kind === "mailbox") {
      ctx.fillStyle = "#6e747c";
      ctx.fillRect(p.x, p.y, 4, 16);
      ctx.fillStyle = "#1d4e89";
      ctx.fillRect(p.x - 8, p.y - 6, 16, 8);
    } else if (p.kind === "swing") {
      ctx.strokeStyle = "#6a5a48";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y + 10);
      ctx.lineTo(p.x - 8, p.y - 16);
      ctx.lineTo(p.x + 8, p.y - 16);
      ctx.lineTo(p.x + 14, p.y + 10);
      ctx.moveTo(p.x - 4, p.y - 16);
      ctx.lineTo(p.x - 4, p.y + 2);
      ctx.moveTo(p.x + 4, p.y - 16);
      ctx.lineTo(p.x + 4, p.y + 2);
      ctx.stroke();
      ctx.fillStyle = "#8e2f2f";
      ctx.fillRect(p.x - 8, p.y + 2, 16, 4);
    } else if (p.kind === "grill") {
      ctx.fillStyle = "#2a2c30";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 12, 7, 0, 0, 7);
      ctx.fill();
      ctx.fillRect(p.x - 2, p.y, 4, 12);
    } else if (p.kind === "hoop") {
      ctx.strokeStyle = "#d0d4dc";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, 8, 0, 7);
      ctx.stroke();
      ctx.fillStyle = "#8a8e96";
      ctx.fillRect(p.x - 1, p.y - 8, 3, 22);
    } else if (p.kind === "truck") {
      ctx.fillStyle = "#6a2a28";
      ctx.fillRect(p.x - 20, p.y - 8, 28, 16);
      ctx.fillStyle = "#1a1c20";
      ctx.fillRect(p.x + 8, p.y - 6, 14, 14);
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(p.x - 10, p.y + 8, 4, 0, 7);
      ctx.arc(p.x + 12, p.y + 8, 4, 0, 7);
      ctx.fill();
    }
  }
}
function drawActor(a) {
  if (!a.alive && a.kind === "killer") return;
  const k = killer();
  if (a.hiding && a !== player) {
    if (player.kind === "killer" && dist(player, a) > 42) return;
  }
  if (a.kind === "killer" && a.shroud > 0 && player.kind === "survivor" && player !== a && dist(player, a) > 78) return;
  const sx = a.x, sy = a.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.globalAlpha = !a.alive ? 0.4 : a.hiding ? 0.45 : 1;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 11, 5, 0, 0, 7);
  ctx.fill();
  ctx.rotate(a.facing);
  const bob = Math.sin(a.step) * 2;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(-8, -5 + bob, 5, 4);
  ctx.fillRect(-8, 2 - bob, 5, 4);
  if (a.kind === "killer") ctx.fillStyle = a.persona === "jason" ? "#1c3a2c" : a.persona === "myers" ? "#1a1c24" : "#0c0c10";
  else ctx.fillStyle = a.color;
  roundRect(ctx, -6, -7, 14, 14, 4);
  ctx.fill();
  ctx.fillStyle = a.kind === "killer" ? "#e6e1d8" : skin(a);
  ctx.beginPath();
  ctx.arc(9, 0, 6.2, 0, 7);
  ctx.fill();
  if (a.kind === "survivor") {
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(9, -2, 6.2, Math.PI, 0);
    ctx.fill();
  } else drawMask(a);
  if (a.kind === "killer") {
    ctx.strokeStyle = "#d5d8dc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const ext = a.atkAnim > 0 ? 26 : 20;
    ctx.moveTo(12, 4);
    ctx.lineTo(ext, 7);
    ctx.stroke();
  }
  if (a.iFrame > 0.2) {
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.beginPath();
    ctx.arc(2, 0, 12, 0, 7);
    ctx.fill();
  }
  ctx.restore();
  if (a.alive && (!a.hiding || a === player || player.kind === "survivor")) {
    const near = dist(player, a) < 110;
    if (a === player || a.kind === "killer" || near) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = a.kind === "killer" ? "#e07070" : "#f0e2c8";
      ctx.font = "12px Palatino, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(a === player ? a.name : a.name, sx, sy - 20);
      if (a.kind === "survivor" && (a === player || a.hp < a.maxHp || a.exposed > 0)) {
        ctx.fillStyle = a.exposed > 0 ? "#ff5a4a" : "#e2a15a";
        ctx.font = "11px Palatino, Georgia, serif";
        ctx.fillText("♥".repeat(Math.max(0, a.hp)), sx, sy - 32);
      }
    }
  }
  ctx.globalAlpha = 1;
}
function skin() { return "#e0b394"; }
function drawMask(a) {
  if (a.persona === "jason") {
    ctx.fillStyle = "#f4f4f2";
    ctx.beginPath();
    ctx.arc(9, 0, 6.2, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(6, -2, 2, 2);
    ctx.fillRect(11, -2, 2, 2);
    ctx.fillStyle = "#8e2f2f";
    ctx.fillRect(8, 2, 3, 2);
  } else if (a.persona === "myers") {
    ctx.fillStyle = "#f7f7f5";
    ctx.beginPath();
    ctx.arc(9, 0, 6.2, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(5, -6, 8, 4);
    ctx.fillStyle = "#222";
    ctx.fillRect(6.5, -1, 2, 3);
    ctx.fillRect(11, -1, 2, 3);
  } else {
    ctx.fillStyle = "#f4f4f4";
    ctx.beginPath();
    ctx.ellipse(10, 0, 5, 8, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(8, -1, 1.4, 2.2, 0, 0, 7);
    ctx.ellipse(12, -1, 1.4, 2.2, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, 4, 2.2, 3, 0, 0, 7);
    ctx.fill();
  }
}
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) particles.push({
    x, y, vx: rand(-70, 70), vy: rand(-70, 70), life: rand(0.25, 0.5), color,
  });
  if (particles.length > 80) particles.splice(0, particles.length - 80);
}

function drawDark() {
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.clearRect(0, 0, viewW, viewH);
  lctx.fillStyle = police < 14 ? "rgba(8,10,20,.62)" : "rgba(3,6,14,.74)";
  lctx.fillRect(0, 0, viewW, viewH);
  lctx.globalCompositeOperation = "destination-out";
  const punch = (wx, wy, r, power) => {
    const sx = wx - camX, sy = wy - camY;
    if (sx < -r || sy < -r || sx > viewW + r || sy > viewH + r) return;
    const g = lctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r);
    g.addColorStop(0, "rgba(0,0,0," + power + ")");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.arc(sx, sy, r, 0, 7);
    lctx.fill();
  };
  for (const L of lights) punch(L.x, L.y, L.r, 0.9);
  const pr = player.kind === "killer" ? 180 : player.light ? 250 : 156;
  punch(player.x, player.y, pr, 1);
  if (player.kind === "survivor") {
    const k = killer();
    if (k && k.shroud <= 0) punch(k.x, k.y, 70, 0.55);
  }
  lctx.globalCompositeOperation = "source-over";
  ctx.drawImage(lightCanvas, 0, 0, viewW, viewH);
}

function drawMini() {
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.clearRect(0, 0, 92, 120);
  mctx.fillStyle = "rgba(8,12,10,.8)";
  mctx.fillRect(0, 0, 92, 120);
  const sx = 92 / WORLD_W, sy = 120 / WORLD_H;
  mctx.fillStyle = "#3a4038";
  for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) {
    if (!solid[y][x]) continue;
    mctx.fillRect(x * T * sx, y * T * sy, Math.max(1, T * sx), Math.max(1, T * sy));
  }
  const k = killer();
  for (const a of actors) {
    if (!a.alive) continue;
    if (a.hiding && player.kind === "killer" && a !== player) {
      const show = (player.rage > 0 || player.evil > 0 || a.exposed > 0);
      if (!show) continue;
    }
    if (a.kind === "killer" && player.kind === "survivor" && !player.map) continue;
    if (a.kind === "killer" && player.kind === "survivor") {
      const hear = terrorOf(k) * player.sense;
      if (dist(player, a) > hear && noiseT <= 0) continue;
    }
    mctx.fillStyle = a.kind === "killer" ? "#e07070" : a === player ? "#f0e2c8" : "#8fd0a0";
    mctx.fillRect(a.x * sx - 1.5, a.y * sy - 1.5, 3, 3);
  }
}

function blip(freq, dur, type, gain) {
  if (!save.sound || !actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(actx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.stop(actx.currentTime + dur);
}
function ensureAudio() {
  if (!save.sound) return;
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
  }
  if (actx.state === "suspended") actx.resume();
}
function audioStart() {
  ensureAudio();
  if (!actx || drone) return;
  drone = actx.createOscillator();
  const g = actx.createGain();
  drone.type = "sine";
  drone.frequency.value = 52;
  g.gain.value = 0.015;
  drone.connect(g);
  g.connect(actx.destination);
  drone.start();
  drone._g = g;
}
function audioStop() {
  if (drone) { try { drone.stop(); } catch { /* already */ } drone = null; }
}
function audioTick(dt) {
  if (!actx || player.kind !== "survivor" || !player.alive) return;
  const k = killer();
  if (!k) return;
  const d = dist(player, k);
  const hear = terrorOf(k) * player.sense;
  if (d < hear && hear > 0) {
    heartAcc += dt;
    const closeness = 1 - d / hear;
    const interval = 0.92 - closeness * 0.62;
    if (heartAcc > interval) {
      heartAcc = 0;
      blip(62, 0.08, "sine", 0.05 + closeness * 0.08);
    }
  }
}

function show(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.remove("on");
  $(id).classList.add("on");
}
function paintLobbyBits() {
  $("coin-pill").textContent = String(save.coins);
  $("who-pill").textContent = CHARS[save.character].name;
  $("record").textContent = "Ночей: " + (save.nights || 0) + " · дождался: " + (save.wins || 0);
  $("sound").textContent = "Звук: " + (save.sound ? "вкл" : "выкл");
}
function renderShop() {
  $("shop-coins").textContent = "Монеты: " + save.coins + ". Покупается один раз, надевается на ночь.";
  const list = $("shop-list");
  list.innerHTML = "";
  for (const item of ITEMS) {
    const owned = !!save.owned[item.id];
    const eq = !!save.equipped[item.id];
    const card = document.createElement("article");
    card.className = "card";
    const h = document.createElement("h3");
    h.textContent = item.name;
    const btn = document.createElement("button");
    btn.className = "buy" + (eq ? " on" : "");
    btn.type = "button";
    if (!owned) {
      btn.textContent = item.price + " мон.";
      btn.disabled = save.coins < item.price;
      btn.onclick = () => {
        if (save.coins < item.price) return;
        save.coins -= item.price;
        save.owned[item.id] = true;
        save.equipped[item.id] = true;
        persist();
        paintLobbyBits();
        renderShop();
      };
    } else {
      btn.textContent = eq ? "Надето" : "Надеть";
      btn.onclick = () => {
        save.equipped[item.id] = !save.equipped[item.id];
        persist();
        renderShop();
      };
    }
    const p = document.createElement("p");
    p.textContent = item.desc;
    card.append(h, btn, p);
    list.append(card);
  }
}
function renderChars() {
  const list = $("char-list");
  list.innerHTML = "";
  for (const id of ["michael", "alice", "daniel"]) {
    const c = CHARS[id];
    const card = document.createElement("article");
    card.className = "card";
    const h = document.createElement("h3");
    h.textContent = c.name + " · " + c.role;
    const sw = document.createElement("i");
    sw.className = "swatch";
    sw.style.background = c.color;
    const btn = document.createElement("button");
    btn.className = "buy" + (save.character === id ? " on" : "");
    btn.type = "button";
    btn.textContent = save.character === id ? "Выбран" : "Выбрать";
    btn.onclick = () => { save.character = id; persist(); paintLobbyBits(); renderChars(); };
    const p = document.createElement("p");
    p.textContent = c.blurb;
    card.append(h, sw, btn, p);
    list.append(card);
  }
}

function beginMatch() {
  ensureAudio();
  const token = ++matchToken;
  setupMatch();
  $("result").classList.remove("on");
  $("controls").style.display = "";
  show("screen-reveal");
  mode = "reveal";
  const go = () => {
    if (token !== matchToken || mode !== "reveal") return;
    mode = "play";
    show("screen-play");
    resize();
    camX = player.x - viewW / 2;
    camY = player.y - viewH * 0.46;
    lastTs = 0;
    acc = 0;
    audioStart();
    updateHud();
  };
  clearTimeout(revealTimer);
  revealTimer = setTimeout(go, 2400);
  $("screen-reveal").onclick = () => { clearTimeout(revealTimer); go(); };
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (!lastTs) lastTs = ts;
  let dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  if (mode === "play") {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 4) {
      update(1 / 60);
      acc -= 1 / 60;
      steps++;
    }
  }
  if (mode === "play" || mode === "result") render();
}

function boot() {
  try { buildWorld(); }
  catch (err) { showFatal(err && err.stack ? err.stack : err); return; }
  paintLobbyBits();
  renderShop();
  renderChars();
  resize();
  requestAnimationFrame(loop);

  $("play").onclick = () => beginMatch();
  $("to-shop").onclick = () => { renderShop(); show("screen-shop"); };
  $("to-chars").onclick = () => { renderChars(); show("screen-chars"); };
  $("shop-back").onclick = () => show("screen-lobby");
  $("char-back").onclick = () => show("screen-lobby");
  $("open-rights").onclick = () => $("rights").classList.add("on");
  $("rights-back").onclick = () => $("rights").classList.remove("on");
  $("sound").onclick = () => {
    save.sound = !save.sound;
    persist();
    paintLobbyBits();
    if (!save.sound) audioStop();
  };
  $("quit").onclick = () => {
    if (mode !== "play") return;
    finish(false, player.kind === "killer" ? "Ты снял маску и ушёл." : "Ты выбежал на дорогу раньше полиции.");
  };
  $("again").onclick = () => beginMatch();
  $("to-lobby").onclick = () => {
    mode = "lobby";
    audioStop();
    show("screen-lobby");
    paintLobbyBits();
  };

  const joy = $("joy"), knob = $("knob");
  const setJoy = (clientX, clientY) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let x = clientX - cx, y = clientY - cy;
    const max = r.width * 0.36;
    const len = Math.hypot(x, y) || 1;
    const cl = Math.min(len, max);
    const nx = x / len * cl, ny = y / len * cl;
    jx = nx / max; jy = ny / max;
    knob.style.transform = "translate(" + nx + "px," + ny + "px)";
  };
  joy.addEventListener("pointerdown", (e) => {
    joy.setPointerCapture(e.pointerId);
    joyPtr = e.pointerId;
    joyOn = true;
    setJoy(e.clientX, e.clientY);
    e.preventDefault();
  });
  joy.addEventListener("pointermove", (e) => {
    if (e.pointerId !== joyPtr) return;
    setJoy(e.clientX, e.clientY);
  });
  const endJoy = (e) => {
    if (e.pointerId !== joyPtr) return;
    joyOn = false; jx = 0; jy = 0; joyPtr = -1;
    knob.style.transform = "translate(0px,0px)";
  };
  joy.addEventListener("pointerup", endJoy);
  joy.addEventListener("pointercancel", endJoy);

  const bindHold = (el, which) => {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      ensureAudio();
      if (which === "main") { actionHeld = true; actionEdge = true; if (player && player.kind === "killer") attackEdge = true; }
      else { altHeld = true; altEdge = true; }
    });
  };
  bindHold($("btn-main"), "main");
  bindHold($("btn-alt"), "alt");
  window.addEventListener("pointerup", () => { actionHeld = false; altHeld = false; });
  window.addEventListener("pointercancel", () => { actionHeld = false; altHeld = false; });

  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "Enter" && mode === "reveal") $("screen-reveal").click();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => { keys.clear(); joyOn = false; actionHeld = false; altHeld = false; });
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("resize", resize);

  const params = new URLSearchParams(location.search);
  if (params.get("autostart") === "1") beginMatch();

  window.__dosiren = {
    beginMatch,
    get mode() { return mode; },
    get player() { return player; },
    get actors() { return actors; },
    get gens() { return gens; },
  };
  window.__controlsTest = {
    setKeys(list) {
      keys.clear();
      joyOn = false;
      for (const k of list || []) keys.add(k);
    },
    getSpeed() { return Math.hypot(player?.vx || 0, player?.vy || 0); },
    getPos() { return { x: player ? player.x : 0, y: player ? player.y : 0 }; },
  };
}

boot();
