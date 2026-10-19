// Peel-away layers (outermost first) and guided tours. Part names match the catalogue.
export const LAYERS = [
  { label: 'Complete engine', remove: [] },
  { label: 'Accessories and plumbing off', remove: ['Radiator', 'Cooling fan', 'Alternator', 'Starter motor', 'Air filter', 'Throttle body', 'Intake manifold', 'Exhaust manifold', 'Turbocharger', 'Intercooler', 'Catalytic converter', 'Oxygen sensor', 'EGR valve', 'Fuel rail', 'Fuel injector', 'Water pump', 'Thermostat', 'Oil filter', 'Crank pulley', 'Ignition coil'] },
  { label: 'Valve cover lifted off', remove: ['Valve cover', 'Spark plug', 'Glow plug'] },
  { label: 'Camshafts and timing drive off', remove: ['Camshaft', 'Cam lobe', 'Timing chain / belt', 'Timing tensioner', 'Timing guide', 'Rocker arm'] },
  { label: 'Cylinder head off', remove: ['Cylinder head', 'Head gasket', 'Intake valve', 'Exhaust valve', 'Valve spring', 'Valve guide', 'Valve seat'] },
  { label: 'Block off: the moving parts', remove: ['Engine block', 'Cylinder liner', 'Coolant jacket', 'Oil pan / sump', 'Oil gallery', 'Oil jet'] },
];

/** Parts hidden when the slider is at `step`. */
export function hiddenAt(step) {
  const out = new Set();
  for (let i = 1; i <= step; i++) for (const n of LAYERS[i].remove) out.add(n);
  return out;
}
/** First slider step at which a part disappears (0 if it never does). */
export function removalStep(name) {
  for (let i = 1; i < LAYERS.length; i++) if (LAYERS[i].remove.includes(name)) return i;
  return 0;
}

const S = (part, text, only) => ({ part, text, only });
export const TOURS = {
  air: {
    label: 'Air', color: '#3b9ae1',
    intro: 'Follow the air from the grille to the combustion chamber.',
    steps: [
      S('Air filter', 'Air arrives from outside and is cleaned here first. Grit that gets past would act like sandpaper on the cylinder walls.'),
      S('Turbocharger', 'A turbine spun by exhaust gas drives a compressor that forces the air in under pressure.', 'diesel'),
      S('Intercooler', 'Compressing air heats it. The intercooler cools it again so more air fits in each cylinder.', 'diesel'),
      S('Throttle body', 'The throttle flap opens as you press the pedal, and the engine can breathe more air.', 'petrol'),
      S('Intake manifold', 'The air is shared between the cylinders through runners of equal length.'),
      S('Intake valve', 'On the intake stroke the cam opens this valve and the piston’s downward motion draws the air in.'),
      S('Piston', 'The air ends up above the piston, where the next stroke squeezes it to about a tenth of its volume.'),
    ],
  },
  fuel: {
    label: 'Fuel', color: '#d79a00',
    intro: 'Follow the fuel from the rail to the flame.',
    steps: [
      S('Fuel rail', 'Fuel arrives from the tank and is held here under pressure, ready for every injector.'),
      S('Fuel injector', 'The engine computer opens the injector for a few milliseconds, spraying a fine mist of fuel.'),
      S('Spark plug', 'At the end of compression the plug sparks and lights the mixture.', 'petrol'),
      S('Glow plug', 'Diesel fuel lights by itself in very hot compressed air. This heater only helps a cold engine start.', 'diesel'),
      S('Piston', 'Burning gas expands and pushes the piston down. That push is what drives the car.'),
    ],
  },
  oil: {
    label: 'Oil', color: '#c47a14',
    intro: 'Follow the oil on its loop around the engine.',
    steps: [
      S('Oil pan / sump', 'Oil collects at the bottom of the engine and cools as it waits.'),
      S('Oil pump', 'The pump draws oil up through a screen and pushes it onward under pressure.'),
      S('Oil filter', 'Metal particles and soot are caught here, so they do not reach the bearings.'),
      S('Oil gallery', 'Drilled passages carry the oil to every part that needs it.'),
      S('Main bearing', 'The crankshaft turns on a thin film of oil. Metal never touches metal.'),
      S('Rod bearing', 'The same film protects where each connecting rod meets the crank.'),
      S('Oil jet', 'A small nozzle sprays oil on the underside of the piston to carry heat away.'),
      S('Camshaft', 'Oil also lubricates the camshaft and valves on top, then drains back down to the sump.'),
    ],
  },
  coolant: {
    label: 'Coolant', color: '#20a56b',
    intro: 'Follow the coolant as it carries the heat away.',
    steps: [
      S('Water pump', 'Pushes coolant through the engine. Without it the engine overheats in minutes.'),
      S('Coolant jacket', 'Coolant flows through passages around each cylinder and soaks up heat.'),
      S('Cylinder head', 'The hottest part of the engine, around the valves and combustion chambers, is cooled here.'),
      S('Thermostat', 'It stays closed until the engine is warm, then opens and lets coolant go on to the radiator.'),
      S('Radiator', 'Air flowing through the fins carries the heat out of the coolant.'),
      S('Cooling fan', 'When the car is slow or stopped, this fan pulls air through the radiator.'),
    ],
  },
  exhaust: {
    label: 'Exhaust', color: '#c4452a',
    intro: 'Follow the exhaust gas out of the engine.',
    steps: [
      S('Exhaust valve', 'At the end of the power stroke the exhaust valve opens, and burnt gas rushes out.'),
      S('Exhaust manifold', 'Pipes from each cylinder merge into one, tuned so pulses do not fight each other.'),
      S('Turbocharger', 'The gas spins the turbine here, using energy that would otherwise be wasted.', 'diesel'),
      S('EGR valve', 'A little exhaust is sent back into the intake to keep combustion cooler and cut emissions.', 'diesel'),
      S('Oxygen sensor', 'It reads the leftover oxygen so the computer can fine-tune the fuel mixture.'),
      S('Catalytic converter', 'The honeycomb turns the worst pollutants into carbon dioxide, water and nitrogen before the gas leaves the car.'),
    ],
  },
};

/** Tour steps that make sense for an engine's fuel. */
export function tourSteps(id, spec) {
  return TOURS[id].steps.filter((s) => !s.only || s.only === spec.fuel);
}
