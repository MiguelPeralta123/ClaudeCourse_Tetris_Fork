'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_KEY = 'tetris-skin';

// Color order: null, I, O, T, S, Z, J, L, Nut
const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#0000ff', '#C0C0C0'],
    drawCell(context, x, y, s, color) {
      context.fillStyle = color;
      context.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * s + 1, y * s + 1, s - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00fff0', '#fff200', '#d000ff', '#39ff14', '#ff2a6d', '#2a7fff', '#ff9f1c', '#e0e0ff'],
    drawCell(context, x, y, s, color) {
      context.save();
      context.shadowColor = color;
      context.shadowBlur = s;
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.strokeRect(x * s + 3, y * s + 3, s - 6, s - 6);
      context.strokeRect(x * s + 3, y * s + 3, s - 6, s - 6);
      context.shadowBlur = s / 3;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1;
      context.strokeRect(x * s + 5, y * s + 5, s - 10, s - 10);
      context.restore();
    },
  },
  pastel: {
    colors: [null, '#a8e6cf', '#fff3b0', '#d7b8f3', '#b5ead7', '#ffb7b2', '#b5d8f7', '#ffd6a5', '#e4e4ec'],
    drawCell(context, x, y, s, color) {
      const px = x * s + 1, py = y * s + 1, w = s - 2, r = s * 0.25;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(px + r, py);
      context.arcTo(px + w, py, px + w, py + w, r);
      context.arcTo(px + w, py + w, px, py + w, r);
      context.arcTo(px, py + w, px, py, r);
      context.arcTo(px, py, px + w, py, r);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px + 4, py + 4, w - 8, 3);
    },
  },
  pixel: {
    colors: [null, '#2ec4b6', '#f9c74f', '#9b5de5', '#43aa8b', '#f94144', '#577590', '#f3722c', '#adb5bd'],
    drawCell(context, x, y, s, color) {
      const px = x * s + 1, py = y * s + 1, w = s - 2, u = Math.max(2, Math.floor(w / 5));
      context.fillStyle = color;
      context.fillRect(px, py, w, w);
      context.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i * u < w; i++)
        for (let j = 0; j * u < w; j++)
          if ((i + j) % 2) context.fillRect(px + i * u, py + j * u, Math.min(u, w - i * u), Math.min(u, w - j * u));
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, w, 2);
      context.fillRect(px, py, 2, w);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + w - 2, w, 2);
      context.fillRect(px + w - 2, py, 2, w);
    },
  },
};

let skin = 'retro';
let COLORS = SKINS[skin].colors;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (gameOver) return;
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].drawCell(context, x, y, size, COLORS[colorIndex]);
  context.globalAlpha = 1;
}

function setSkin(name) {
  skin = SKINS[name] ? name : 'retro';
  COLORS = SKINS[skin].colors;
  document.documentElement.setAttribute('data-skin', skin);
  skinSelect.value = skin;
}

function loadSkin() {
  try {
    return localStorage.getItem(SKIN_KEY);
  } catch {
    return null;
  }
}

function saveSkin() {
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch {
    // storage unavailable: skin still applies for this session
  }
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
  });

  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

skinSelect.addEventListener('change', e => {
  setSkin(e.target.value);
  saveSkin();
  if (current) {
    draw();
    drawNext();
  }
});

setSkin(loadSkin());
init();
