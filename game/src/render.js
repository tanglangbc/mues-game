// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Canvas shapes and text only: every picture in the
// game is drawn here, so the game ships no image files at all.

import { FIELD, FONT, LIVES, PALETTE } from './config.js';
import { KIND_CROWN, PHASE_BANNER, PHASE_CROWN, PHASE_OVER, PHASE_WAVE, PHASE_WON } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 920, line: 36 };
const HUD_HEIGHT = 64;

/** Fixed decorative reef dots, placed by a deterministic function of index. */
const REEF_DOTS = [];
for (let i = 0; i < 46; i += 1) {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.1234;
  REEF_DOTS.push({
    x: (a - Math.floor(a)) * FIELD.width,
    y: 120 + (b - Math.floor(b)) * (FIELD.height - 180),
    r: 2 + ((a - Math.floor(a)) * 5),
  });
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const timeLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawWater(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.waterTop);
    gradient.addColorStop(1, PALETTE.waterBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Reef dots and a sandy floor, for depth without any image.
    context.fillStyle = PALETTE.reef;
    for (const dot of REEF_DOTS) {
      context.globalAlpha = 0.35;
      circle(dot.x, dot.y, dot.r, PALETTE.reef);
    }
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, FIELD.height - 26, FIELD.width, 26);
    context.fillStyle = PALETTE.reef;
    for (let x = 0; x < FIELD.width; x += 90) {
      context.beginPath();
      context.moveTo(x, FIELD.height - 26);
      context.quadraticCurveTo(x + 22, FIELD.height - 52, x + 45, FIELD.height - 26);
      context.fill();
    }
    // Arena edge.
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(FIELD.margin - 8, 76, FIELD.width - 2 * FIELD.margin + 16, FIELD.height - 76 - FIELD.margin + 8);
  }

  function drawPearls(state) {
    for (const pearl of state.pearls) {
      if (!pearl.active) continue;
      const pulse = 1 + Math.sin(pearl.phase) * 0.12;
      const crown = pearl.kind === KIND_CROWN;
      const radius = pearl.radius * pulse;
      const lifeFrac = Math.max(0, pearl.life / pearl.maxLife);
      context.save();
      context.shadowColor = crown ? PALETTE.crown : PALETTE.pearl;
      context.shadowBlur = crown ? 34 : 18;
      circle(pearl.x, pearl.y, radius, crown ? PALETTE.crown : PALETTE.pearl);
      context.shadowBlur = 0;
      circle(pearl.x - radius * 0.3, pearl.y - radius * 0.35, radius * 0.32, '#fff8dd');
      if (crown) {
        context.strokeStyle = PALETTE.crown;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(pearl.x, pearl.y, radius + 10, 0, Math.PI * 2);
        context.stroke();
      }
      // Lifetime ring: it shrinks as the pearl fades.
      context.strokeStyle = lifeFrac > 0.35 ? PALETTE.pearlRing : PALETTE.danger;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(pearl.x, pearl.y, radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeFrac);
      context.stroke();
      context.restore();
    }
  }

  function drawWisps(state) {
    for (const wisp of state.wisps) {
      if (!wisp.active) continue;
      context.save();
      context.shadowColor = PALETTE.wisp;
      context.shadowBlur = 22;
      circle(wisp.x, wisp.y, wisp.radius, PALETTE.wisp);
      context.shadowBlur = 0;
      // A wisp is a blob with two eyes and a wavy tail.
      circle(wisp.x - 7, wisp.y - 4, 4.5, PALETTE.wispEye);
      circle(wisp.x + 7, wisp.y - 4, 4.5, PALETTE.wispEye);
      circle(wisp.x - 7, wisp.y - 4, 2, '#1a1033');
      circle(wisp.x + 7, wisp.y - 4, 2, '#1a1033');
      context.fillStyle = PALETTE.wisp;
      context.beginPath();
      context.moveTo(wisp.x - 12, wisp.y + 8);
      context.quadraticCurveTo(wisp.x - 6, wisp.y + wisp.radius + 10, wisp.x, wisp.y + 8);
      context.quadraticCurveTo(wisp.x + 6, wisp.y + wisp.radius + 10, wisp.x + 12, wisp.y + 8);
      context.fill();
      context.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (blink) return;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * 8 * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * 8 * state.shake : 0;
    const x = player.x + shakeX;
    const y = player.y + shakeY;
    context.save();
    // Warm light around the lantern keeper.
    const glow = context.createRadialGradient(x, y, 4, x, y, 110);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 110, 0, Math.PI * 2);
    context.fill();
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 26;
    circle(x, y, player.radius, PALETTE.player);
    context.shadowBlur = 0;
    // Lantern cap, flame core and handle.
    context.fillStyle = '#7a4a12';
    context.fillRect(x - 10, y - player.radius - 6, 20, 7);
    circle(x, y, 9, PALETTE.playerCore);
    context.strokeStyle = '#7a4a12';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y - player.radius - 2, 9, Math.PI, 0);
    context.stroke();
    // Eyes, looking where the keeper moves.
    const fx = player.facing.x * 3;
    const fy = player.facing.y * 3;
    circle(x - 6 + fx, y - 2 + fy, 2.6, '#3a2405');
    circle(x + 6 + fx, y - 2 + fy, 2.6, '#3a2405');
    context.restore();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      circle(particle.x, particle.y, particle.size, particle.color);
    }
    context.globalAlpha = 1;
    for (const floater of state.floaters) {
      if (!floater.active) continue;
      context.globalAlpha = Math.max(0, floater.life);
      text(floater.text, floater.x, floater.y, 26, PALETTE.gold, 'center', '700 ');
    }
    context.globalAlpha = 1;
  }

  function drawHeart(x, y, size, filled) {
    context.fillStyle = filled ? PALETTE.heart : '#3a4066';
    context.beginPath();
    context.moveTo(x, y + size * 0.35);
    context.bezierCurveTo(x - size * 0.55, y - size * 0.25, x - size * 0.2, y - size * 0.7, x, y - size * 0.2);
    context.bezierCurveTo(x + size * 0.2, y - size * 0.7, x + size * 0.55, y - size * 0.25, x, y + size * 0.35);
    context.fill();
  }

  function drawHud(state, best, muted) {
    context.fillStyle = 'rgba(7, 10, 28, 0.82)';
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, HUD_HEIGHT, FIELD.width, 2);
    context.textBaseline = 'top';
    text('GLOWKEEP', 24, 18, 26, PALETTE.accent, 'left', '800 ');
    text(scoreLabel(state.score), 240, 18, 26, PALETTE.text, 'left', '700 ');
    text(bestLabel(best), 470, 18, 26, PALETTE.muted, 'left');
    text(waveLabel(`${state.wave} / 6`), 660, 18, 26, PALETTE.text, 'left', '700 ');
    const pearlsLeft = state.pearls.filter((p) => p.active && p.kind !== KIND_CROWN).length;
    text(`PEARLS ${pearlsLeft}`, 830, 18, 26, PALETTE.gold, 'left', '700 ');
    for (let life = 0; life < LIVES; life += 1) drawHeart(1010 + life * 34, 34, 26, life < state.lives);
    if (state.combo >= 2) {
      text(`COMBO x${state.combo}`, FIELD.width - 24, 18, 26, PALETTE.danger, 'right', '800 ');
    }
    // Dash cooldown bar under the HUD.
    const frac = 1 - state.player.dashCooldown / 1.2;
    context.fillStyle = '#232a4d';
    context.fillRect(24, HUD_HEIGHT + 8, 180, 8);
    context.fillStyle = frac >= 1 ? PALETTE.accent : PALETTE.player;
    context.fillRect(24, HUD_HEIGHT + 8, 180 * Math.max(0, Math.min(1, frac)), 8);
    text(frac >= 1 ? 'DASH READY  [Space / Click]' : 'DASH...', 212, HUD_HEIGHT + 2, 16, PALETTE.muted, 'left');
    if (muted) text('MUTED  [M]', FIELD.width - 24, HUD_HEIGHT + 2, 16, PALETTE.muted, 'right');
    if (state.phase === PHASE_CROWN) {
      text('THE CROWN PEARL IS HERE — GRAB IT!', FIELD.width / 2, HUD_HEIGHT + 2, 18, PALETTE.crown, 'center', '800 ');
    }
  }

  function drawBanner(state) {
    if (state.phase !== PHASE_BANNER) return;
    context.textBaseline = 'alphabetic';
    const next = state.wave >= 6 ? 'THE CROWN PEARL' : `WAVE ${state.wave + 1}`;
    text(next, FIELD.width / 2, 300, 56, PALETTE.gold, 'center', '800 ');
    text(`Wave bonus +${state.waveBonus}`, FIELD.width / 2, 344, 26, PALETTE.text, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * PANEL.line + 64;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(4, 6, 18, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 52, accent || PALETTE.text, 'center', '800 ');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 138 + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 24, PALETTE.gold, 'center', '700 ');
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
  }

  /** Paint one frame: the water, the game, then the HUD or a panel. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWater(state);
    drawPearls(state);
    drawWisps(state);
    drawPlayer(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      drawHud(state, best, muted);
      drawPanel('GLOWKEEP', [
        'Lantern Tide — light every pearl before it fades.',
        'Move with WASD or Arrow keys. Dash with Space or a mouse click.',
        'Chain pearls for combos. Dodge the ink wisps —',
        '3 hits and the light goes out.',
        'Clear 6 waves, then grab the Crown Pearl to win.',
        bestLabel(best),
      ], 'Press Space or click to start', PALETTE.accent);
      return;
    }
    drawHud(state, best, muted);
    drawBanner(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The tide waits for you.'], 'Press P to resume', PALETTE.accent);
    } else if (screen === SCREEN_OVER) {
      drawPanel('THE LIGHT WENT OUT', [
        finalLabel(state.score),
        bestLabel(best),
        `Wave ${state.wave}  •  Pearls ${state.pearlsCollected}  •  Best combo x${state.bestCombo}  •  Time ${formatTime(state.elapsed)}`,
      ], 'Press Space or click to play again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('THE TIDE IS LIT!', [
        finalLabel(state.score),
        bestLabel(best),
        `All 6 waves cleared  •  Pearls ${state.pearlsCollected}  •  Best combo x${state.bestCombo}  •  Time ${formatTime(state.elapsed)}`,
      ], 'Press Space or click to play again', PALETTE.gold);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, formatTime };
}
