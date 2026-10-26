// Engines that are being built in small steps. They show in the engine picker as "Building" with a
// progress count. The daily agent advances `done` one stage at a time; the last stage moves the
// engine into ENGINES (src/data/engines.js) and deletes its entry here.
export const STAGES = ['Announced', 'Real-world figures drafted', 'Published in the atlas'];

export const UPCOMING = [
  {
    id: 'i4m',
    short: '2.5L I4',
    name: '2.5L Inline-4 petrol',
    sub: 'Mid-size sedans',
    done: 0,
  },
];
