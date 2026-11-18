// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, PHASE_OVER, PHASE_WON } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const LIMIT_SECONDS = 900;

/** Steer toward the nearest pearl, fleeing every wisp that gets too close. */
function goodPilot(state) {
  const player = state.player;
  let pearl = null;
  let best = Infinity;
  for (const item of state.pearls) {
    if (!item.active) continue;
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d < best) {
      best = d;
      pearl = item;
    }
  }
  let mx = 0;
  let my = 0;
  if (pearl !== null) {
    const dx = pearl.x - player.x;
    const dy = pearl.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    mx = dx / len;
    my = dy / len;
  }
  let dash = false;
  for (const wisp of state.wisps) {
    if (!wisp.active) continue;
    const dx = player.x - wisp.x;
    const dy = player.y - wisp.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 170) {
      // Push away from the wisp, harder the closer it is.
      const weight = ((170 - dist) / 170) * 2.6;
      const len = dist || 1;
      mx += (dx / len) * weight;
      my += (dy / len) * weight;
      if (dist < 95 && player.dashCooldown === 0) dash = true;
    }
  }
  const len = Math.hypot(mx, my);
  if (len === 0) return { move: { x: 0, y: 0 }, dash };
  return { move: { x: mx / len, y: my / len }, dash };
}

/** Chase the nearest pearl and ignore the wisps, as a hurried player does. */
function recklessPilot(state) {
  const player = state.player;
  let pearl = null;
  let best = Infinity;
  for (const item of state.pearls) {
    if (!item.active) continue;
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d < best) {
      best = d;
      pearl = item;
    }
  }
  if (pearl === null) return { move: { x: 0, y: 0 }, dash: false };
  const dx = pearl.x - player.x;
  const dy = pearl.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  return { move: { x: dx / len, y: dy / len }, dash: false };
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const pilot = goodPilot(world.state);
      const events = world.step(STEP, pilot.move, pilot.dash, false);
      if (events & EVENT_OVER) break;
      if (events & EVENT_WIN) break;
    }
    return { screen: world.state.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
      const pilot = recklessPilot(world.state);
      const events = world.step(STEP, pilot.move, pilot.dash, false);
      if (events & EVENT_OVER) break;
    }
    return { screen: world.state.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // win
  for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
    const pilot = goodPilot(world.state);
    const events = world.step(STEP, pilot.move, pilot.dash, false);
    if (events & EVENT_WIN) break;
    if (events & EVENT_OVER) break;
  }
  return { screen: world.state.phase === PHASE_WON ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
}
