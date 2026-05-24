// === Icon paths ===
const iconFiles = {
  moto: { '#FF4757': 'moto-roja', '#1a1a1a': 'moto-negra', '#4A90D9': 'moto-azul' },
  auto: { '#FF4757': 'auto-rojo', '#1a1a1a': 'auto-negro', '#4A90D9': 'auto-azul' }
};

function vehicleImg(vehicle, color) {
  return `<img class="vehicle-icon" src="assets/icons/${iconFiles[vehicle][color]}.png" alt="${vehicle}">`;
}

// === State ===
const COLORS = ['#FF4757', '#1a1a1a', '#4A90D9'];
let gameMode = '1p';
let selectedVehicle = 'moto';
let p1Color = null;
let p2Color = null;
let selectingFor = 1;

let aiTimeout = null;

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 1;
let gameOver = false;
let scores = { 1: 0, 2: 0 };
let streakCount = 0;
let lastWinner = null;
let movesInGame = 0;
let achievements = {};
let lastMoves = [];
let opponentHadTwo = false;
let totalWins = { 1: 0, 2: 0 };

const vehicleSvg = { moto: (c) => vehicleImg('moto', c), auto: (c) => vehicleImg('auto', c) };
const vehicleNames = { moto: 'Moto', auto: 'Auto' };

// === Screen management ===
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// === Mode selection ===
function selectMode(el) {
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  gameMode = el.dataset.mode;
  resetColorSelection();
}

function resetColorSelection() {
  p1Color = null;
  p2Color = null;
  selectingFor = 1;
  if (gameMode === '1p') {
    document.getElementById('color-label').textContent = 'Elige tu color:';
    document.getElementById('color-hint').textContent = 'La CPU usará otro color';
    renderColorOptions();
  } else {
    renderColorOptions();
  }
  document.getElementById('btn-start').disabled = true;
}

// === Vehicle selection ===
function selectVehicle(el) {
  document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedVehicle = el.dataset.vehicle;
  renderColorOptions();
}

// === Color selection ===
function renderColorOptions() {
  const container = document.getElementById('color-options');
  container.innerHTML = '';
  const usedColors = [p1Color, p2Color].filter(Boolean);

  COLORS.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    if (usedColors.includes(c)) swatch.classList.add('used');
    swatch.style.background = c;
    swatch.dataset.color = c;
    swatch.onclick = () => selectColor(c);
    if (selectingFor === 1 && p1Color === c) swatch.classList.add('selected');
    if (selectingFor === 2 && p2Color === c) swatch.classList.add('selected');
    container.appendChild(swatch);
  });

  const label = document.getElementById('color-label');
  const hint = document.getElementById('color-hint');
  if (gameMode === '1p') {
    label.textContent = p1Color ? '¡Color elegido!' : 'Elige tu color:';
    hint.textContent = p1Color ? 'La CPU usará otro color' : 'Tú eliges primero';
  } else if (selectingFor === 1) {
    label.textContent = 'Jugador 1: elige tu color:';
    hint.textContent = p1Color ? 'Jugador 2 eligiendo...' : 'Tú eliges primero';
  } else {
    label.textContent = 'Jugador 2: elige tu color:';
    hint.textContent = `Jugador 1 usa el color que elegiste`;
  }

  document.getElementById('btn-start').disabled = !(p1Color && p2Color);
}

function selectColor(color) {
  if (selectingFor === 1 && p2Color === color) return;
  if (selectingFor === 2 && p1Color === color) return;

  if (selectingFor === 1) {
    p1Color = color;
    if (gameMode === '1p') {
      p2Color = COLORS.find(c => c !== color);
      selectingFor = 1;
    } else {
      selectingFor = 2;
    }
  } else {
    p2Color = color;
    selectingFor = 1;
  }
  renderColorOptions();

  if (p1Color && p2Color) {
    document.getElementById('btn-start').disabled = false;
  }
}

// === Start game ===
function startGame() {
  showScreen('screen-game');
  document.getElementById('p1-vehicle').innerHTML = vehicleSvg[selectedVehicle](p1Color);
  document.getElementById('p2-vehicle').innerHTML = vehicleSvg[selectedVehicle](p2Color);
  document.getElementById('p1-name').textContent = gameMode === '1p' ? 'Tú' : 'Jugador 1';
  document.getElementById('p2-name').textContent = gameMode === '1p' ? 'CPU' : 'Jugador 2';
  resetBoard();
}

function backToMenu() {
  if (aiTimeout) { clearTimeout(aiTimeout); aiTimeout = null; }
  p1Color = null;
  p2Color = null;
  selectingFor = 1;
  scores = { 1: 0, 2: 0 };
  streakCount = 0;
  lastWinner = null;
  totalWins = { 1: 0, 2: 0 };
  document.getElementById('achievements-panel').classList.remove('open');
  resetColorSelection();
  showScreen('screen-select');
  resetBoard();
}

