/* Presentation/input refinement. No saved fields, speeds, hitboxes or quest rules change. */
(() => {
 'use strict';
 const rawAxes = movementAxes;
 const oldSlide = slidePadTouch;
 let angle = null, lastTime = 0, lastMap = null;
 const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
 const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');

 // Preserve capture, deadzone, button highlights and cancellation in the original pad.
 // The original eight sectors are now labels only: the direction follows the finger.
 slidePadTouch = function(id, x, y) {
  oldSlide(id, x, y);
  const touch = movementTouches.get(id);
  if (!touch) return;
  const rect = movementPad.getBoundingClientRect();
  const dx = x - rect.left - rect.width / 2, dy = y - rect.top - rect.height / 2;
  const distance = Math.hypot(dx, dy);
  touch.vector = distance < Math.min(rect.width, rect.height) * .10 ? null : [dx / distance, dy / distance];
 };
 movementAxes = function() {
  let axes = rawAxes();
  const touch = movementTouches.values().next().value;
  if (touch) axes = touch.vector || [0, 0];
  const now = performance.now(), elapsed = (now - lastTime) / 1000;
  lastTime = now;
  if (!axes[0] && !axes[1]) { angle = null; return [0, 0]; }
  const target = Math.atan2(axes[1], axes[0]);
  if (angle === null || lastMap !== mapId || elapsed > .2 || reduced?.matches) angle = target;
  else if (elapsed > 0) angle += wrap(target - angle) * (1 - Math.exp(-elapsed / .045));
  lastMap = mapId;
  return [Math.cos(angle), Math.sin(angle)];
 };

 // Cross-fade the existing painted directional poses instead of popping from
 // front to side/back. Keep authoritative facing unchanged outside drawing.
 const paintHero = drawClassHero, poses = new WeakMap();
 drawClassHero = function(entity, scale) {
  const x = entity.faceX, y = entity.faceY;
  const direction = battleDirection(x ?? 0, y ?? 1), now = animationClock;
  let state = poses.get(entity);
  if (!state || state.map !== mapId || now - state.seen > .25) {
   state = {direction, x, y, fromX:x, fromY:y, changed:now-.12, seen:now, map:mapId};
   poses.set(entity, state);
  }
  if (direction !== state.direction) {
   state.fromX = state.x; state.fromY = state.y; state.changed = now;
   state.direction = direction;
  }
  state.x=x; state.y=y; state.seen=now;
  const progress = Math.min(1, Math.max(0, (now-state.changed)/.10));
  if (progress >= 1 || reduced?.matches || entity.attack > 0 || entity.castTime > 0 || entity.hitTime > 0 || entity.dodgeTime > 0) return paintHero(entity, scale);
  const alpha = ctx.globalAlpha;
  try {
   ctx.save(); ctx.globalAlpha = alpha * (1-progress);
   entity.faceX=state.fromX; entity.faceY=state.fromY;
   paintHero(entity, scale); ctx.restore();
   ctx.save(); ctx.globalAlpha = alpha * progress;
   entity.faceX=x; entity.faceY=y;
   return paintHero(entity, scale);
  } finally { entity.faceX=x; entity.faceY=y; ctx.restore(); }
 };
})();
