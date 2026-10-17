// Parts catalogue and the ten engine systems. The system colours are data, not decoration:
// they tie a part in the list, its callout in the 3D view and the filter chips together.

export const SYSTEMS = [
  { id: 'Structure', color: '#6f7b86', blurb: 'The castings that hold everything in place and contain the pressure.' },
  { id: 'Motion', color: '#2a5db0', blurb: 'Pistons, rods and the crank: reciprocating motion turned into rotation.' },
  { id: 'Valvetrain', color: '#8a5cc2', blurb: 'Cams and valves that open and close the engine’s breathing passages.' },
  { id: 'Timing', color: '#0e8f8a', blurb: 'The chain that keeps the cams turning at exactly half crank speed.' },
  { id: 'Air & fuel', color: '#3b9ae1', blurb: 'Everything that brings air and fuel in, and feeds the exhaust out.' },
  { id: 'Ignition', color: '#d79a00', blurb: 'What lights the mixture at the right moment.' },
  { id: 'Cooling', color: '#20a56b', blurb: 'Carries waste heat from the cylinders to the radiator.' },
  { id: 'Lubrication', color: '#c47a14', blurb: 'Pressurised oil that keeps metal from touching metal.' },
  { id: 'Exhaust', color: '#c4452a', blurb: 'Cleans and quietens the burnt gas on its way out.' },
  { id: 'Starting', color: '#d5588a', blurb: 'Spins the engine to start it and recharges the battery.' },
];

export const SYSTEM_COLOR = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.color]));

