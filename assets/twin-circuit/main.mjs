import {makePuzzle, trace, turn, formatTime, durationFor} from './engine.mjs';

const $ = id => document.getElementById(id);
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pointPaths = ['M50 50 L50 4', 'M50 50 L96 50', 'M50 50 L50 96', 'M50 50 L4 50'];
let mode = 'idle'; // local, hosting, host, joining, guest
let role = -1, peer = null, connection = null, room = '';
let puzzle = null, solution = [], path = [], phase = 'lobby';
let round = 1, seed = 1, duration = 155000, deadline = 0, pausedRemaining = 0;
let score = 0, streak = 0, moves = [0, 0], hints = [false, false];
let lastMover = -1, chain = 0, hintTile = -1, hintUntil = 0, lastAward = 0;
let boardSignature = '', lastSync = 0, toastTimeout = 0, audioEnabled = false, audioContext = null;
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem('twin-circuit:best')) || 0); } catch (_) {}

const authority = () => mode === 'local' || mode === 'host';
const online = () => mode === 'host' || mode === 'guest';
const remaining = () => phase === 'playing' ? Math.max(0, deadline - Date.now()) : Math.max(0, pausedRemaining);
const randomSeed = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] || 1;
};
function showError(message) {
  $('setupError').hidden = false;
  $('setupError').textContent = message;
  $('lobbyStatus').textContent = message;
}
function toast(message) {
  clearTimeout(toastTimeout);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 2200);
}
function sound(freq = 420, length = 0.085, type = 'sine', volume = 0.055) {
  if (!audioEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + length);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(); osc.stop(audioContext.currentTime + length + .01);
  } catch (_) { /* Audio is optional. */ }
}
function fanfare() {
  [440, 554, 659, 880].forEach((frequency, i) => setTimeout(() => sound(frequency, .25, 'sine', .045), i * 115));
}
$('sound').addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  $('sound').textContent = audioEnabled ? '♪ On' : '♪ Off';
  $('sound').setAttribute('aria-pressed', String(audioEnabled));
  $('sound').setAttribute('aria-label', audioEnabled ? 'Turn sound off' : 'Turn sound on');
  if (audioEnabled) sound(610);
});
function randomRoom() {
  const bits = new Uint32Array(8);
  crypto.getRandomValues(bits);
  return [...bits].map(n => ROOM_ALPHABET[n % ROOM_ALPHABET.length]).join('');
}
function showArena() {
  $('setup').hidden = true;
  $('arena').hidden = false;
  $('roomBadge').textContent = mode === 'local' ? 'SIDE BY SIDE' : 'ROOM ' + room;
  $('goldStatus').textContent = mode === 'local' ? 'Player 1' : mode === 'guest' ? 'Your partner' : 'You';
  $('tealStatus').textContent = mode === 'local' ? 'Player 2' : mode === 'guest' ? 'You' : 'Your partner';
}
function startLocal() {
  mode = 'local'; role = -1; room = ''; seed = randomSeed();
  round = 1; score = 0; streak = 0; lastAward = 0;
  showArena(); newRound();
  toast('Two players. One circuit. You have this!');
}
$('local').addEventListener('click', startLocal);

