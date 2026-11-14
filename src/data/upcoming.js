// Engines that are being built in small steps. They show in the engine picker as "Building" with a
// progress count. The daily agent advances `done` one stage at a time; the last stage moves the
// engine into ENGINES (src/data/engines.js) and deletes its entry here.
export const STAGES = ['Announced', 'Real-world figures drafted', 'Published in the atlas'];

export const UPCOMING = [
  {
    id: 'v6l',
    short: '3.5L V6',
    name: '3.5L V6',
    sub: 'large SUVs and minivans',
    done: 0,
  },
];
