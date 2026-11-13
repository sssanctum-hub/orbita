
export const dialAngle = 11.6 * Math.PI / 180;
export const dialTravel = 96;
export const dialDetent = (x: number) => x - .38 / (2 * Math.PI) * Math.sin(2 * Math.PI * x);

export function dialDragStep(pixels: number, milliseconds: number, reduced: boolean): number {
  const speed = Math.abs(pixels) / Math.max(8, milliseconds);
  const boost = reduced ? 0 : Math.min(1.35, Math.max(0, speed - .35) * .75);
  return pixels / dialTravel * (1 + boost);
}

export function dialTarget(position: number, velocity: number, reduced: boolean): number {
  if (reduced || Math.abs(velocity) < .5) return Math.round(position);

  const direction = Math.sign(velocity);
  const projected = Math.round(position + direction * Math.min(20, Math.abs(velocity) * .42));
  return direction > 0
    ? Math.max(projected, Math.floor(position) + 1)
    : Math.min(projected, Math.ceil(position) - 1);
}

export function settleDial(start: number, velocity: number, target: number, reduced: boolean,
  update: (position: number, speed: number) => void, seat: () => void, finish: () => void, extraGlide = 0) {
  let position = start;
  const distance = target - start;
  const direction = Math.sign(distance) || 1;
  const glide = Math.abs(distance) >= .5 || (Math.abs(distance) >= .02 && Math.abs(velocity) >= .5);
  if (velocity * direction < 0) velocity = 0;
  const travel = Math.abs(distance);
  const duration = reduced ? .16 : Math.min(1.55, .32 + .29 * Math.sqrt(travel)) + extraGlide;
  const averageSpeed = travel / duration;
  const startVelocity = direction * Math.min(reduced ? 0 : Math.abs(velocity), averageSpeed * 2.6);
  const endVelocity = direction * Math.min(reduced ? 0 : .65, averageSpeed * .15);
  let spring = !glide;
  let seated = false;
  let error = position - target;
  let frame = 0;
  const started = performance.now();
  let last = started;
  function step(now: number) {
    const elapsed = (now - started) / 1000;
    const delta = Math.min(.05, (now - last) / 1000);
    last = now;
    if (!spring && elapsed < duration) {
      const t = elapsed / duration, t2 = t*t, t3 = t2*t;
      position = (2*t3-3*t2+1)*start + (t3-2*t2+t)*duration*startVelocity + (-2*t3+3*t2)*target + (t3-t2)*duration*endVelocity;
      velocity = ((6*t2-6*t)*start + (-6*t2+6*t)*target)/duration + (3*t2-4*t+1)*startVelocity + (3*t2-2*t)*endVelocity;
    } else {
      if (!spring) { spring = true; position = target; velocity = endVelocity; error = 0; }
      const count = Math.max(1, Math.ceil(delta * 480));
      const h = delta / count;
      for (let i=0; i<count; i++) {
        velocity += (-625*(position-target) - 50*(reduced ? 1 : .58)*velocity)*h;
        position += velocity*h;
      }
      const nextError = position-target;
      if (!seated && (error*nextError <= 0 || Math.abs(nextError) < .006)) { seated = true; seat(); }
      error = nextError;
      if (Math.abs(error)<.0006 && Math.abs(velocity)<.01) { finish(); return; }
    }
    update(position, velocity);
    frame = requestAnimationFrame(step);
  }
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