function newRound() {
  if (!authority()) return;
  const generated = makePuzzle(seed, round);
  puzzle = generated.puzzle;
  solution = generated.solution;
  path = generated.path;
  phase = 'playing';
  duration = durationFor(round);
  deadline = Date.now() + duration;
  pausedRemaining = duration;
  moves = [0, 0]; hints = [false, false]; lastMover = -1;
  chain = 0; hintTile = -1; hintUntil = 0; lastAward = 0;
  boardSignature = '';
  broadcast();
  render();
}
function snapshot() {
  return {
    phase, puzzle, round, duration, remainingMs: remaining(), pausedRemaining,
    moves, hints, score, streak, chain, lastAward,
    hintTile: Date.now() < hintUntil ? hintTile : -1,
    hintRemainingMs: Math.max(0, hintUntil - Date.now())
  };
}
function broadcast() {
  if (mode === 'host' && connection && connection.open) {
    try { connection.send({type: 'state', state: snapshot()}); lastSync = Date.now(); } catch (_) {}
  }
}
function validSnapshot(s) {
  if (!s || !['playing','paused','won','lost'].includes(s.phase) || !s.puzzle) return false;
  const p = s.puzzle;
  return Number.isInteger(p.size) && p.size >= 5 && p.size <= 7 &&
    Array.isArray(p.tiles) && p.tiles.length === p.size * p.size &&
    p.tiles.every(t => Number.isInteger(t.mask) && t.mask >= 0 && t.mask < 16 && (t.owner === 0 || t.owner === 1)) &&
    Array.isArray(p.gems) && p.gems.length === 2 && Number.isInteger(p.start) &&
    Number.isInteger(p.end) && p.start >= 0 && p.end < p.tiles.length;
}
function takeSnapshot(s) {
  if (!validSnapshot(s)) return;
  const oldRound = round;
  phase = s.phase;
  puzzle = s.puzzle;
  round = s.round;
  duration = s.duration;
  moves = s.moves;
  hints = s.hints;
  score = s.score;
  streak = s.streak;
  chain = s.chain;
  lastAward = s.lastAward;
  deadline = Date.now() + Math.max(0, s.remainingMs);
  pausedRemaining = Math.max(0, s.remainingMs);
  hintTile = s.hintTile;
  hintUntil = Date.now() + Math.max(0, s.hintRemainingMs || 0);
  if (oldRound !== round) boardSignature = '';
  showArena(); render();
  if (phase === 'won') saveBest();
}
function saveBest() {
  if (score <= best) return;
  best = score;
  try { localStorage.setItem('twin-circuit:best', String(best)); } catch (_) {}
}
function finish(won) {
  if (!authority() || phase !== 'playing') return;
  pausedRemaining = remaining();
  phase = won ? 'won' : 'lost';
  if (won) {
    const seconds = Math.ceil(pausedRemaining / 1000);
    const efficiency = Math.max(0, 190 - (moves[0] + moves[1]) * 6);
    const syncBonus = Math.min(chain, 6) * 25;
    const hintPenalty = hints.filter(Boolean).length * 75;
    lastAward = Math.max(120, seconds * 9 + efficiency + syncBonus - hintPenalty);
    score += lastAward; streak++;
    saveBest(); fanfare();
    toast('Both stars charged. The circuit is complete!');
  } else {
    streak = 0; lastAward = 0;
    sound(160, .35, 'triangle');
    toast('Time is up. Try a different route together.');
  }
  broadcast(); render();
}
function rotateTile(player, index) {
  if (!authority() || phase !== 'playing') return;
  if (Date.now() >= deadline) { finish(false); return; }
  if (!Number.isInteger(index) || index < 0 || index >= puzzle.tiles.length) return;
  const tile = puzzle.tiles[index];
  if (tile.owner !== player || (mode === 'host' && (!connection || !connection.open))) return;
  tile.mask = turn(tile.mask);
  moves[player]++;
  chain = lastMover === -1 ? 1 : lastMover !== player ? chain + 1 : 1;
  lastMover = player;
  hintTile = -1; hintUntil = 0;
  sound(player ? 525 : 390, .075, 'triangle', .026);
  if (navigator.vibrate) navigator.vibrate(7);
  if (trace(puzzle).solved) finish(true);
  else { broadcast(); render(); }
}
$('board').addEventListener('click', event => {
  const tileButton = event.target.closest('[data-index]');
  if (!tileButton || phase !== 'playing' || !puzzle) return;
  const index = Number(tileButton.dataset.index);
  const owner = puzzle.tiles[index]?.owner;
  if (mode === 'local' || (mode === 'host' && owner === 0)) rotateTile(owner, index);
  else if (mode === 'guest' && owner === 1 && connection?.open) connection.send({type: 'rotate', index});
  else toast(mode === 'guest' ? 'Golden tiles belong to your partner' : 'Teal tiles belong to your partner');
});
function giveHint(requester) {
  if (!authority() || phase !== 'playing') return;
  if (mode === 'host' && !connection?.open) return;
  // Shared-screen mode chooses the first available hint, from either player.
  const choices = path.filter(i => puzzle.tiles[i].mask !== solution[i] && !hints[puzzle.tiles[i].owner]);
  const index = mode === 'local' ? choices[0] : choices.find(i => puzzle.tiles[i].owner === requester);
  if (index === undefined) {
    toast('No hints left for this color — keep turning!');
    return;
  }
  const owner = puzzle.tiles[index].owner;
  hints[owner] = true;
  hintTile = index;
  hintUntil = Date.now() + 3400;
  sound(780, .22, 'sine');
  toast((owner === 0 ? 'Golden' : 'Teal') + ' hint: try the glowing tile');
  broadcast(); render();
}
$('hint').addEventListener('click', () => {
  if (mode === 'guest') {
    if (connection?.open) connection.send({type: 'hint'});
  } else giveHint(role);
});
function advance(replay = false) {
  if (!authority() || (phase !== 'won' && phase !== 'lost')) return;
  if (replay) {
    if (phase === 'won') { score = 0; streak = 0; }
  } else round++;
  newRound();
}
$('next').addEventListener('click', () => {
  if (mode === 'guest') connection?.open && connection.send({type: 'next'});
  else advance(false);
});
$('again').addEventListener('click', () => {
  if (mode === 'guest') connection?.open && connection.send({type: 'again'});
  else advance(true);
});
$('exit').addEventListener('click', () => { location.href = 'twin-circuit.html'; });
function renderClock() {
  if (!puzzle) return;
  const left = remaining(), total = Math.max(1, duration);
  $('timer').textContent = formatTime(left);
  $('timer').classList.toggle('danger', left <= 20000 && phase === 'playing');
  $('timeFill').style.width = (Math.min(100, Math.max(0, left / total * 100))) + '%';
}
function drawBoard(litSet) {
  const canMove = phase === 'playing';
  const hinted = Date.now() < hintUntil ? hintTile : -1;
  const signature = round + '/' + puzzle.tiles.map(t => t.mask).join(',') + '/' + [...litSet].join(',') + '/' + hinted +
    '/' + (canMove ? 'go' : 'stop') + '/' + role;
  if (signature === boardSignature) return;
  boardSignature = signature;
  const rows = [];
  for (let i = 0; i < puzzle.tiles.length; i++) {
    const tile = puzzle.tiles[i];
    const arms = pointPaths.filter((_, d) => tile.mask & (1 << d)).join(' ');
    const lit = litSet.has(i);
    const allowed = canMove && (mode === 'local' || role === tile.owner);
    const label = (tile.owner === 0 ? 'Golden' : 'Teal') + ' circuit, row ' + (Math.floor(i / puzzle.size) + 1) +
      ', column ' + (i % puzzle.size + 1) + (tile.gem ? ', star' : '') +
      (lit ? ', charged' : '') + (allowed ? '. Tap to rotate.' : '. Partner tile.');
    rows.push('<button type="button" class="tile' + (lit ? ' lit' : '') + (hinted === i ? ' hint' : '') +
      (!allowed ? ' locked' : '') + '" data-index="' + i + '" data-owner="' + tile.owner +
      '" aria-label="' + label + '" aria-disabled="' + String(!allowed) + '">' +
      '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="pipe" d="' + arms +
      '"/><circle class="junction" cx="50" cy="50" r="10"/>' +
      (tile.gem ? '<text class="gem' + (lit ? ' done' : '') + '" x="50" y="64" text-anchor="middle">✦</text>' : '') +
      '</svg><span class="owner-mark" aria-hidden="true"></span></button>');
  }
  $('board').style.setProperty('--size', puzzle.size);
  $('board').innerHTML = rows.join('');
}
function render() {
  if (!puzzle) return;
  const flow = trace(puzzle);
  drawBoard(new Set(flow.lit));
  $('round').textContent = String(round).padStart(2, '0');
  $('goldMoves').textContent = moves[0];
  $('tealMoves').textContent = moves[1];
  $('score').textContent = Number(score).toLocaleString();
  $('best').textContent = best ? Number(best).toLocaleString() + ' pts' : 'Your first win awaits';
  $('streak').textContent = streak ? '🔥 ' + streak + '-round winning streak · ' + (chain > 1 ? 'Sync chain ×' + chain : 'Keep your rhythm') :
    'Solve together. Quick rounds build your team score.';
  $('stars').textContent = '✦ ' + flow.gemsLit + ' / 2 stars charged';
  $('steps').textContent = phase === 'playing' ? 'Golden + teal • ' + (moves[0] + moves[1]) + ' turns' :
    phase === 'paused' ? 'Waiting for your partner' : 'Circuit closed';
  $('hint').disabled = phase !== 'playing' || (mode === 'local' ? hints.every(Boolean) : hints[role]);
  $('hint').textContent = mode === 'local' ? '✧ Reveal a tile' : '✧ Reveal my next tile';
  $('hintStatus').textContent = mode === 'local' ? 'Golden: ' + (hints[0] ? 'used' : 'ready') + ' · Teal: ' + (hints[1] ? 'used' : 'ready') :
    'Your hint: ' + (hints[role] ? 'used this round' : 'ready');
  $('matchStatus').textContent = phase === 'playing' ? (mode === 'local' ? 'Pass the board. Find the path together.' :
    mode === 'host' ? 'You are Golden. Your friend is Teal.' : 'You are Teal. Your friend is Golden.') :
    phase === 'paused' ? 'Connection lost. The clock is paused — your partner can rejoin.' :
    phase === 'won' ? 'You found the connection!' : 'Time ran out. Your next attempt can be better.';
  $('finish').hidden = phase !== 'won' && phase !== 'lost';
  if (!$('finish').hidden) {
    $('finishIcon').textContent = phase === 'won' ? '✷' : '◷';
    $('finishTitle').textContent = phase === 'won' ? 'Perfect connection.' : 'Almost connected.';
    $('finishText').textContent = phase === 'won' ? 'A shared win! ' + (moves[0] + moves[1]) +
      ' rotations, both stars lit, and ' + formatTime(pausedRemaining) + ' left on the clock.' :
      'The circuit faded before the exit lit up. Change your approach and try again together.';
    $('finishScore').textContent = phase === 'won' ? '+' + lastAward.toLocaleString() + ' points' : 'Try again';
    $('next').hidden = phase !== 'won';
    $('again').textContent = phase === 'won' ? 'Start score over' : 'Retry puzzle';
    $('finish').querySelector('.eyebrow').textContent = phase === 'won' ? 'Circuit complete' : 'One more try';
  }
  renderClock();
}
setInterval(() => {
  if (!puzzle) return;
  if (authority() && phase === 'playing') {
    if (Date.now() >= deadline) finish(false);
    else if (mode === 'host' && Date.now() - lastSync > 950) broadcast();
  }
  if (hintTile !== -1 && Date.now() >= hintUntil) {
    hintTile = -1;
    if (authority()) broadcast();
    render();
  }
  renderClock();
}, 150);