// [system, part, description, fuel?]  (fuel limits a part to petrol or diesel engines)
const rows = [
  ['Structure', 'Engine block', 'The main casting. It holds the cylinder bores and carries oil and coolant passages.'],
  ['Structure', 'Cylinder liner', 'A hard, honed sleeve the piston slides in.'],
  ['Structure', 'Cylinder head', 'Closes the top of the cylinders. It holds the combustion chambers, ports and valves.'],
  ['Structure', 'Head gasket', 'A multi-layer steel seal between block and head. It keeps combustion gas, oil and coolant apart.'],
  ['Structure', 'Valve cover', 'Covers the valvetrain and keeps the oil in.'],
  ['Structure', 'Oil pan / sump', 'The reservoir at the bottom that collects oil and sheds heat.'],
  ['Motion', 'Piston', 'Takes the pressure of combustion and pushes the connecting rod. Its grooves hold the rings.'],
  ['Motion', 'Piston rings', 'Seal the gap between piston and wall, wipe oil away and pass heat to the cylinder.'],
  ['Motion', 'Wrist pin', 'The hardened pin that joins the piston to the small end of the connecting rod.'],
  ['Motion', 'Connecting rod', 'An I-beam link between piston and crank. It is stiff in compression and light in weight.'],
  ['Motion', 'Rod bearing', 'A thin soft-metal shell between the rod’s big end and the crank pin, floating on an oil film.'],
  ['Motion', 'Crankshaft', 'Turns the pistons’ up-and-down push into rotation. Counterweights balance the moving mass.'],
  ['Motion', 'Main bearing', 'Holds the crankshaft in the block and lets it spin on oil.'],
  ['Motion', 'Crank pulley', 'Drives the belt for the alternator and water pump. It also damps crank vibration.'],
  ['Motion', 'Flywheel / flexplate', 'A heavy disc that smooths out the power pulses and meshes with the starter.'],
  ['Valvetrain', 'Camshaft', 'Turns at half crank speed. Its lobes push the valves open at exactly the right crank angles.'],
  ['Valvetrain', 'Cam lobe', 'The egg-shaped bump that sets how far and how long a valve opens.'],
  ['Valvetrain', 'Intake valve', 'Opens to let fresh air (and fuel) into the cylinder.'],
  ['Valvetrain', 'Exhaust valve', 'Opens to let burnt gas out. It runs far hotter than the intake valve.'],
  ['Valvetrain', 'Valve spring', 'Snaps the valve shut and keeps it following the cam.'],
  ['Valvetrain', 'Rocker arm', 'A lever between cam and valve in engines that do not push the valve directly. This engine does not use one.'],
  ['Valvetrain', 'Valve guide', 'A sleeve in the head that keeps the valve stem straight.'],
  ['Valvetrain', 'Valve seat', 'The hardened ring the valve closes against. It seals the combustion chamber.'],
  ['Timing', 'Timing chain / belt', 'Links the crank to both camshafts so valves and pistons stay in step.'],
  ['Timing', 'Timing tensioner', 'Keeps the chain taut as it wears.'],
  ['Timing', 'Timing guide', 'A plastic blade that steadies the chain and stops it whipping.'],
  ['Air & fuel', 'Intake manifold', 'Shares the incoming air between the cylinders through individual runners.'],
  ['Air & fuel', 'Throttle body', 'Its flap sets how much air the engine can breathe.', 'petrol'],
  ['Air & fuel', 'Fuel rail', 'Holds pressurised fuel and feeds every injector.'],
  ['Air & fuel', 'Fuel injector', 'Sprays a fine, metered mist of fuel.'],
  ['Air & fuel', 'Air filter', 'Catches dust before it can scour the cylinders.'],
  ['Air & fuel', 'Exhaust manifold', 'Gathers burnt gas from each exhaust port and leads it to the exhaust system.'],
  ['Air & fuel', 'Turbocharger', 'Spins a turbine on exhaust gas to drive a compressor that forces extra air in.', 'diesel'],
  ['Air & fuel', 'Intercooler', 'Cools the compressed air so more of it fits in the cylinder.', 'diesel'],
  ['Ignition', 'Spark plug', 'Makes the spark that lights the mixture in a petrol engine.', 'petrol'],
  ['Ignition', 'Ignition coil', 'Steps battery voltage up to the many thousands of volts a spark needs.', 'petrol'],
  ['Ignition', 'Glow plug', 'A heater that makes a cold diesel start easily.', 'diesel'],
  ['Cooling', 'Water pump', 'Circulates coolant through the block, head and radiator.'],
  ['Cooling', 'Thermostat', 'Holds coolant in until the engine is warm, then lets it flow to the radiator.'],
  ['Cooling', 'Coolant jacket', 'Passages that wrap each cylinder so coolant can carry heat away.'],
  ['Cooling', 'Radiator', 'Passes coolant heat to the air flowing through its fins.'],
  ['Cooling', 'Cooling fan', 'Pulls air through the radiator when the car is not moving fast enough.'],
  ['Lubrication', 'Oil pump', 'Draws oil from the sump and pushes it round the engine under pressure.'],
  ['Lubrication', 'Oil filter', 'Traps metal particles and soot so they stay out of the bearings.'],
  ['Lubrication', 'Oil gallery', 'Drilled passages that carry oil to the bearings and the valvetrain.'],
  ['Lubrication', 'Oil jet', 'Squirts oil at the underside of the piston to cool it.'],
  ['Exhaust', 'Catalytic converter', 'A honeycomb coated in precious metals that turns the worst pollutants into harmless gases.'],
  ['Exhaust', 'Oxygen sensor', 'Reads the oxygen left in the exhaust so the engine computer can trim the fuel.'],
  ['Exhaust', 'EGR valve', 'Feeds a little exhaust back into the intake to cut combustion temperature and emissions.'],
  ['Starting', 'Starter motor', 'An electric motor that spins the flywheel to start the engine.'],
  ['Starting', 'Alternator', 'Turns belt power into electricity for the car and tops up the battery.'],
];

export const CATALOG = rows.map(([system, name, desc, only]) => ({ system, name, desc, only: only || null }));
export const PART_INFO = Object.fromEntries(CATALOG.map((p) => [p.name, p]));

/** Parts that make sense for this engine's fuel (a diesel has no spark plug, a petrol no turbo). */
export function partsFor(spec) {
  return CATALOG.filter((p) => !p.only || p.only === spec.fuel);
}
