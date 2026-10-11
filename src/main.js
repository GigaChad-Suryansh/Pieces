import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EnginePhysics} from './physics.js';
import {setupQuiz} from './quiz.js';

const engines={
 i4:{name:'2.0L Inline-4',sub:'Petrol · DOHC · 16 valves',cyl:4,bore:1.75,stroke:2.05},
 v6:{name:'3.0L V6',sub:'Petrol · DOHC · 24 valves',cyl:6,bore:1.55,stroke:1.95},
 diesel:{name:'2.2L Turbo Diesel',sub:'Diesel · common rail · turbo',cyl:4,bore:1.82,stroke:2.15},
 bike:{name:'1.0L Motorcycle',sub:'Petrol · DOHC · high-revving',cyl:4,bore:1.42,stroke:1.75}
};
const catalog=[
['Structure','Engine block','Main structural casting containing cylinder bores and oil/coolant passages.'],
['Structure','Cylinder liner','Precision bore surface in which the piston travels.'],
['Structure','Cylinder head','Closes the cylinders and carries combustion chambers, ports and valvetrain.'],
['Structure','Head gasket','Seals combustion pressure and oil/coolant passages between head and block.'],
['Structure','Valve cover','Covers the upper valvetrain and retains lubricant.'],
['Structure','Oil pan / sump','Reservoir at the bottom of the engine that collects oil.'],
['Motion','Piston','Receives combustion pressure and transfers force to the connecting rod.'],
['Motion','Piston rings','Seal combustion gases, control oil and transfer heat to the cylinder wall.'],
['Motion','Wrist pin','Connects the piston to the small end of the connecting rod.'],
['Motion','Connecting rod','Transfers force between piston and crankshaft.'],
['Motion','Rod bearing','Precision bearing between the rod big end and crank journal.'],
['Motion','Crankshaft','Converts piston reciprocation into rotary motion.'],
['Motion','Main bearing','Supports crankshaft journals inside the block.'],
['Motion','Crank pulley','Front pulley for accessory drive and timing reference.'],
['Motion','Flywheel / flexplate','Adds rotational inertia and couples the crankshaft to the transmission.'],
['Valvetrain','Camshaft','Runs at half crank speed in a four-stroke engine and controls valve events.'],
['Valvetrain','Cam lobe','Eccentric profile that produces valve lift.'],
['Valvetrain','Intake valve','Admits fresh charge into the combustion chamber.'],
['Valvetrain','Exhaust valve','Releases combustion products.'],
['Valvetrain','Valve spring','Returns a valve toward its seat and maintains contact.'],
['Valvetrain','Rocker arm','Lever transmitting cam motion to a valve in rocker-based layouts.'],
['Valvetrain','Valve guide','Guides the valve stem.'],
['Valvetrain','Valve seat','Machined sealing surface for a closed valve.'],
['Timing','Timing chain / belt','Synchronizes crankshaft and camshaft rotation.'],
['Timing','Timing tensioner','Maintains timing-drive tension.'],
['Timing','Timing guide','Controls timing-chain path and vibration.'],
['Air & fuel','Intake manifold','Distributes incoming air or charge to the cylinders.'],
['Air & fuel','Throttle body','Controls intake airflow in throttle-controlled gasoline engines.'],
['Air & fuel','Fuel rail','Supplies pressurized fuel to injectors.'],
['Air & fuel','Fuel injector','Meters and atomizes fuel.'],
['Air & fuel','Air filter','Removes particles from intake air.'],
['Air & fuel','Exhaust manifold','Collects exhaust gas from cylinder outlets.'],
['Air & fuel','Turbocharger','Uses exhaust energy to compress intake air.'],
['Air & fuel','Intercooler','Cools compressed intake air in boosted systems.'],
['Ignition','Spark plug','Creates the spark that initiates combustion in gasoline engines.'],
['Ignition','Ignition coil','Raises battery voltage for the spark plug.'],
['Ignition','Glow plug','Assists cold starting and combustion in diesel engines.'],
['Cooling','Water pump','Circulates coolant through the engine and cooling circuit.'],
['Cooling','Thermostat','Regulates coolant flow and operating temperature.'],
['Cooling','Coolant jacket','Passages around hot areas carrying heat into coolant.'],
['Cooling','Radiator','Rejects coolant heat to ambient air.'],
['Cooling','Cooling fan','Moves air through the radiator when required.'],
['Lubrication','Oil pump','Draws oil from the sump and supplies pressurized lubricant.'],
['Lubrication','Oil filter','Removes particles and contaminants from engine oil.'],
['Lubrication','Oil gallery','Internal passage carrying lubricant to bearings and components.'],
['Lubrication','Oil jet','Directs lubricant toward piston undersides on some engines.'],
['Exhaust','Catalytic converter','Uses catalyst surfaces to reduce regulated exhaust pollutants.'],
['Exhaust','Oxygen sensor','Measures exhaust oxygen for engine-control feedback.'],
['Exhaust','EGR valve','Routes controlled exhaust gas back to the intake on equipped engines.'],
['Starting','Starter motor','Electric motor that rotates the crankshaft during startup.'],
['Starting','Alternator','Generates electrical power and maintains the vehicle battery.']
];
const info=Object.fromEntries(catalog.map(x=>[x[1],{system:x[0],desc:x[2]}]));
const state={engine:'i4',selected:'Piston',system:'All',search:'',explode:false,cutaway:false,isolate:false,running:false,rpm:900,cycle:0,throttle:18,load:25};
let plotClock=0;const history={rpm:[],torque:[],temp:[]};let animationLoopStarted=false,resizeHandlerBound=false;
let physics=new EnginePhysics(state.engine);
let scene,camera,renderer,controls,raycaster,mouse,root,parts=[],moving=[],crankParts=[],camParts=[],valveParts=[],last=performance.now(),focusTarget=new THREE.Vector3(0,.7,0),focusCamera=new THREE.Vector3(10,6.5,13),focusAnimating=false;

document.querySelector('#app').innerHTML=`
<header class="topbar"><div class="brand">PIECES <span>ENGINEVERSE</span></div><div class="search"><span>⌕</span><input id="search" placeholder="Search parts, systems, engines…"></div><nav><button class="nav active" data-tab="library">Library</button><button class="nav" data-tab="learn">Learn</button><button class="nav" data-tab="compare">Compare</button></nav><kbd>K</kbd><div class="avatar">S</div></header>
<main class="appShell"><section class="intro"><div><span class="eyebrow">INTERACTIVE 3D ENGINEERING LAB</span><h1>See how an engine<br><em>actually moves.</em></h1><p>Rotate real-world-inspired engine assemblies, inspect individual parts and watch the four-stroke mechanism move in real time.</p></div><div class="stats"><b>50+</b><span>catalogued parts</span><b>4</b><span>road-engine families</span><b>720°</b><span>four-stroke cycle</span></div></section><section id="workspace"></section></main>`;

