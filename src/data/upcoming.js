// Engines that are being built in small steps. They show in the engine picker as "Building" with a
// progress count. The daily agent advances `done` one stage at a time; the last stage moves the
// engine into ENGINES (src/data/engines.js) and deletes its entry here.
export const STAGES = ['Announced', 'Real-world figures drafted', 'Published in the atlas'];

export const UPCOMING = [
  {
    id: 'd4s',
    short: 'D4',
    name: '1.5L Turbo-Diesel Four',
    sub: 'Small SUVs and hatchbacks',
    done: 1,
    draft: {
      cylinders: 4,
      bore: 0.075,
      stroke: 0.0848,
      compression: 16.5,
      redline: 4800,
      firingOrder: [1, 3, 4, 2],
    },
  },
];
