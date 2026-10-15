// Dev-only sample progress (load with ?demo) so screenshots show a mid-course player.
import { newProgress, levelId } from '../core/progress.js';

export function demoProgress() {
  const p = newProgress();
  const stars = [3, 3, 2, 3, 1, 2, 3, 2];
  stars.forEach((s, i) => {
    p.levels[levelId('noob', i + 1)] = { stars: s, best: [96, 97, 88, 95, 74, 86, 98, 90][i], attempts: 2 };
  });
  p.songs['hot-cross-buns'] = { unlocked: true };
  p.xp = 1700;
  return p;
}
