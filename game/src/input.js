// Keyboard and pointer input. Held keys give a steering vector; one-shot presses
// (start or restart, pause, dash, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// Clicking also dashes toward the pointer, which is how the mouse plays.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let pointer = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY, down: true };
    actions |= ACTION_DASH | ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY, down: pointer.down };
  });
  target.addEventListener('pointerup', () => {
    pointer = { x: pointer.x, y: pointer.y, down: false };
  });

  function has(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** A normalised steering vector, {x, y}, from the held movement keys. */
    direction() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    pointer() {
      return pointer;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