const M={steel:new THREE.MeshPhysicalMaterial({color:0x777b78,roughness:.25,metalness:.9,clearcoat:.18}),alloy:new THREE.MeshPhysicalMaterial({color:0xc4c7c3,roughness:.34,metalness:.78,clearcoat:.22}),dark:new THREE.MeshPhysicalMaterial({color:0x252827,roughness:.23,metalness:.88,clearcoat:.12}),black:new THREE.MeshPhysicalMaterial({color:0x121413,roughness:.58,metalness:.2}),red:new THREE.MeshPhysicalMaterial({color:0xb94139,roughness:.28,metalness:.48,clearcoat:.25}),blue:new THREE.MeshPhysicalMaterial({color:0x3d6ea4,roughness:.3,metalness:.45,clearcoat:.2}),gold:new THREE.MeshPhysicalMaterial({color:0xd0a044,roughness:.22,metalness:.86,clearcoat:.2}),rubber:new THREE.MeshStandardMaterial({color:0x202220,roughness:.8}),white:new THREE.MeshPhysicalMaterial({color:0xe7e8e4,roughness:.4,metalness:.25,clearcoat:.18}),copper:new THREE.MeshPhysicalMaterial({color:0xa85f35,roughness:.24,metalness:.82})};
const geo={box:(x,y,z,r=.12)=>new THREE.BoxGeometry(x,y,z),cyl:(r,h,s=32)=>new THREE.CylinderGeometry(r,r,h,s),tor:(R,r)=>new THREE.TorusGeometry(R,r,16,48)};
function add(g,m,name,system,parent=root){const o=new THREE.Mesh(g,m);o.userData={part:name,system};o.castShadow=o.receiveShadow=true;parent.add(o);parts.push(o);return o}
function init3D(){
 try{
 physics=new EnginePhysics(state.engine);physics.throttle=state.throttle/100;physics.load=state.load/100;physics.rpm=state.rpm;physics.theta=state.cycle;
 const el=document.querySelector('#viewport');if(renderer){controls?.dispose();renderer.dispose();renderer.domElement.remove();renderer=null;}scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f0ec);
 camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(10,6.5,13);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;el.appendChild(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=5;controls.maxDistance=23;controls.target.set(0,.7,0);
 raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();
 scene.add(new THREE.HemisphereLight(0xffffff,0x666862,2.35));const l=new THREE.DirectionalLight(0xffffff,4.2);l.position.set(7,12,9);l.castShadow=true;l.shadow.mapSize.set(2048,2048);l.shadow.camera.near=.1;l.shadow.camera.far=50;scene.add(l);const f=new THREE.DirectionalLight(0xc7d5e4,1.7);f.position.set(-8,5,-8);scene.add(f);const rim=new THREE.DirectionalLight(0xffd7b0,1.1);rim.position.set(4,3,-10);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(14,80),new THREE.MeshStandardMaterial({color:0xdedfd9,roughness:.88,metalness:.05}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.25;floor.receiveShadow=true;scene.add(floor);const grid=new THREE.GridHelper(24,24,0xc7c8c2,0xd4d5d0);grid.position.y=-2.23;grid.material.opacity=.32;grid.material.transparent=true;scene.add(grid);const halo=new THREE.Mesh(new THREE.RingGeometry(6.5,6.55,96),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=-2.2;scene.add(halo);
 build();resize();if(!resizeHandlerBound){window.addEventListener('resize',resize);resizeHandlerBound=true;}renderer.domElement.addEventListener('pointermove',pointer);renderer.domElement.addEventListener('click',e=>{pointer(e);pick();});requestRenderMeta();drawInstrumentation();if(!animationLoopStarted){animationLoopStarted=true;requestAnimationFrame(loop);}
 }catch(err){
   console.error('Engine Atlas 3D initialization failed:',err);
   const el=document.querySelector('#viewport');
   if(el) el.insertAdjacentHTML('beforeend',`<div class="engineError"><b>3D simulation could not start</b><span>${String(err?.message||err)}</span><small>Try Chrome/Edge with hardware acceleration enabled.</small></div>`);
 }
}
function build(){
 root=new THREE.Group();scene.add(root);parts=[];moving=[];crankParts=[];camParts=[];valveParts=[];const E=engines[state.engine],n=E.cyl,s=3,xs=Array.from({length:n},(_,i)=>(i-(n-1)/2)*s);
 const block=add(geo.box(n*2.55,3.8,4.8,.2),M.alloy,'Engine block','Structure');const pan=add(geo.box(n*2.7,1.05,4.95,.18),M.black,'Oil pan / sump','Structure');pan.position.y=-2.35;
 const head=add(geo.box(n*2.48,1.5,4.65,.18),M.alloy,'Cylinder head','Structure');head.position.y=2.55;
 const cover=add(geo.box(n*2.42,.55,4.5,.14),M.dark,'Valve cover','Structure');cover.position.y=3.62;
 const gasket=add(geo.box(n*2.36,.12,4.4,.04),M.rubber,'Head gasket','Structure');gasket.position.y=1.78;
 xs.forEach((x,i)=>{
  const liner=add(geo.cyl(E.bore,3.55,32),M.steel,'Cylinder liner','Structure');liner.position.x=x;liner.scale.z=.86;
  const piston=add(geo.cyl(E.bore*.9,.72,32),M.alloy,'Piston','Motion');piston.position.set(x,.4,0);
  for(let r=0;r<3;r++){const ring=add(geo.tor(E.bore*.9,.055),r===2?M.gold:M.dark,'Piston rings','Motion',piston);ring.rotation.x=Math.PI/2;ring.position.y=.22-r*.13}
  const pin=add(geo.cyl(.16,.9,20),M.steel,'Wrist pin','Motion',piston);pin.rotation.z=Math.PI/2;
  const rodShape=new THREE.Shape();
  rodShape.moveTo(-.17,-.91);rodShape.lineTo(-.105,-.34);rodShape.lineTo(-.085,.34);rodShape.lineTo(-.15,.91);rodShape.lineTo(.15,.91);rodShape.lineTo(.085,.34);rodShape.lineTo(.105,-.34);rodShape.lineTo(.17,-.91);rodShape.closePath();
  const rodGeometry=new THREE.ExtrudeGeometry(rodShape,{depth:.14,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025});
  const rod=add(rodGeometry,M.steel,'Connecting rod','Motion');rod.position.set(x,-.55,-.08);rod.userData.baseScale=rod.scale.clone();
  const bearing=add(geo.cyl(.52,.38,24),M.dark,'Rod bearing','Motion');bearing.rotation.z=Math.PI/2;bearing.position.set(x,-1.48,0);
  const iv=add(geo.cyl(.13,.72,18),M.blue,'Intake valve','Valvetrain');iv.position.set(x-.48,2.03,.2);
  const ev=add(geo.cyl(.13,.72,18),M.red,'Exhaust valve','Valvetrain');ev.position.set(x+.48,2.03,.2);valveParts.push({mesh:iv,baseY:iv.position.y,type:'intake',phase:[0,360,360,0,240,120][i]||0});valveParts.push({mesh:ev,baseY:ev.position.y,type:'exhaust',phase:[0,360,360,0,240,120][i]||0});
  const plug=add(geo.cyl(.09,.5,16),M.gold,'Spark plug','Ignition');plug.position.set(x,2.83,.2);
  moving.push({piston,rod,phase:[0,Math.PI,Math.PI,0,Math.PI*2/3,Math.PI/3][i]||0});
 });
 const crank=add(geo.cyl(.31,n*3.15,32),M.dark,'Crankshaft','Motion');crank.rotation.z=Math.PI/2;crank.position.y=-1.48;crankParts.push(crank);
 xs.forEach((x,i)=>{const w=add(geo.cyl(.68,.32,28),M.steel,'Crankshaft','Motion');w.rotation.z=Math.PI/2;w.position.set(x,-1.48,0);crankParts.push(w);const throwArm=add(geo.box(.38,1.05,.48,.08),M.steel,'Crankshaft','Motion');throwArm.position.set(x,-1.15,0);throwArm.userData.crankThrow=true;throwArm.userData.phase=[0,Math.PI,Math.PI,0,Math.PI*2/3,Math.PI/3][i]||0;crankParts.push(throwArm)});
 const main=add(geo.cyl(.47,n*3.05,28),M.gold,'Main bearing','Motion');main.rotation.z=Math.PI/2;main.position.y=-1.48;main.scale.z=.7;crankParts.push(main);
 const fly=add(geo.cyl(1.62,.38,48),M.dark,'Flywheel / flexplate','Motion');fly.rotation.z=Math.PI/2;fly.position.set(n*1.7,-1.48,0);crankParts.push(fly);
 const camAssembly=new THREE.Group();camAssembly.position.set(0,3,.75);root.add(camAssembly);const cam=add(geo.cyl(.24,n*3,24),M.dark,'Camshaft','Valvetrain',camAssembly);cam.rotation.z=Math.PI/2;camParts.push(camAssembly);
 xs.forEach(x=>[0,1].forEach(j=>{const l=add(geo.cyl(.42,.2,20),M.steel,'Cam lobe','Valvetrain',camAssembly);l.rotation.z=Math.PI/2;l.position.set(x+(j-.5)*.52,(j===0?-.30:.30),0)}));
 const timing=add(geo.tor(1.2,.13),M.dark,'Timing chain / belt','Timing');timing.rotation.x=Math.PI/2;timing.position.set(-n*1.45,1,0);
 const intake=add(geo.box(n*2.35,.72,1.25,.12),M.blue,'Intake manifold','Air & fuel');intake.position.set(0,3.08,2.55);
 const throttle=add(geo.cyl(.48,1,24),M.steel,'Throttle body','Air & fuel');throttle.rotation.x=Math.PI/2;throttle.position.set(0,3.08,3.2);
 const exhaust=add(geo.box(n*2.3,.72,1,.12),M.red,'Exhaust manifold','Air & fuel');exhaust.position.set(0,2.35,-2.45);
 const turbo=add(geo.tor(.82,.28),M.steel,'Turbocharger','Air & fuel');turbo.rotation.x=Math.PI/2;turbo.position.set(n*1.7,1.7,-3);const turboHub=add(geo.cyl(.28,.42,28),M.gold,'Turbocharger','Air & fuel',root);turboHub.rotation.x=Math.PI/2;turboHub.position.set(n*1.7,1.7,-3);for(let i=0;i<8;i++){const blade=add(geo.box(.08,.5,.04,.02),M.steel,'Turbocharger','Air & fuel',root);blade.position.set(n*1.7+Math.cos(i*Math.PI/4)*.42,1.7+Math.sin(i*Math.PI/4)*.42,-3);blade.rotation.z=i*Math.PI/4;}
 const oil=add(geo.cyl(.5,.42,24),M.dark,'Oil pump','Lubrication');oil.rotation.z=Math.PI/2;oil.position.set(-n*1.3,-1.9,.8);
 const filter=add(geo.cyl(.42,.75,24),M.white,'Oil filter','Lubrication');filter.position.set(-n*1.2,-.8,2.35);
 const water=add(geo.cyl(.65,.35,28),M.blue,'Water pump','Cooling');water.rotation.z=Math.PI/2;water.position.set(-n*1.5,0,2.35);
 const starter=add(geo.cyl(.38,1.1,24),M.dark,'Starter motor','Starting');starter.rotation.z=Math.PI/2;starter.position.set(n*1.7,-.8,2.1);
 const alt=add(geo.cyl(.62,.42,32),M.alloy,'Alternator','Starting');alt.rotation.z=Math.PI/2;alt.position.set(-n*1.65,1.15,2.2);for(let i=0;i<10;i++){const fin=add(geo.box(.035,.42,.05,.01),M.dark,'Alternator','Starting',alt);fin.position.x=Math.cos(i*Math.PI/5)*.34;fin.position.y=Math.sin(i*Math.PI/5)*.34;fin.rotation.z=i*Math.PI/5;}

 // Precision details: cast ribs, machined fasteners, ports, springs, gears and accessory hardware.
 const bolt=(x,y,z,name='Cylinder head',system='Structure',radius=.075)=>{
   const b=add(new THREE.CylinderGeometry(radius,radius,.075,8),M.steel,name,system);
   b.position.set(x,y,z);b.rotation.y=Math.PI/8;
   const slot=add(geo.box(radius*1.1,.012,.025,.002),M.dark,name,system);
   slot.position.set(x,y+.039,z);
   return b;
 };
 const pipe=(points,name,system,material,radius=.12)=>{
   const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
   return add(new THREE.TubeGeometry(curve,28,radius,10,false),material,name,system);
 };
 // Cast aluminium block ribs and machined side covers.
 for(let y=-1.35;y<=1.25;y+=.52){
   const rib=add(geo.box(n*2.34,.105,.12,.025),M.steel,'Engine block','Structure');
   rib.position.set(0,y,2.43);
   const rearRib=add(geo.box(n*2.34,.105,.12,.025),M.dark,'Engine block','Structure');
   rearRib.position.set(0,y,-2.43);
 }
 const sideCover=add(geo.box(n*1.65,1.55,.09,.08),M.dark,'Engine block','Structure');
 sideCover.position.set(0,-.05,2.51);
 const sideInset=add(geo.box(n*1.48,1.34,.035,.04),M.alloy,'Engine block','Structure');
 sideInset.position.set(0,-.05,2.565);
 for(let i=0;i<Math.max(4,n*2);i++){
   const x=(i-(Math.max(4,n*2)-1)/2)*.62;
   for(const z of [-2.49,2.59]){
     bolt(x,-1.55,z,'Engine block','Structure',.055);
     bolt(x,1.43,z,'Engine block','Structure',.055);
   }
 }
 // Head deck fasteners, valve-cover ribs and cap screws.
 for(const x of xs){
   for(const dx of [-.92,.92]) for(const z of [-1.8,1.8]) bolt(x+dx,3.31,z,'Cylinder head','Structure',.085);
   for(const z of [-1.85,1.85]){
     const coverBolt=bolt(x,3.94,z,'Valve cover','Structure',.065);
     coverBolt.material=M.gold;
   }
 }
 for(let i=0;i<Math.max(5,n+1);i++){
   const x=(i-(Math.max(5,n+1)-1)/2)*1.05;
   const ridge=add(geo.box(.1,.07,3.95,.025),M.steel,'Valve cover','Structure');
   ridge.position.set(x,3.94,0);
 }
 // Air-cooled bike cylinder fins; on car engines the same visual detail is cast reinforcement.
 if(state.engine==='bike'){
   for(let y=1.9;y<=2.65;y+=.12){
     const fin=add(geo.box(n*2.28,.045,5.02,.015),M.steel,'Cylinder head','Structure');
     fin.position.set(0,y,0);
   }
 }
 // Individual intake runners and exhaust primaries instead of plain manifold blocks alone.
 for(const x of xs){
   pipe([[x,2.75,.55],[x,2.9,1.1],[x,3.04,1.7],[x,3.08,2.28]],'Intake manifold','Air & fuel',M.alloy,.145);
   pipe([[x,2.35,-.48],[x,2.27,-1.05],[x,2.35,-1.72],[x,2.35,-2.38]],'Exhaust manifold','Air & fuel',M.copper,.14);
   // Flanges and clamp collars at each runner junction.
   for(const z of [1.95,-1.95]){
     const flange=add(geo.cyl(.22,.09,24),M.steel,z>0?'Intake manifold':'Exhaust manifold','Air & fuel');
     flange.rotation.x=Math.PI/2;flange.position.set(x,z>0?3.06:2.35,z);
   }
 }
 // Valve guides, retainers and visible coil springs for every intake/exhaust valve.
 const springMat=new THREE.MeshStandardMaterial({color:0x9da5ad,metalness:.92,roughness:.24});
 xs.forEach((x,i)=>{
   for(const side of [-1,1]){
     const vx=x+side*.48;
     const guide=add(geo.cyl(.18,.3,24),M.gold,side<0?'Intake valve':'Exhaust valve','Valvetrain');
     guide.position.set(vx,2.48,.2);
     const retainer=add(geo.cyl(.2,.09,24),M.steel,side<0?'Intake valve':'Exhaust valve','Valvetrain');
     retainer.position.set(vx,2.72,.2);
     const pts=[];
     for(let j=0;j<=72;j++){
       const t=j/72,angle=t*Math.PI*12;
       pts.push(new THREE.Vector3(vx+Math.cos(angle)*.145,2.08+t*.57,.2+Math.sin(angle)*.145));
     }
     const spring=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),180,.022,6,false),springMat,side<0?'Intake valve':'Exhaust valve','Valvetrain');
     spring.userData.springPhase=i*Math.PI;
     const keeper=add(geo.cyl(.11,.07,12),M.dark,side<0?'Intake valve':'Exhaust valve','Valvetrain');
     keeper.position.set(vx,2.77,.2);
   }
   // Spark plug ceramic, hex nut and ground electrode.
   const ceramic=add(geo.cyl(.105,.24,20),M.white,'Spark plug','Ignition');
   ceramic.position.set(x,2.91,.2);
   const hex=add(new THREE.CylinderGeometry(.14,.14,.13,6),M.steel,'Spark plug','Ignition');
   hex.position.set(x,2.78,.2);
   const electrode=add(geo.cyl(.025,.12,12),M.gold,'Spark plug','Ignition');
   electrode.position.set(x,2.57,.2);
   // Machined connecting-rod big-end caps and exposed fasteners.
   const cap=add(geo.tor(.29,.065),M.steel,'Rod bearing','Motion');
   cap.rotation.x=Math.PI/2;cap.position.set(x,-1.48,.02);
   for(const side of [-1,1]){
     const nut=add(new THREE.CylinderGeometry(.075,.075,.1,6),M.gold,'Rod bearing','Motion');
     nut.position.set(x+side*.28,-1.43,.16);
   }
 });
 // Timing drive: toothed crank and cam sprockets, chain links and alignment marks.
 for(const [x,y,r,label] of [[-n*1.45,1,0.58,'Timing chain / belt'],[-n*1.45,2.18,.42,'Timing chain / belt']]){
   const gear=add(geo.cyl(r,.22,40),M.dark,label,'Timing');
   gear.rotation.z=Math.PI/2;gear.position.set(x,y,-.15);
   const hub=add(geo.cyl(r*.3,.28,24),M.gold,label,'Timing');
   hub.rotation.z=Math.PI/2;hub.position.set(x,y,-.15);
   for(let t=0;t<24;t++){
     const a=t*Math.PI/12;
     const tooth=add(geo.box(.13,.12,.2,.02),M.steel,label,'Timing');
     tooth.position.set(x+Math.cos(a)*(r+.025),y+Math.sin(a)*(r+.025),-.15);
     tooth.rotation.z=a;
   }
 }
 for(let i=0;i<36;i++){
   const a=i*Math.PI/18;
   const link=add(geo.box(.11,.055,.045,.012),i%2?M.steel:M.dark,'Timing chain / belt','Timing');
   link.position.set(-n*1.45+Math.cos(a)*.96,1.58+Math.sin(a)*.96,-.08);
   link.rotation.z=a+Math.PI/2;
 }
 const timingMark=add(geo.box(.045,.22,.025,.008),M.gold,'Timing chain / belt','Timing');
 timingMark.position.set(-n*1.45+.58,1,-.28);
 // Accessory drive: detailed pulley grooves, spokes and belt path.
 for(const [x,y,r] of [[-n*1.65,1.15,.62],[-n*1.5,0,.48],[n*1.7,-.8,.35]]){
   for(let k=0;k<4;k++){
     const groove=add(geo.tor(r-k*.075,.027),M.dark,'Accessory belt','Starting');
     groove.position.set(x,y,2.22-k*.035);
   }
   const hub=add(geo.cyl(r*.24,.5,28),M.gold,'Accessory belt','Starting');
   hub.rotation.x=Math.PI/2;hub.position.set(x,y,2.22);
   for(let k=0;k<6;k++){
     const a=k*Math.PI/3;
     const spoke=add(geo.box(r*.72,.065,.08,.018),M.steel,'Accessory belt','Starting');
     spoke.position.set(x+Math.cos(a)*r*.48,y+Math.sin(a)*r*.48,2.22);
     spoke.rotation.z=a;
   }
 }
 // Realistic turbocharger compressor wheel with swept, individually visible blades.
 const turboX=n*1.7,turboY=1.7,turboZ=-3;
 const turboRim=add(geo.tor(.72,.075),M.dark,'Turbocharger','Air & fuel');
 turboRim.rotation.x=Math.PI/2;turboRim.position.set(turboX,turboY,turboZ-.24);
 for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   const blade=add(geo.box(.16,.48,.055,.025),i%2?M.steel:M.alloy,'Turbocharger','Air & fuel');
   blade.position.set(turboX+Math.cos(a)*.34,turboY+Math.sin(a)*.34,turboZ-.29);
   blade.rotation.z=a+.45;
 }
 const turboNut=add(new THREE.CylinderGeometry(.16,.16,.12,6),M.gold,'Turbocharger','Air & fuel');
 turboNut.rotation.x=Math.PI/2;turboNut.position.set(turboX,turboY,turboZ-.34);
 // Oil galleries and coolant hose runs bring detail to the front accessories.
 pipe([[-n*1.45,.15,2.48],[-n*1.25,.35,2.78],[-n*1.1,.1,2.8],[-n*.9,-.35,2.5]],'Water pump','Cooling',M.blue,.09);
 pipe([[n*1.2,-.55,2.48],[n*1.4,-.3,2.8],[n*1.55,-.6,2.82],[n*1.65,-.8,2.48]],'Oil filter','Lubrication',M.black,.085);
 // Gearbox cutaway cluster: stacked gears with tooth detail, bearing races and shafts.
 const gearOriginX=n*1.55,gearOriginY=-1.55,gearOriginZ=-2.72;
 for(const [idx,r] of [[0,.62],[1,.42],[2,.29]]){
   const gx=gearOriginX+idx*.72,gy=gearOriginY+(idx%2)*.18;
   const gear=add(geo.cyl(r,.22,36),idx===1?M.gold:M.steel,'Gearbox','Transmission');
   gear.rotation.x=Math.PI/2;gear.position.set(gx,gy,gearOriginZ);
   const hub=add(geo.cyl(r*.24,.32,20),M.dark,'Gearbox','Transmission');
   hub.rotation.x=Math.PI/2;hub.position.set(gx,gy,gearOriginZ);
   for(let t=0;t<24;t++){
     const a=t*Math.PI/12;
     const tooth=add(geo.box(.12,.12,.2,.015),M.steel,'Gearbox','Transmission');
     tooth.position.set(gx+Math.cos(a)*(r+.025),gy+Math.sin(a)*(r+.025),gearOriginZ);
     tooth.rotation.z=a;
   }
 }
 const gearCase=add(geo.box(3.2,1.35,.22,.12),M.dark,'Gearbox','Transmission');
 gearCase.position.set(gearOriginX+.55,gearOriginY-.15,gearOriginZ-.24);
 for(let i=0;i<8;i++){
   const x=gearOriginX-.75+(i%4)*.85,y=gearOriginY-.62+Math.floor(i/4)*.9;
   bolt(x,y,gearOriginZ-.37,'Gearbox','Transmission',.055);
 }

 updateVisibility();select(state.selected,false)
}
function updateVisibility(){
 parts.forEach(o=>o.visible=(state.system==='All'||o.userData.system===state.system)&&(!state.isolate||o.userData.part===state.selected));
 const block=parts.find(o=>o.userData.part==='Engine block');if(block)block.material=state.cutaway?new THREE.MeshStandardMaterial({color:0xb8bbb7,transparent:true,opacity:.15,metalness:.5,roughness:.55}):M.alloy;
}
function highlight(name){parts.forEach(o=>{if(o.userData.originalMaterial&&!o.userData.originalMaterial.emissive){};if(o.userData.highlighted&&o.userData.originalMaterial){o.material=o.userData.originalMaterial;o.userData.highlighted=false}});const selected=parts.filter(o=>o.userData.part===name);selected.forEach(o=>{if(!o.userData.originalMaterial)o.userData.originalMaterial=o.material;o.material=o.userData.originalMaterial.clone();if(o.material.emissive){o.material.emissive.set(0x6b706c);o.material.emissiveIntensity=.22}o.userData.highlighted=true})}
function select(name,focus=true){
 state.selected=name;highlight(name);document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===name));
 const d=document.querySelector('#detail');if(d)d.innerHTML=`<span class="detailLabel">${info[name]?.system||'ENGINE'} · COMPONENT</span><h3>${name}</h3><p>${info[name]?.desc||'Mechanical component in the engine assembly.'}</p><div class="chips"><span>3D SELECTABLE</span><span>INTERACTIVE</span></div>`;
 if(focus){const o=parts.find(x=>x.userData.part===name);if(o){focusTarget.copy(o.getWorldPosition(new THREE.Vector3()));const offset=new THREE.Vector3(4.8,2.8,6.5);focusCamera.copy(focusTarget).add(offset);focusAnimating=true;}}
}
function pointer(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1}
function pick(){raycaster.setFromCamera(mouse,camera);const h=raycaster.intersectObjects(parts,true)[0];if(h){let o=h.object;while(o&&!o.userData.part)o=o.parent;if(o?.userData.part){select(o.userData.part);document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===state.selected))}}}
function resize(){if(!renderer)return;const el=document.querySelector('#viewport');if(!el||!el.clientWidth||!el.clientHeight)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight,false)}
function explode(){
 parts.forEach(o=>{if(!o.userData.base)o.userData.base=o.position.clone();let d=new THREE.Vector3(),n=o.userData.part;
  if(['Cylinder head','Valve cover','Head gasket','Camshaft','Cam lobe','Intake valve','Exhaust valve','Spark plug'].includes(n))d.y=2.3;
  if(['Piston','Piston rings','Wrist pin'].includes(n))d.y=1.15;
  if(['Connecting rod','Rod bearing'].includes(n))d.y=-1;
  if(['Crankshaft','Main bearing','Oil pump'].includes(n))d.y=-1.5;
  if(n==='Oil pan / sump')d.y=-2.7;if(['Intake manifold','Throttle body'].includes(n))d.z=2.5;if(['Exhaust manifold','Turbocharger'].includes(n))d.z=-2.6;if(['Alternator','Water pump','Starter motor','Oil filter'].includes(n))d.x=2.5;
  const target=o.userData.base.clone().add(d);o.position.lerp(state.explode?target:o.userData.base,.16);
 });
}
function loop(now){
 requestAnimationFrame(loop);
 const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;
 if(state.running){physics.throttle=state.throttle/100;physics.load=state.load/100;const snap=physics.step(dt);state.rpm=snap.rpm;state.cycle=snap.theta;}else{physics.theta=state.cycle;physics.rpm=state.rpm;}
 const crankRad=state.cycle*Math.PI/180;
 crankParts.forEach(o=>{if(o.userData.crankThrow){const a=crankRad+(o.userData.phase||0);o.position.y=-1.48+Math.cos(a)*.72;o.position.z=Math.sin(a)*.72;o.rotation.x=a;}else if(o.userData.part==='Crankshaft'||o.userData.part==='Flywheel / flexplate'){o.rotation.x=crankRad;}});
 camParts.forEach(o=>{o.rotation.x=crankRad/2;});
 moving.forEach(m=>{const a=crankRad+m.phase,y=.05+Math.cos(a)*.82;const crankZ=Math.sin(a)*.72,crankY=-1.48+Math.cos(a)*.72,dy=crankY-y;m.piston.position.y=y;m.rod.position.set(m.piston.position.x,(y+crankY)/2,crankZ/2);m.rod.rotation.x=Math.atan2(-crankZ,dy);m.rod.scale.y=Math.max(.65,Math.hypot(crankZ,dy)/2);});
 valveParts.forEach(v=>{const deg=(state.cycle+v.phase)%720;const lift=physics.valveLift(deg,v.type);v.mesh.position.y=v.baseY-lift*.32;});
 explode();
 if(controls){if(focusAnimating){controls.target.lerp(focusTarget,.12);camera.position.lerp(focusCamera,.08);if(camera.position.distanceTo(focusCamera)<.08&&controls.target.distanceTo(focusTarget)<.08)focusAnimating=false;}controls.update();}
 renderer?.render(scene,camera);plotClock+=dt;if(plotClock>.3){plotClock=0;requestRenderMeta();drawInstrumentation();}
}
function requestRenderMeta(){const phase=document.querySelector('#cyclePhase');if(phase){const a=((state.cycle%720)+720)%720;phase.textContent=a<180?'INTAKE':a<360?'COMPRESSION':a<540?'POWER':'EXHAUST';}const status=document.querySelector('#engineStatus');if(status)status.textContent=state.running?'ENGINE RUNNING · LIVE PHYSICS':'SIMULATION READY · 4-STROKE';const play=document.querySelector('#play');if(play){play.textContent=state.running?'Ⅱ':'▶';play.setAttribute('aria-label',state.running?'Pause engine':'Start engine');}const deg=document.querySelector('#cycleDeg');if(deg)deg.textContent=Math.round(state.cycle)+'°';const bar=document.querySelector('#cycleBar');if(bar)bar.style.width=state.cycle/7.2+'%';const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};set('#teleRPM',Math.round(physics.rpm));set('#teleTorque',Math.round(physics.torque)+' Nm');set('#telePower',physics.power.toFixed(1)+' kW');set('#telePressure',physics.pressure.toFixed(1)+' bar');set('#teleBoost',(physics.boost||0).toFixed(2)+' bar');set('#teleTemp',Math.round(physics.temperature)+'°C');set('#teleOil',Math.round(physics.oil||95)+'°C');set('#teleExhaust',Math.round(physics.exhaustTemp||280)+'°C');set('#teleEff',(physics.efficiency||0).toFixed(1)+'%');set('#teleKnock',(physics.knock||0).toFixed(1)+'%');set('#readIMEP',(physics.imep||0).toFixed(1)+' bar');set('#readBMEP',(physics.bmep||0).toFixed(1)+' bar');set('#readAFR',physics.spec.afr.toFixed(1));set('#readFlow',(physics.intakeFlow||0).toFixed(1)+' g/s')}

