// Engines that are being built in small steps. They show in the engine picker as "Building" with a
// progress count. The daily agent advances `done` one stage at a time; the last stage moves the
// engine into ENGINES (src/data/engines.js) and deletes its entry here.
export const STAGES = ['Announced', 'Real-world figures drafted', 'Published in the atlas'];

export const UPCOMING = [
  {
    id: 'i6',
    short: '3.0L I6',
    name: '3.0L inline-six',
    sub: 'premium sedans',
    done: 1,
    draft: {
      cylinders: 6,
      bore: 0.084,
      stroke: 0.090,
      compression: 11,
      redline: 7000,
      firingOrder: [1, 5, 3, 6, 2, 4],
    },
  },
];