// === Board ===
function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  board.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'cell' + (cell ? ' taken' : '') + (gameOver ? ' game-over' : '');
    div.dataset.index = i;
    if (cell) {
      const color = cell === 1 ? p1Color : p2Color;
      div.innerHTML = vehicleSvg[selectedVehicle](color);
    }
    div.onclick = () => makeMove(i);
    boardEl.appendChild(div);
  });
}

function makeMove(index, isAi) {
  if (board[index] || gameOver) return;
  if (gameMode === '1p' && currentPlayer === 2 && !isAi) return;

  board[index] = currentPlayer;
  lastMoves.push(index);
  movesInGame++;

  const opponent = currentPlayer === 1 ? 2 : 1;
  if (!opponentHadTwo && hasTwoInARow(opponent)) {
    opponentHadTwo = true;
  }

  renderBoard();
  updateTurnDisplay();

  const winLine = checkWinner();
  if (winLine) {
    handleWin(currentPlayer, winLine);
    return;
  }

  if (movesInGame === 9) {
    handleDraw();
    return;
  }

  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateTurnDisplay();

  if (gameMode === '1p' && currentPlayer === 2 && !gameOver) {
    aiTimeout = setTimeout(aiMove, 600);
  }
}

function aiMove() {
  if (gameOver) return;

  const move = getBestMove();
  if (move !== -1) {
    makeMove(move, true);
  }
}

function getBestMove() {
  const ai = 2;
  const player = 1;
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  // Win if possible
  for (const [a,b,c] of lines) {
    const cells = [board[a], board[b], board[c]];
    const aiCount = cells.filter(v => v === ai).length;
    const empty = cells.map((v,i) => v === '' ? [a,b,c][i] : -1).filter(v => v !== -1);
    if (aiCount === 2 && empty.length === 1) return empty[0];
  }

  // Block player win
  for (const [a,b,c] of lines) {
    const cells = [board[a], board[b], board[c]];
    const playerCount = cells.filter(v => v === player).length;
    const empty = cells.map((v,i) => v === '' ? [a,b,c][i] : -1).filter(v => v !== -1);
    if (playerCount === 2 && empty.length === 1) return empty[0];
  }

  // Take center
  if (board[4] === '') return 4;

  // Take corners
  const corners = [0, 2, 6, 8].filter(i => board[i] === '');
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

  // Take any available
  const available = board.map((v, i) => v === '' ? i : -1).filter(v => v !== -1);
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];

  return -1;
}

function hasTwoInARow(player) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return lines.some(([a,b,c]) => {
    const cells = [board[a], board[b], board[c]];
    const p = cells.filter(v => v === player).length;
    const e = cells.filter(v => v === '').length;
    return p === 2 && e === 1;
  });
}

function checkWinner() {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return [a,b,c];
    }
  }
  return null;
}

function handleWin(player, winLine) {
  gameOver = true;
  scores[player]++;
  totalWins[player]++;

  if (lastWinner === player) {
    streakCount++;
  } else {
    streakCount = 1;
  }
  lastWinner = player;

  // Highlight winning cells
  document.querySelectorAll('.cell').forEach((cell, i) => {
    if (winLine.includes(i)) cell.classList.add('win');
  });

  const winnerName = gameMode === '1p' ? (player === 1 ? 'Tú' : 'CPU') : `Jugador ${player}`;
  document.getElementById('turn-text').textContent = `¡${winnerName} gana!`;
  document.getElementById('turn-indicator').style.display = 'block';
  document.getElementById('turn-text').className = 'highlight';
  document.getElementById('result-text').style.display = 'none';

  // Update scores
  document.getElementById('p1-score').textContent = scores[1];
  document.getElementById('p2-score').textContent = scores[2];

  // Check achievements
  checkAchievements(player, winLine);

  // Confetti
  startConfetti();

  // Toast
  showToast(`¡${winnerName} gana!`);

  document.getElementById('btn-reset').innerHTML = '<img class="icon-svg" src="assets/icons/refresh.svg"> Siguiente ronda';
}

function handleDraw() {
  gameOver = true;
  streakCount = 0;
  lastWinner = null;
  opponentHadTwo = false;

  document.getElementById('turn-indicator').style.display = 'none';
  document.getElementById('result-text').style.display = 'block';
  document.getElementById('result-text').textContent = '¡Empate!';

  unlockAchievement('draw');
  unlockAchievement('first-game');

  document.getElementById('btn-reset').innerHTML = '<img class="icon-svg" src="assets/icons/refresh.svg"> Siguiente ronda';
}

function resetBoard() {
  if (aiTimeout) { clearTimeout(aiTimeout); aiTimeout = null; }
  board = ['', '', '', '', '', '', '', '', ''];
  currentPlayer = 1;
  gameOver = false;
  movesInGame = 0;
  lastMoves = [];
  opponentHadTwo = false;

  document.getElementById('turn-indicator').style.display = 'block';
  document.getElementById('turn-text').textContent = gameMode === '1p' ? 'Tu turno' : 'Jugador 1';
  document.getElementById('turn-text').className = 'highlight';
  document.getElementById('result-text').style.display = 'none';
  document.getElementById('result-text').textContent = '';
  document.getElementById('btn-reset').innerHTML = '<img class="icon-svg" src="assets/icons/refresh.svg"> Reiniciar juego';

  document.getElementById('p1-info').classList.add('active');
  document.getElementById('p2-info').classList.remove('active');

  renderBoard();
  updateTurnDisplay();
}