function drawChart(id,values,maxValue,label,color='#48e6ff'){const cv=document.querySelector('#'+id);if(!cv||!values?.length)return;const d=Math.min(window.devicePixelRatio||1,2),w=Math.max(cv.clientWidth,300),h=Math.max(cv.clientHeight,145);cv.width=Math.round(w*d);cv.height=Math.round(h*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);x.font='10px DM Sans,Arial';x.fillStyle='rgba(157,169,198,.75)';for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,i*h/4);x.lineTo(w,i*h/4);x.strokeStyle='rgba(157,169,198,.12)';x.lineWidth=1;x.stroke()}const pts=values.map((v,i)=>[i/(values.length-1||1)*w,h-10-(Math.max(0,Math.min(v,maxValue))/Math.max(maxValue,1))*(h-22)]);x.beginPath();pts.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.lineTo(w,h-10);x.lineTo(0,h-10);x.closePath();const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,color+'55');g.addColorStop(1,color+'00');x.fillStyle=g;x.fill();x.beginPath();pts.forEach(([px,py],i)=>i?x.lineTo(px,py):x.moveTo(px,py));x.strokeStyle=color;x.lineWidth=2.5;x.lineJoin='round';x.lineCap='round';x.stroke();x.fillStyle=color;x.fillText(label,8,14)}
function drawInstrumentation(){if(!physics)return;const pressure=[],torque=[],piston=[];for(let a=0;a<=720;a+=30){pressure.push(physics.cylinderPressure(a,physics.throttle)/1e5);const q=physics.cylinderWorkTorque(a);torque.push(Math.max(0,q.torque));piston.push(physics.pistonPosition(a*Math.PI/180)*1000)}drawChart('pressurePlot',pressure,Math.max(20,...pressure),'bar','#48e6ff');drawChart('torquePlot',torque,Math.max(20,...torque),'Nm','#ffad5a');drawChart('pistonPlot',piston,Math.max(90,...piston),'mm','#9b7cff');history.rpm.push(physics.rpm);history.torque.push(physics.torque);history.temp.push(physics.temperature);[history.rpm,history.torque,history.temp].forEach(a=>{if(a.length>80)a.shift()});const cv=document.querySelector('#trendPlot');if(cv){const w=cv.clientWidth||500,h=cv.clientHeight||150,d=Math.min(devicePixelRatio||1,2);cv.width=Math.round(w*d);cv.height=Math.round(h*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);const draw=(arr,max)=>{x.beginPath();arr.forEach((v,i)=>{const px=i/(79)*w,py=h-6-Math.max(0,Math.min(v/max,1))*(h-12);i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle='#30332f';x.lineWidth=2;x.stroke()};draw(history.rpm,physics.spec.redline);draw(history.temp,180)}const set=(id,v)=>{const e=document.querySelector(id.startsWith('#')?id:'#'+id);if(e)e.textContent=v};set('#readIMEP',(physics.imep||0).toFixed(1)+' bar');set('#readBMEP',(physics.bmep||0).toFixed(1)+' bar');set('#readAFR',physics.spec.afr.toFixed(1));set('#readFlow',(physics.intakeFlow||0).toFixed(1)+' g/s')}
function renderLibrary(){
 const systems=['All',...new Set(catalog.map(x=>x[0]))],q=state.search.toLowerCase();
 const list=catalog.filter(x=>(state.system==='All'||x[0]===state.system)&&(`${x[0]} ${x[1]} ${x[2]}`.toLowerCase().includes(q)));
 document.querySelector('#workspace').innerHTML=`
 <div class="atlasGrid"><aside class="library panel"><div class="panelTitle"><div><span class="eyebrow">ENGINE LIBRARY</span><h2>Choose a machine</h2></div><span class="count">04</span></div>
 <div class="engineList">${Object.entries(engines).map(([id,e])=>`<button class="engineCard ${id===state.engine?'selected':''}" data-engine="${id}"><span class="engineIcon">◎</span><div><b>${e.name}</b><small>${e.sub}</small></div><i>↗</i></button>`).join('')}</div>
 <div class="catalogHead"><span class="eyebrow">SYSTEMS</span><button id="clear">CLEAR</button></div><div class="systemList">${systems.map(s=>`<button class="systemBtn ${s===state.system?'active':''}" data-system="${s}"><span class="dot"></span>${s}<small>${s==='All'?catalog.length:catalog.filter(x=>x[0]===s).length}</small></button>`).join('')}</div></aside>
 <section class="viewer panel"><div class="viewerHead"><div><span class="eyebrow">LIVE 3D ASSEMBLY</span><h2>${engines[state.engine].name}</h2><small>Orbit · zoom · click any component</small></div><div class="actions"><button data-view="front">FRONT</button><button data-view="side">SIDE</button><button data-view="top">TOP</button><button id="explodeBtn">${state.explode?'ASSEMBLE':'EXPLODE'}</button><button id="cutBtn">${state.cutaway?'SOLID':'CUTAWAY'}</button><button id="isoBtn">${state.isolate?'SHOW ALL':'ISOLATE'}</button><button id="reset">RESET</button></div></div>
 <div id="viewport" class="viewport"><div class="hud"><b>PIECES // ENGINE LAB</b><span id="engineStatus">SIMULATION READY · 4-STROKE</span></div><div class="simPresets"><span>DRIVE MODE</span><button data-preset="idle">IDLE</button><button data-preset="road">ROAD</button><button data-preset="power">POWER</button></div><div class="telemetry"><div><span>RPM</span><b id="teleRPM">${Math.round(state.rpm)}</b></div><div><span>TORQUE</span><b id="teleTorque">0 Nm</b></div><div><span>POWER</span><b id="telePower">0 kW</b></div><div><span>CYL. PRESSURE</span><b id="telePressure">1 bar</b></div><div><span>BOOST</span><b id="teleBoost">0.00 bar</b></div><div><span>COOLANT</span><b id="teleTemp">90°C</b></div><div><span>OIL</span><b id="teleOil">95°C</b></div><div><span>EXHAUST</span><b id="teleExhaust">280°C</b></div><div><span>EFFICIENCY</span><b id="teleEff">0%</b></div><div><span>KNOCK</span><b id="teleKnock">0%</b></div></div><div class="cycle"><span>4-STROKE CYCLE</span><small id="cyclePhase">INTAKE</small><b id="cycleDeg">${Math.round(state.cycle)}°</b><div class="cycleBar"><i id="cycleBar" style="width:${state.cycle/7.2}%"></i></div><button id="play" aria-label="${state.running?'Pause engine':'Start engine'}">${state.running?'Ⅱ':'▶'}</button></div><div class="physicsControls"><label>THROTTLE <input id="throttle" type="range" min="0" max="100" value="${state.throttle}"><b id="throttleVal">${state.throttle}%</b></label><label>LOAD <input id="load" type="range" min="0" max="100" value="${state.load}"><b id="loadVal">${state.load}%</b></label><label>IGNITION <input id="advance" type="range" min="0" max="35" value="${physics.sparkAdvance||12}"><b id="advanceVal">${physics.sparkAdvance||12}°</b></label></div></div>
 <div id="detail" class="detail"></div></section></div><div class="instrumentation panel"><div class="panelTitle"><div><span class="eyebrow">LIVE INSTRUMENTATION</span><h2>Engine traces</h2></div><span class="subtle">Reduced-order physics · 0–720° cycle</span></div><div class="plotGrid"><article class="plotCard"><div><b>CYLINDER PRESSURE</b><small>bar vs crank angle</small></div><canvas id="pressurePlot"></canvas></article><article class="plotCard"><div><b>TORQUE PULSE</b><small>Nm vs crank angle</small></div><canvas id="torquePlot"></canvas></article><article class="plotCard"><div><b>PISTON MOTION</b><small>position vs crank angle</small></div><canvas id="pistonPlot"></canvas></article><article class="plotCard"><div><b>LIVE TREND</b><small>RPM / temperature</small></div><canvas id="trendPlot"></canvas></article></div><div class="physicsReadout"><span>IMEP <b id="readIMEP">0 bar</b></span><span>BMEP <b id="readBMEP">0 bar</b></span><span>AFR <b id="readAFR">14.7</b></span><span>INTAKE FLOW <b id="readFlow">0 g/s</b></span></div></div>
 <section class="catalog panel"><div class="panelTitle"><div><span class="eyebrow">COMPONENT CATALOGUE</span><h2>${list.length} parts in view</h2></div><span class="subtle">Click a part to inspect it</span></div><div class="partsGrid">${list.map((x,i)=>`<button class="partRow ${x[1]===state.selected?'selected':''}" data-part="${x[1]}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[0]}</em></button>`).join('')}</div></section>`;
 bindLibrary();init3D()
}
function refreshCatalog(){
 const q=state.search.toLowerCase();
 const list=catalog.filter(x=>(state.system==='All'||x[0]===state.system)&&(`${x[0]} ${x[1]} ${x[2]}`.toLowerCase().includes(q)));
 const title=document.querySelector('.catalog .panelTitle h2');if(title)title.textContent=`${list.length} parts in view`;
 const grid=document.querySelector('.catalog .partsGrid');if(grid)grid.innerHTML=list.map((x,i)=>`<button class="partRow ${x[1]===state.selected?'selected':''}" data-part="${x[1]}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[0]}</em></button>`).join('');
 document.querySelectorAll('.partRow').forEach(b=>b.onclick=()=>select(b.dataset.part));
}
function bindLibrary(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(!camera||!controls)return;const target=controls.target.clone();const offsets={front:new THREE.Vector3(0,2.2,15),side:new THREE.Vector3(15,2.2,0),top:new THREE.Vector3(0,16,.01)};focusTarget.copy(target);focusCamera.copy(target).add(offsets[b.dataset.view]);focusAnimating=true;});
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const presets={idle:{throttle:18,load:8},road:{throttle:42,load:32},power:{throttle:92,load:12}};const p=presets[b.dataset.preset];state.throttle=p.throttle;state.load=p.load;physics.throttle=p.throttle/100;physics.load=p.load/100;document.querySelector('#throttle').value=p.throttle;document.querySelector('#load').value=p.load;document.querySelector('#throttleVal').textContent=p.throttle+'%';document.querySelector('#loadVal').textContent=p.load+'%';document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x===b));if(!state.running){state.running=true;}requestRenderMeta();});
 document.querySelectorAll('[data-engine]').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;state.selected='Piston';renderLibrary()});
 document.querySelectorAll('[data-system]').forEach(b=>b.onclick=()=>{state.system=b.dataset.system;document.querySelectorAll('[data-system]').forEach(x=>x.classList.toggle('active',x.dataset.system===state.system));updateVisibility();refreshCatalog()});
 document.querySelectorAll('.partRow').forEach(b=>b.onclick=()=>select(b.dataset.part));
 document.querySelector('#explodeBtn').onclick=()=>{state.explode=!state.explode;document.querySelector('#explodeBtn').textContent=state.explode?'ASSEMBLE':'EXPLODE';document.querySelector('#explodeBtn').classList.toggle('active',state.explode)};
 document.querySelector('#cutBtn').onclick=()=>{state.cutaway=!state.cutaway;document.querySelector('#cutBtn').textContent=state.cutaway?'SOLID':'CUTAWAY';document.querySelector('#cutBtn').classList.toggle('active',state.cutaway);updateVisibility()};
 document.querySelector('#isoBtn').onclick=()=>{state.isolate=!state.isolate;document.querySelector('#isoBtn').textContent=state.isolate?'SHOW ALL':'ISOLATE';document.querySelector('#isoBtn').classList.toggle('active',state.isolate);updateVisibility()};
 document.querySelector('#reset').onclick=()=>{state.explode=false;state.cutaway=false;state.isolate=false;state.cycle=0;state.running=false;state.throttle=18;state.load=25;state.rpm=900;physics.reset();physics.throttle=.18;physics.load=.25;physics.rpm=900;focusTarget.set(0,.7,0);focusCamera.set(10,6.5,13);focusAnimating=false;controls.reset();updateVisibility();select(state.selected,false);requestRenderMeta();document.querySelector('#throttle').value=18;document.querySelector('#load').value=25;document.querySelector('#throttleVal').textContent='18%';document.querySelector('#loadVal').textContent='25%';physics.sparkAdvance=12;document.querySelector('#advance').value=12;document.querySelector('#advanceVal').textContent='12°'};
 document.querySelector('#play').onclick=()=>{state.running=!state.running;requestRenderMeta();};
 document.querySelector('#throttle').oninput=e=>{state.throttle=+e.target.value;physics.throttle=state.throttle/100;document.querySelector('#throttleVal').textContent=state.throttle+'%'};document.querySelector('#load').oninput=e=>{state.load=+e.target.value;physics.load=state.load/100;document.querySelector('#loadVal').textContent=state.load+'%'};document.querySelector('#advance').oninput=e=>{physics.sparkAdvance=+e.target.value;document.querySelector('#advanceVal').textContent=physics.sparkAdvance+'°'};
 document.querySelector('#clear').onclick=()=>{state.system='All';state.search='';document.querySelector('#search').value='';document.querySelectorAll('[data-system]').forEach(x=>x.classList.toggle('active',x.dataset.system==='All'));updateVisibility();refreshCatalog()}
}
function learn(){
 document.querySelector('#workspace').innerHTML=`<div class="learning panel"><span class="eyebrow">HOW IT WORKS</span><h2>One cycle. Two crank revolutions.</h2><p class="lead">A four-stroke engine moves through intake, compression, power and exhaust. In a typical four-stroke layout the camshaft rotates at half crankshaft speed.</p><div class="cycleCards">${[['01','INTAKE','Piston moves down; the intake valve opens and fresh charge enters.'],['02','COMPRESSION','Both valves close; the piston moves up and compresses the charge.'],['03','POWER','Ignition initiates combustion and expanding gases push the piston down.'],['04','EXHAUST','The exhaust valve opens and the rising piston expels spent gases.']].map(x=>`<article><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div><div class="sourceBox"><b>Knowledge note</b><p>Component descriptions are synthesized from automotive engineering references. Actual designs vary by engine, fuel system, valvetrain, emissions package and manufacturer.</p></div></div>`
 document.querySelector('#workspace .learning').insertAdjacentHTML('beforeend','<section id="engineQuiz" class="quizPanel"><div class="quizTop"><div><span class="eyebrow">KNOWLEDGE CHECK</span><h2>Test your engine IQ</h2></div><span id="quizProgress">QUESTION 1 / 3</span></div><p id="quizPrompt" class="quizPrompt"></p><div id="quizOptions" class="quizOptions"></div><div id="quizFeedback" class="quizFeedback" aria-live="polite"></div><div class="quizFooter"><span id="quizScore">Score: 0</span><button id="quizNext" class="quizNext" disabled>Next question →</button></div></section>');setupQuiz(document.querySelector('#engineQuiz'));
}
function compare(){
 document.querySelector('#workspace').innerHTML=`<div class="compare panel"><span class="eyebrow">ARCHITECTURES</span><h2>Road-engine families</h2><div class="compareGrid">${Object.entries(engines).map(([id,e])=>`<button data-engine="${id}"><div class="orb">◌</div><b>${e.name}</b><span>${e.sub}</span><small>${e.cyl} cylinders · bore ${e.bore.toFixed(2)} · stroke ${e.stroke.toFixed(2)}</small></button>`).join('')}</div></div>`;document.querySelectorAll('.compareGrid button').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;tab('library')})
}
function tab(t){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));t==='library'?renderLibrary():t==='learn'?learn():compare()}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));let searchTimer;document.querySelector('#search').oninput=e=>{state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>refreshCatalog(),120);};document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search').focus()}});
renderLibrary();