// The game's rules and state, with no drawing and no browser in it: the lantern
// keeper, the pearls, the ink wisps, waves, the Crown Pearl, score, combo, lives
// and the win. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (and play sounds) without the world knowing
// about screens or audio. Nothing here allocates after createWorld returns.

import {
  BANNER_SECONDS, FIELD, FINAL_WAVE, LIVES, PEARL, PLAYER, WAVE_BONUS, WISP,
} from './config.js';

export const KIND_PEARL = 0;
export const KIND_CROWN = 1;

export const EVENT_COLLECT = 1;
export const EVENT_HIT = 2;
export const EVENT_WAVE = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_EXPIRE = 32;
export const EVENT_DASH = 64;

export const PHASE_WAVE = 'wave';
export const PHASE_BANNER = 'banner';
export const PHASE_CROWN = 'crown';
export const PHASE_WON = 'won';
export const PHASE_OVER = 'over';

const MAX_PEARLS = 16;
const MAX_WISPS = 8;
const MAX_PARTICLES = 96;
const MAX_FLOATERS = 16;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius,
    facing: { x: 1, y: 0 }, dashTime: 0, dashCooldown: 0, invulnerable: 0, moving: false,
  };
  const pearls = [];
  for (let i = 0; i < MAX_PEARLS; i += 1) {
    pearls.push({ active: false, kind: KIND_PEARL, x: 0, y: 0, radius: PEARL.radius, life: 0, maxLife: PEARL.lifetime, phase: 0 });
  }
  const wisps = [];
  for (let i = 0; i < MAX_WISPS; i += 1) {
    wisps.push({ active: false, x: 0, y: 0, radius: WISP.radius, speed: 0, wobble: 0, wobbleSpeed: 0 });
  }
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffd166' });
  }
  const floaters = [];
  for (let i = 0; i < MAX_FLOATERS; i += 1) {
    floaters.push({ active: false, x: 0, y: 0, life: 0, text: '' });
  }

  const state = {
    player, pearls, wisps, particles, floaters,
    score: 0, combo: 0, bestCombo: 0, lives: LIVES, wave: 1,
    elapsed: 0, phase: PHASE_WAVE, bannerTimer: 0, shake: 0,
    pearlsCollected: 0, pearlsMissed: 0, waveBonus: 0,
  };

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.5 + random() * 0.4;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.color = color;
    }
  }

  function floater(x, y, text) {
    const f = free(floaters);
    if (f === null) return;
    f.active = true;
    f.x = x;
    f.y = y;
    f.life = 1;
    f.text = text;
  }

  function randomPoint(margin) {
    return {
      x: FIELD.margin + margin + random() * (FIELD.width - 2 * (FIELD.margin + margin)),
      y: 96 + margin + random() * (FIELD.height - 96 - FIELD.margin - 2 * margin),
    };
  }

  function spawnPearl(kind) {
    const pearl = free(pearls);
    if (pearl === null) return;
    const point = kind === KIND_CROWN
      ? { x: FIELD.width / 2, y: FIELD.height / 2 }
      : randomPoint(PEARL.radius + 8);
    pearl.active = true;
    pearl.kind = kind;
    pearl.x = point.x;
    pearl.y = point.y;
    pearl.radius = kind === KIND_CROWN ? 22 : PEARL.radius;
    pearl.maxLife = kind === KIND_CROWN ? 30 : PEARL.lifetime;
    pearl.life = pearl.maxLife;
    pearl.phase = random() * Math.PI * 2;
  }

  function spawnWisp() {
    const wisp = free(wisps);
    if (wisp === null) return;
    // Wisps arrive at the field edge, away from the player.
    const side = Math.floor(random() * 4);
    let x = FIELD.width / 2;
    let y = FIELD.height / 2;
    if (side === 0) { x = random() * FIELD.width; y = 80; }
    if (side === 1) { x = random() * FIELD.width; y = FIELD.height - 20; }
    if (side === 2) { x = 20; y = random() * FIELD.height; }
    if (side === 3) { x = FIELD.width - 20; y = random() * FIELD.height; }
    wisp.active = true;
    wisp.x = x;
    wisp.y = y;
    wisp.speed = WISP.baseSpeed + WISP.speedPerWave * (state.wave - 1) + random() * 18;
    wisp.wobble = random() * Math.PI * 2;
    wisp.wobbleSpeed = 1.5 + random() * 2;
  }

  function startWave(wave) {
    state.wave = wave;
    state.phase = PHASE_WAVE;
    const pearlCount = PEARL.perWave + wave;
    for (let i = 0; i < pearlCount; i += 1) spawnPearl(KIND_PEARL);
    const wispCount = Math.min(WISP.maxCount, wave);
    for (let i = 0; i < wispCount; i += 1) spawnWisp();
  }

  function activePearls() {
    let count = 0;
    for (const pearl of pearls) if (pearl.active) count += 1;
    return count;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    player.facing = { x: 1, y: 0 };
    for (const pearl of pearls) pearl.active = false;
    for (const wisp of wisps) wisp.active = false;
    for (const particle of particles) particle.active = false;
    for (const floaterItem of floaters) floaterItem.active = false;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.elapsed = 0;
    state.phase = PHASE_WAVE;
    state.bannerTimer = 0;
    state.shake = 0;
    state.pearlsCollected = 0;
    state.pearlsMissed = 0;
    state.waveBonus = 0;
    startWave(1);
  }

  /**
   * One fixed step. `move` is a normalised steering vector, `dash` asks for a
   * dash (toward `move`, or the facing direction when standing still).
   * With `demo` set the keeper drifts on its own, wisps wander, and nothing
   * scores or ends: the title screen's living backdrop.
   */
  function step(dt, move, dash, demo) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);

    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) { particle.active = false; continue; }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
    }
    for (const floaterItem of floaters) {
      if (!floaterItem.active) continue;
      floaterItem.life -= dt * 0.7;
      floaterItem.y -= 34 * dt;
      if (floaterItem.life <= 0) floaterItem.active = false;
    }
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    if (state.phase === PHASE_BANNER) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        if (state.wave >= FINAL_WAVE) {
          state.phase = PHASE_CROWN;
          spawnPearl(KIND_CROWN);
        } else {
          startWave(state.wave + 1);
          events |= EVENT_WAVE;
        }
      }
      return events;
    }
    if (state.phase === PHASE_WON || state.phase === PHASE_OVER) return events;

    // Movement: a dash is a short burst in the steering direction.
    let speed = PLAYER.speed;
    if (dash && player.dashCooldown === 0 && !demo) {
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      if (move.x !== 0 || move.y !== 0) player.facing = { x: move.x, y: move.y };
      burst(player.x, player.y, '#5eead4', 10, 160);
      events |= EVENT_DASH;
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      speed = PLAYER.dashSpeed;
    }
    let mx = move.x;
    let my = move.y;
    if (demo) {
      // Drift in a slow circle so the title backdrop stays alive.
      const t = state.elapsed * 0.35;
      mx = Math.cos(t) * 0.5;
      my = Math.sin(t * 0.7) * 0.5;
    }
    player.moving = mx !== 0 || my !== 0;
    if (player.moving) player.facing = { x: mx, y: my };
    player.x = clamp(player.x + mx * speed * dt, FIELD.margin + player.radius, FIELD.width - FIELD.margin - player.radius);
    player.y = clamp(player.y + my * speed * dt, 84 + player.radius, FIELD.height - FIELD.margin - player.radius);

    // Pearls tick down, glow, and are collected on touch.
    for (const pearl of pearls) {
      if (!pearl.active) continue;
      pearl.phase += dt * 3;
      pearl.life -= dt;
      if (pearl.life <= 0) {
        pearl.active = false;
        if (!demo && pearl.kind === KIND_PEARL) {
          state.pearlsMissed += 1;
          state.combo = 0;
          events |= EVENT_EXPIRE;
        }
        continue;
      }
      if (demo) continue;
      if (distance(player.x, player.y, pearl.x, pearl.y) < player.radius + pearl.radius) {
        pearl.active = false;
        if (pearl.kind === KIND_CROWN) {
          state.phase = PHASE_WON;
          burst(pearl.x, pearl.y, '#ffdf5e', 36, 260);
          floater(pearl.x, pearl.y - 30, 'THE TIDE IS LIT!');
          events |= EVENT_WIN;
          return events;
        }
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        const points = PEARL.basePoints * Math.min(state.combo, PEARL.maxCombo);
        state.score += points;
        state.pearlsCollected += 1;
        burst(pearl.x, pearl.y, '#ffd166', 14, 180);
        floater(pearl.x, pearl.y - 22, `+${points}`);
        events |= EVENT_COLLECT;
      }
    }

    // Wisps chase the keeper; a touch costs a life.
    for (const wisp of wisps) {
      if (!wisp.active) continue;
      wisp.wobble += wisp.wobbleSpeed * dt;
      const dx = player.x - wisp.x;
      const dy = player.y - wisp.y;
      const dist = Math.hypot(dx, dy) || 1;
      const wobbleX = Math.cos(wisp.wobble) * 26;
      const wobbleY = Math.sin(wisp.wobble) * 26;
      const tx = (dx / dist) * wisp.speed + wobbleX;
      const ty = (dy / dist) * wisp.speed + wobbleY;
      const len = Math.hypot(tx, ty) || 1;
      wisp.x = clamp(wisp.x + (tx / len) * wisp.speed * dt, 12, FIELD.width - 12);
      wisp.y = clamp(wisp.y + (ty / len) * wisp.speed * dt, 72, FIELD.height - 12);
      if (demo) continue;
      const touching = dist < player.radius + wisp.radius - 4;
      const dashing = player.dashTime > 0;
      if (touching && player.invulnerable === 0 && !dashing) {
        state.lives -= 1;
        state.combo = 0;
        player.invulnerable = PLAYER.invulnerable;
        state.shake = 1;
        burst(player.x, player.y, '#ff5d73', 22, 240);
        const away = { x: dx / dist, y: dy / dist };
        player.x = clamp(player.x + away.x * WISP.knockback * 0.12, FIELD.margin + player.radius, FIELD.width - FIELD.margin - player.radius);
        player.y = clamp(player.y + away.y * WISP.knockback * 0.12, 84 + player.radius, FIELD.height - FIELD.margin - player.radius);
        events |= EVENT_HIT;
        if (state.lives <= 0) {
          state.phase = PHASE_OVER;
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    // A wave ends when its last pearl is gone; the Crown Pearl follows wave 6.
    if (!demo && state.phase === PHASE_WAVE && activePearls() === 0) {
      state.waveBonus = WAVE_BONUS;
      state.score += WAVE_BONUS;
      floater(player.x, player.y - 40, `WAVE BONUS +${WAVE_BONUS}`);
      state.phase = PHASE_BANNER;
      state.bannerTimer = BANNER_SECONDS;
      events |= EVENT_WAVE;
    }
    if (!demo && state.phase === PHASE_CROWN && activePearls() === 0) {
      // The Crown Pearl only leaves by being collected, so this never happens
      // in play; keep the crown waiting instead of ending the game.
      spawnPearl(KIND_CROWN);
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave };
}