function loadPeerLibrary() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
    script.async = true;
    script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error('Peer library was unavailable'));
    script.onerror = () => reject(new Error('Could not load the online connection. Try again or play side by side.'));
    document.head.append(script);
  });
}
function wireConnection(link, hostSide) {
  link.on('open', () => {
    if (hostSide) {
      connection = link;
      mode = 'host'; role = 0;
      $('lobbyStatus').textContent = 'Connected — have fun!';
      showArena();
      if (!puzzle) newRound();
      else if (phase === 'paused') {
        phase = 'playing';
        deadline = Date.now() + pausedRemaining;
        broadcast(); render();
      } else broadcast();
      toast('Your partner joined. Make a connection!');
    } else {
      mode = 'guest'; role = 1;
      $('lobbyStatus').textContent = 'Connected. Synchronizing puzzle…';
    }
  });
  link.on('data', message => {
    if (!message || typeof message !== 'object') return;
    if (hostSide) {
      if (message.type === 'rotate') rotateTile(1, message.index);
      else if (message.type === 'hint') giveHint(1);
      else if (message.type === 'next') advance(false);
      else if (message.type === 'again') advance(true);
    } else if (message.type === 'state') takeSnapshot(message.state);
    else if (message.type === 'full') showError('That room already has two players. Ask for a new invite.');
  });
  link.on('close', () => {
    if (hostSide && connection === link) {
      connection = null;
      if (phase === 'playing') { pausedRemaining = remaining(); phase = 'paused'; render(); }
      toast('Your partner left. Waiting for reconnection.');
    } else if (!hostSide) {
      if (phase === 'playing') { pausedRemaining = remaining(); phase = 'paused'; render(); }
      if (!$('arena').hidden) toast('Connection ended. Rejoin with the same code.');
      else showError('The room was closed or unavailable. Check the code and try again.');
    }
  });
  link.on('error', error => {
    if (hostSide) toast('Connection problem. Partner can try rejoining.');
    else showError('Could not join: ' + (error.message || 'room unavailable'));
  });
}
$('host').addEventListener('click', async () => {
  if (mode !== 'idle') return;
  mode = 'hosting'; room = randomRoom();
  $('setupError').hidden = true;
  $('invite').hidden = false;
  $('roomCode').textContent = room;
  $('lobbyStatus').textContent = 'Opening a secure peer connection…';
  $('host').disabled = true; $('join').disabled = true;
  try {
    const Peer = await loadPeerLibrary();
    peer = new Peer('twin-circuit-' + room.toLowerCase());
    peer.on('open', () => { $('lobbyStatus').textContent = 'Ready. Share your invite and wait for one friend.'; });
    peer.on('connection', incoming => {
      if (connection?.open) {
        incoming.on('open', () => { incoming.send({type: 'full'}); setTimeout(() => incoming.close(), 200); });
        return;
      }
      wireConnection(incoming, true);
    });
    peer.on('error', error => showError('Could not create room: ' + (error.message || 'connection unavailable')));
    peer.on('disconnected', () => {
      if (mode === 'hosting') $('lobbyStatus').textContent = 'Signaling disconnected. Checking connection…';
    });
  } catch (error) {
    mode = 'idle'; $('host').disabled = false; $('join').disabled = false;
    showError(error.message || 'Online connection unavailable');
  }
});
$('join').addEventListener('click', async () => {
  if (mode !== 'idle') return;
  room = $('joinCode').value.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (room.length !== 8) { showError('Enter the eight-character invite code.'); return; }
  mode = 'joining'; $('setupError').hidden = true;
  $('join').disabled = true; $('host').disabled = true;
  $('invite').hidden = false; $('roomCode').textContent = room;
  $('copy').hidden = true; $('cancel').textContent = 'Cancel';
  $('lobbyStatus').textContent = 'Finding your partner…';
  try {
    const Peer = await loadPeerLibrary();
    peer = new Peer();
    peer.on('open', () => {
      connection = peer.connect('twin-circuit-' + room.toLowerCase(), {reliable: true, serialization: 'json'});
      wireConnection(connection, false);
      setTimeout(() => {
        if (mode === 'joining' && !$('arena').hidden === false) showError('No room answered. Check the code and try again.');
      }, 11000);
    });
    peer.on('error', error => showError('Could not connect: ' + (error.message || 'room unavailable')));
  } catch (error) { mode = 'idle'; $('join').disabled = false; $('host').disabled = false; showError(error.message || 'Online connection unavailable'); }
});
$('copy').addEventListener('click', async () => {
  const url = new URL('twin-circuit.html?join=' + encodeURIComponent(room), location.href).href;
  try { await navigator.clipboard.writeText(url); toast('Invite link copied!'); }
  catch (_) { toast('Share your room code: ' + room); }
});
$('cancel').addEventListener('click', () => { location.href = 'twin-circuit.html'; });
$('joinCode').addEventListener('keydown', event => { if (event.key === 'Enter') $('join').click(); });
const suggestedCode = new URLSearchParams(location.search).get('join');
if (suggestedCode && /^[A-Z2-9]{8}$/i.test(suggestedCode)) {
  $('joinCode').value = suggestedCode.toUpperCase();
  $('joinCode').focus();
}