function updateTurnDisplay() {
  if (gameOver) return;
  if (gameMode === '1p') {
    document.getElementById('turn-text').textContent = currentPlayer === 1 ? 'Tu turno' : 'Turno de la CPU...';
  } else {
    document.getElementById('turn-text').textContent = `Jugador ${currentPlayer}`;
  }

  const p1 = document.getElementById('p1-info');
  const p2 = document.getElementById('p2-info');
  if (currentPlayer === 1) {
    p1.classList.add('active');
    p2.classList.remove('active');
  } else {
    p2.classList.add('active');
    p1.classList.remove('active');
  }
}

// === Achievements ===
function checkAchievements(player, winLine) {
  if (!achievements['first-game']) unlockAchievement('first-game');

  if (totalWins[player] === 1 && !achievements['first-win']) unlockAchievement('first-win');

  if (streakCount >= 3 && !achievements['three-streak']) unlockAchievement('three-streak');

  if (totalWins[player] >= 5 && !achievements['five-wins']) unlockAchievement('five-wins');

  if (streakCount >= 10 && !achievements['perfect']) unlockAchievement('perfect');

  if (opponentHadTwo && !achievements['comeback']) unlockAchievement('comeback');

  if (movesInGame >= 7 && !achievements['full-board']) unlockAchievement('full-board');
}

function unlockAchievement(id) {
  if (achievements[id]) return;
  achievements[id] = true;

  const el = document.querySelector(`.achievement[data-ach="${id}"]`);
  if (el) {
    el.classList.add('unlocked');
    const badgeImg = el.querySelector('.badge img');
    if (badgeImg) badgeImg.src = 'assets/icons/check.svg';
  }

  updateAchievementCount();

  const names = {
    'first-win': 'y sin WIZAR!!',
    'three-streak': '¿Que significa ambiguo?',
    'draw': 'no voy a ir a buscar las pastillas.',
    'perfect': 'Este es un juego de logica y deducción',
    'comeback': 'tenia un DEA!',
    'five-wins': 'juguemos Trio, ya me aburri',
    'full-board': 'Flip 7!!',
    'first-game': 'MIAUUUUU!!!'
  };

  const iconEl = el?.querySelector('.icon img');
  const iconSrc = iconEl ? iconEl.src : null;
  showToast(`${names[id] || id} desbloqueado!`, iconSrc);
}

function updateAchievementCount() {
  const total = 8;
  const unlocked = Object.values(achievements).filter(Boolean).length;
  const text = `(${unlocked}/${total})`;
  document.getElementById('ach-count').textContent = text;
  const modalCount = document.getElementById('ach-count-modal');
  if (modalCount) modalCount.textContent = text;
}

function toggleAchievementsModal() {
  const modal = document.getElementById('achievements-modal');
  modal.classList.toggle('open');
}

function closeAchievementsModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('achievements-modal').classList.remove('open');
}

// === Toast ===
let toastQueue = [];
let toastShowing = false;

function showToast(msg, iconSrc) {
  toastQueue.push({ msg, iconSrc });
  if (!toastShowing) showNextToast();
}

function showNextToast() {
  if (toastQueue.length === 0) {
    toastShowing = false;
    return;
  }
  toastShowing = true;
  const { msg, iconSrc } = toastQueue.shift();
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  const toastIcon = document.getElementById('toast-icon');
  toastText.textContent = msg;
  toastIcon.innerHTML = iconSrc ? `<img src="${iconSrc}">` : '';
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(showNextToast, 400);
  }, 3000);
}

// === Confetti ===
let confettiPieces = [];
let confettiRunning = false;

function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  confettiPieces = [];
  const colors = ['#f7971e', '#ffd200', '#FF6B6B', '#4ECDC4', '#45B7D1', '#DDA0DD', '#FFEAA7', '#FF69B4'];
  for (let i = 0; i < 150; i++) {
    confettiPieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 4 - 2,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      rotSpeed: Math.random() * 10 - 5
    });
  }

  if (!confettiRunning) {
    confettiRunning = true;
    animateConfetti(ctx, canvas);
  }
}

function animateConfetti(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let alive = false;
  confettiPieces.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.rot += p.rotSpeed;

    if (p.y < canvas.height + 20) alive = true;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * Math.PI / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
    ctx.restore();
  });

  if (alive) {
    requestAnimationFrame(() => animateConfetti(ctx, canvas));
  } else {
    confettiRunning = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// === Init ===
renderColorOptions();
renderBoard();

window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('achievements-modal').classList.remove('open');
  }
});
