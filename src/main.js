import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import {EnginePhysics} from './physics.js';
import {RoundedBoxGeometry} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/RoundedBoxGeometry.js';

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
let plotClock=0;const history={rpm:[],torque:[],temp:[]};
let physics=new EnginePhysics(state.engine);
let scene,camera,renderer,controls,raycaster,mouse,root,parts=[],moving=[],last=performance.now(),focusTarget=new THREE.Vector3(0,.7,0),focusCamera=new THREE.Vector3(10,6.5,13);

document.querySelector('#app').innerHTML=`
<header class="topbar"><div class="brand">ENGINE <span>ATLAS</span></div><div class="search"><span>⌕</span><input id="search" placeholder="Search parts, systems, engines…"></div><nav><button class="nav active" data-tab="library">Library</button><button class="nav" data-tab="learn">Learn</button><button class="nav" data-tab="compare">Compare</button></nav><kbd>K</kbd><div class="avatar">S</div></header>
<main class="appShell"><section class="intro"><div><span class="eyebrow">MICRO-MECHANICS / 3D EXPLORER</span><h1>See how an engine<br><em>actually moves.</em></h1><p>Explore everyday road engines, reveal their hidden mechanisms and follow combustion down to individual components.</p></div><div class="stats"><b>50+</b><span>catalogued parts</span><b>4</b><span>road-engine families</span><b>720°</b><span>four-stroke cycle</span></div></section><section id="workspace"></section></main>`;

const M={steel:new THREE.MeshPhysicalMaterial({color:0x777b78,roughness:.25,metalness:.9,clearcoat:.18}),alloy:new THREE.MeshPhysicalMaterial({color:0xc4c7c3,roughness:.34,metalness:.78,clearcoat:.22}),dark:new THREE.MeshPhysicalMaterial({color:0x252827,roughness:.23,metalness:.88,clearcoat:.12}),black:new THREE.MeshPhysicalMaterial({color:0x121413,roughness:.58,metalness:.2}),red:new THREE.MeshPhysicalMaterial({color:0xb94139,roughness:.28,metalness:.48,clearcoat:.25}),blue:new THREE.MeshPhysicalMaterial({color:0x3d6ea4,roughness:.3,metalness:.45,clearcoat:.2}),gold:new THREE.MeshPhysicalMaterial({color:0xd0a044,roughness:.22,metalness:.86,clearcoat:.2}),rubber:new THREE.MeshStandardMaterial({color:0x202220,roughness:.8}),white:new THREE.MeshPhysicalMaterial({color:0xe7e8e4,roughness:.4,metalness:.25,clearcoat:.18}),copper:new THREE.MeshPhysicalMaterial({color:0xa85f35,roughness:.24,metalness:.82})};
const geo={box:(x,y,z,r=.12)=>new RoundedBoxGeometry(x,y,z,4,r),cyl:(r,h,s=32)=>new THREE.CylinderGeometry(r,r,h,s),tor:(R,r)=>new THREE.TorusGeometry(R,r,16,48)};
function add(g,m,name,system,parent=root){const o=new THREE.Mesh(g,m);o.userData={part:name,system};o.castShadow=o.receiveShadow=true;parent.add(o);parts.push(o);return o}
function init3D(){
 physics=new EnginePhysics(state.engine);physics.throttle=state.throttle/100;physics.load=state.load/100;physics.rpm=state.rpm;physics.theta=state.cycle;
 const el=document.querySelector('#viewport');scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f0ec);
 camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(10,6.5,13);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;el.appendChild(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.minDistance=5;controls.maxDistance=23;controls.target.set(0,.7,0);
 raycaster=new THREE.Raycaster();mouse=new THREE.Vector2();
 scene.add(new THREE.HemisphereLight(0xffffff,0x666862,2.35));const l=new THREE.DirectionalLight(0xffffff,4.2);l.position.set(7,12,9);l.castShadow=true;l.shadow.mapSize.set(2048,2048);l.shadow.camera.near=.1;l.shadow.camera.far=50;scene.add(l);const f=new THREE.DirectionalLight(0xc7d5e4,1.7);f.position.set(-8,5,-8);scene.add(f);const rim=new THREE.DirectionalLight(0xffd7b0,1.1);rim.position.set(4,3,-10);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(14,80),new THREE.MeshStandardMaterial({color:0xdedfd9,roughness:.88,metalness:.05}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.25;floor.receiveShadow=true;scene.add(floor);const grid=new THREE.GridHelper(24,24,0xc7c8c2,0xd4d5d0);grid.position.y=-2.23;grid.material.opacity=.32;grid.material.transparent=true;scene.add(grid);const halo=new THREE.Mesh(new THREE.RingGeometry(6.5,6.55,96),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=-2.2;scene.add(halo);
 build();resize();renderer.domElement.addEventListener('pointermove',pointer);renderer.domElement.addEventListener('click',pick);requestAnimationFrame(loop)
}
function build(){
 root=new THREE.Group();scene.add(root);parts=[];moving=[];const E=engines[state.engine],n=E.cyl,s=3,xs=Array.from({length:n},(_,i)=>(i-(n-1)/2)*s);
 const block=add(geo.box(n*2.55,3.8,4.8,.2),M.alloy,'Engine block','Structure');const pan=add(geo.box(n*2.7,1.05,4.95,.18),M.black,'Oil pan / sump','Structure');pan.position.y=-2.35;
 const head=add(geo.box(n*2.48,1.5,4.65,.18),M.alloy,'Cylinder head','Structure');head.position.y=2.55;
 const cover=add(geo.box(n*2.42,.55,4.5,.14),M.dark,'Valve cover','Structure');cover.position.y=3.62;
 const gasket=add(geo.box(n*2.36,.12,4.4,.04),M.rubber,'Head gasket','Structure');gasket.position.y=1.78;
 xs.forEach((x,i)=>{
  const liner=add(geo.cyl(E.bore,3.55,32),M.steel,'Cylinder liner','Structure');liner.position.x=x;liner.scale.z=.86;
  const piston=add(geo.cyl(E.bore*.9,.72,32),M.alloy,'Piston','Motion');piston.position.set(x,.4,0);
  for(let r=0;r<3;r++){const ring=add(geo.tor(E.bore*.9,.055),r===2?M.gold:M.dark,'Piston rings','Motion',piston);ring.rotation.x=Math.PI/2;ring.position.y=.22-r*.13}
  const pin=add(geo.cyl(.16,.9,20),M.steel,'Wrist pin','Motion',piston);pin.rotation.z=Math.PI/2;
  const rod=add(geo.box(.34,2,.34,.06),M.steel,'Connecting rod','Motion');rod.position.set(x,-.55,0);rod.userData.baseScale=rod.scale.clone();
  const bearing=add(geo.cyl(.52,.38,24),M.dark,'Rod bearing','Motion');bearing.rotation.z=Math.PI/2;bearing.position.set(x,-1.48,0);
  const iv=add(geo.cyl(.13,.72,18),M.blue,'Intake valve','Valvetrain');iv.position.set(x-.48,2.03,.2);
  const ev=add(geo.cyl(.13,.72,18),M.red,'Exhaust valve','Valvetrain');ev.position.set(x+.48,2.03,.2);
  const plug=add(geo.cyl(.09,.5,16),M.gold,'Spark plug','Ignition');plug.position.set(x,2.83,.2);
  moving.push({piston,rod,phase:i*2*Math.PI/n});
 });
 const crank=add(geo.cyl(.31,n*3.15,32),M.dark,'Crankshaft','Motion');crank.rotation.z=Math.PI/2;crank.position.y=-1.48;
 xs.forEach(x=>{const w=add(geo.cyl(.68,.32,28),M.steel,'Crankshaft','Motion');w.rotation.z=Math.PI/2;w.position.set(x,-1.48,0)});
 const main=add(geo.cyl(.47,n*3.05,28),M.gold,'Main bearing','Motion');main.rotation.z=Math.PI/2;main.position.y=-1.48;main.scale.z=.7;
 const fly=add(geo.cyl(1.62,.38,48),M.dark,'Flywheel / flexplate','Motion');fly.rotation.z=Math.PI/2;fly.position.set(n*1.7,-1.48,0);
 const cam=add(geo.cyl(.24,n*3,24),M.dark,'Camshaft','Valvetrain');cam.rotation.z=Math.PI/2;cam.position.set(0,3,.75);
 xs.forEach(x=>[0,1].forEach(j=>{const l=add(geo.cyl(.42,.2,20),M.steel,'Cam lobe','Valvetrain');l.rotation.z=Math.PI/2;l.position.set(x+(j-.5)*.52,3,.75)}));
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
 if(focus){const o=parts.find(x=>x.userData.part===name);if(o){focusTarget.copy(o.getWorldPosition(new THREE.Vector3()));const offset=new THREE.Vector3(4.8,2.8,6.5);focusCamera.copy(focusTarget).add(offset);}}
}
function pointer(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*2-1;mouse.y=-(e.clientY-r.top)/r.height*2+1}
function pick(){raycaster.setFromCamera(mouse,camera);const h=raycaster.intersectObjects(parts,true)[0];if(h){let o=h.object;while(o&&!o.userData.part)o=o.parent;if(o?.userData.part){select(o.userData.part);document.querySelectorAll('.partRow').forEach(x=>x.classList.toggle('selected',x.dataset.part===state.selected))}}}
function resize(){if(!renderer)return;const el=document.querySelector('#viewport');if(!el)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight,false)}
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
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,(now-last)/1000);last=now;if(state.running){physics.throttle=state.throttle/100;physics.load=state.load/100;const snap=physics.step(dt);state.rpm=snap.rpm;state.cycle=snap.theta}else{physics.theta=state.cycle;physics.rpm=state.rpm}moving.forEach(m=>{const a=state.cycle*Math.PI/180+m.phase,y=.1+Math.cos(a)*.82;m.piston.position.y=y;m.rod.position.y=(y-1.48)/2;const crankX=Math.sin(a)*.7;m.rod.rotation.z=Math.atan2(crankX,1.7);m.rod.scale.y=Math.max(.4,Math.abs(y+1.48)/2)});explode();if(controls){controls.target.lerp(focusTarget,.06);camera.position.lerp(focusCamera,.035);controls.update()}renderer?.render(scene,camera);plotClock+=dt;if(plotClock>.08){plotClock=0;requestRenderMeta();drawInstrumentation()}}
function requestRenderMeta(){const deg=document.querySelector('#cycleDeg');if(deg)deg.textContent=Math.round(state.cycle)+'°';const bar=document.querySelector('#cycleBar');if(bar)bar.style.width=state.cycle/7.2+'%';const set=(id,v)=>{const e=document.querySelector(id);if(e)e.textContent=v};set('#teleRPM',Math.round(physics.rpm));set('#teleTorque',Math.round(physics.torque)+' Nm');set('#telePower',physics.power.toFixed(1)+' kW');set('#telePressure',physics.pressure.toFixed(1)+' bar');set('#teleBoost',(physics.boost||0).toFixed(2)+' bar');set('#teleTemp',Math.round(physics.temperature)+'°C');set('#teleOil',Math.round(physics.oil||95)+'°C');set('#teleExhaust',Math.round(physics.exhaustTemp||280)+'°C');set('#teleEff',(physics.efficiency||0).toFixed(1)+'%');set('#teleKnock',(physics.knock||0).toFixed(1)+'%')}

function drawChart(id,values,maxValue,label){const cv=document.querySelector('#'+id);if(!cv)return;const d=devicePixelRatio||1,w=cv.clientWidth||500,h=cv.clientHeight||150;cv.width=w*d;cv.height=h*d;const x=cv.getContext('2d');x.scale(d,d);x.clearRect(0,0,w,h);x.font='10px Arial';x.fillStyle='rgba(80,80,72,.55)';for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,i*h/4);x.lineTo(w,i*h/4);x.strokeStyle='rgba(80,80,72,.10)';x.stroke()}x.beginPath();values.forEach((v,i)=>{const px=i/(values.length-1||1)*w,py=h-(Math.max(0,Math.min(v,maxValue))/maxValue)*(h-12)-6;i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle='#30332f';x.lineWidth=2;x.stroke();x.fillStyle='rgba(48,51,47,.65)';x.fillText(label,8,14)}
function drawInstrumentation(){if(!physics)return;const pressure=[],torque=[],piston=[];for(let a=0;a<=720;a+=12){pressure.push(physics.cylinderPressure(a,physics.throttle)/1e5);const q=physics.cylinderWorkTorque(a);torque.push(Math.max(0,q.torque));piston.push(physics.pistonPosition(a*Math.PI/180)*1000)}drawChart('pressurePlot',pressure,Math.max(20,...pressure),'bar');drawChart('torquePlot',torque,Math.max(20,...torque),'Nm');drawChart('pistonPlot',piston,Math.max(90,...piston),'mm');history.rpm.push(physics.rpm);history.torque.push(physics.torque);history.temp.push(physics.temperature);[history.rpm,history.torque,history.temp].forEach(a=>{if(a.length>80)a.shift()});const cv=document.querySelector('#trendPlot');if(cv){const w=cv.clientWidth||500,h=cv.clientHeight||150,d=devicePixelRatio||1;cv.width=w*d;cv.height=h*d;const x=cv.getContext('2d');x.scale(d,d);x.clearRect(0,0,w,h);const draw=(arr,max)=>{x.beginPath();arr.forEach((v,i)=>{const px=i/(79)*w,py=h-6-Math.max(0,Math.min(v/max,1))*(h-12);i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle='#30332f';x.lineWidth=2;x.stroke()};draw(history.rpm,physics.spec.redline);draw(history.temp,180)}const set=(id,v)=>{const e=document.querySelector('#'+id);if(e)e.textContent=v};set('#readIMEP',(physics.imep||0).toFixed(1)+' bar');set('#readBMEP',(physics.bmep||0).toFixed(1)+' bar');set('#readAFR',physics.spec.afr.toFixed(1));set('#readFlow',(physics.intakeFlow||0).toFixed(1)+' g/s')}
function renderLibrary(){
 const systems=['All',...new Set(catalog.map(x=>x[0]))],q=state.search.toLowerCase();
 const list=catalog.filter(x=>(state.system==='All'||x[0]===state.system)&&(`${x[0]} ${x[1]} ${x[2]}`.toLowerCase().includes(q)));
 document.querySelector('#workspace').innerHTML=`
 <div class="atlasGrid"><aside class="library panel"><div class="panelTitle"><div><span class="eyebrow">ENGINE LIBRARY</span><h2>Choose a machine</h2></div><span class="count">04</span></div>
 <div class="engineList">${Object.entries(engines).map(([id,e])=>`<button class="engineCard ${id===state.engine?'selected':''}" data-engine="${id}"><span class="engineIcon">◎</span><div><b>${e.name}</b><small>${e.sub}</small></div><i>↗</i></button>`).join('')}</div>
 <div class="catalogHead"><span class="eyebrow">SYSTEMS</span><button id="clear">CLEAR</button></div><div class="systemList">${systems.map(s=>`<button class="systemBtn ${s===state.system?'active':''}" data-system="${s}"><span class="dot"></span>${s}<small>${s==='All'?catalog.length:catalog.filter(x=>x[0]===s).length}</small></button>`).join('')}</div></aside>
 <section class="viewer panel"><div class="viewerHead"><div><span class="eyebrow">LIVE 3D ASSEMBLY</span><h2>${engines[state.engine].name}</h2><small>Orbit · zoom · click any component</small></div><div class="actions"><button id="explodeBtn">${state.explode?'ASSEMBLE':'EXPLODE'}</button><button id="cutBtn">${state.cutaway?'SOLID':'CUTAWAY'}</button><button id="isoBtn">${state.isolate?'SHOW ALL':'ISOLATE'}</button><button id="reset">RESET</button></div></div>
 <div id="viewport" class="viewport"><div class="hud"><b>PHYSICS ENGINE</b><span>THERMODYNAMIC · CRANK DYNAMICS</span></div><div class="telemetry"><div><span>RPM</span><b id="teleRPM">${Math.round(state.rpm)}</b></div><div><span>TORQUE</span><b id="teleTorque">0 Nm</b></div><div><span>POWER</span><b id="telePower">0 kW</b></div><div><span>CYL. PRESSURE</span><b id="telePressure">1 bar</b></div><div><span>BOOST</span><b id="teleBoost">0.00 bar</b></div><div><span>COOLANT</span><b id="teleTemp">90°C</b></div><div><span>OIL</span><b id="teleOil">95°C</b></div><div><span>EXHAUST</span><b id="teleExhaust">280°C</b></div><div><span>EFFICIENCY</span><b id="teleEff">0%</b></div><div><span>KNOCK</span><b id="teleKnock">0%</b></div></div><div class="cycle"><span>CRANK ANGLE</span><b id="cycleDeg">${Math.round(state.cycle)}°</b><div class="cycleBar"><i id="cycleBar" style="width:${state.cycle/7.2}%"></i></div><button id="play">${state.running?'Ⅱ':'▶'}</button></div><div class="physicsControls"><label>THROTTLE <input id="throttle" type="range" min="0" max="100" value="${state.throttle}"><b id="throttleVal">${state.throttle}%</b></label><label>LOAD <input id="load" type="range" min="0" max="100" value="${state.load}"><b id="loadVal">${state.load}%</b></label><label>IGNITION <input id="advance" type="range" min="0" max="35" value="${physics.sparkAdvance||12}"><b id="advanceVal">${physics.sparkAdvance||12}°</b></label></div></div>
 <div id="detail" class="detail"></div></section></div><div class="instrumentation panel"><div class="panelTitle"><div><span class="eyebrow">LIVE INSTRUMENTATION</span><h2>Engine traces</h2></div><span class="subtle">Reduced-order physics · 0–720° cycle</span></div><div class="plotGrid"><article class="plotCard"><div><b>CYLINDER PRESSURE</b><small>bar vs crank angle</small></div><canvas id="pressurePlot"></canvas></article><article class="plotCard"><div><b>TORQUE PULSE</b><small>Nm vs crank angle</small></div><canvas id="torquePlot"></canvas></article><article class="plotCard"><div><b>PISTON MOTION</b><small>position vs crank angle</small></div><canvas id="pistonPlot"></canvas></article><article class="plotCard"><div><b>LIVE TREND</b><small>RPM / temperature</small></div><canvas id="trendPlot"></canvas></article></div><div class="physicsReadout"><span>IMEP <b id="readIMEP">0 bar</b></span><span>BMEP <b id="readBMEP">0 bar</b></span><span>AFR <b id="readAFR">14.7</b></span><span>INTAKE FLOW <b id="readFlow">0 g/s</b></span></div></div>
 <section class="catalog panel"><div class="panelTitle"><div><span class="eyebrow">COMPONENT CATALOGUE</span><h2>${list.length} parts in view</h2></div><span class="subtle">Click a part to inspect it</span></div><div class="partsGrid">${list.map((x,i)=>`<button class="partRow ${x[1]===state.selected?'selected':''}" data-part="${x[1]}"><span class="num">${String(i+1).padStart(2,'0')}</span><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[0]}</em></button>`).join('')}</div></section>`;
 bindLibrary();init3D()
}
function bindLibrary(){
 document.querySelectorAll('[data-engine]').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;state.selected='Piston';renderLibrary()});
 document.querySelectorAll('[data-system]').forEach(b=>b.onclick=()=>{state.system=b.dataset.system;renderLibrary()});
 document.querySelectorAll('.partRow').forEach(b=>b.onclick=()=>select(b.dataset.part));
 document.querySelector('#explodeBtn').onclick=()=>state.explode=!state.explode;
 document.querySelector('#cutBtn').onclick=()=>{state.cutaway=!state.cutaway;updateVisibility()};
 document.querySelector('#isoBtn').onclick=()=>{state.isolate=!state.isolate;updateVisibility()};
 document.querySelector('#reset').onclick=()=>{state.explode=false;state.cutaway=false;state.isolate=false;state.cycle=0;state.running=false;state.throttle=18;state.load=25;state.rpm=900;physics.reset();physics.throttle=.18;physics.load=.25;physics.rpm=900;focusTarget.set(0,.7,0);focusCamera.set(10,6.5,13);controls.reset();updateVisibility();select(state.selected,false);requestRenderMeta();document.querySelector('#throttle').value=18;document.querySelector('#load').value=25;document.querySelector('#throttleVal').textContent='18%';document.querySelector('#loadVal').textContent='25%'};
 document.querySelector('#play').onclick=()=>state.running=!state.running;
 document.querySelector('#throttle').oninput=e=>{state.throttle=+e.target.value;physics.throttle=state.throttle/100;document.querySelector('#throttleVal').textContent=state.throttle+'%'};document.querySelector('#load').oninput=e=>{state.load=+e.target.value;physics.load=state.load/100;document.querySelector('#loadVal').textContent=state.load+'%'};document.querySelector('#advance').oninput=e=>{physics.sparkAdvance=+e.target.value;document.querySelector('#advanceVal').textContent=physics.sparkAdvance+'°'};
 document.querySelector('#clear').onclick=()=>{state.system='All';state.search='';document.querySelector('#search').value='';renderLibrary()}
}
function learn(){
 document.querySelector('#workspace').innerHTML=`<div class="learning panel"><span class="eyebrow">HOW IT WORKS</span><h2>One cycle. Two crank revolutions.</h2><p class="lead">A four-stroke engine moves through intake, compression, power and exhaust. In a typical four-stroke layout the camshaft rotates at half crankshaft speed.</p><div class="cycleCards">${[['01','INTAKE','Piston moves down; the intake valve opens and fresh charge enters.'],['02','COMPRESSION','Both valves close; the piston moves up and compresses the charge.'],['03','POWER','Ignition initiates combustion and expanding gases push the piston down.'],['04','EXHAUST','The exhaust valve opens and the rising piston expels spent gases.']].map(x=>`<article><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div><div class="sourceBox"><b>Knowledge note</b><p>Component descriptions are synthesized from automotive engineering references. Actual designs vary by engine, fuel system, valvetrain, emissions package and manufacturer.</p></div></div>`
}
function compare(){
 document.querySelector('#workspace').innerHTML=`<div class="compare panel"><span class="eyebrow">ARCHITECTURES</span><h2>Road-engine families</h2><div class="compareGrid">${Object.entries(engines).map(([id,e])=>`<button data-engine="${id}"><div class="orb">◌</div><b>${e.name}</b><span>${e.sub}</span><small>${e.cyl} cylinders · bore ${e.bore.toFixed(2)} · stroke ${e.stroke.toFixed(2)}</small></button>`).join('')}</div></div>`;document.querySelectorAll('.compareGrid button').forEach(b=>b.onclick=()=>{state.engine=b.dataset.engine;tab('library')})
}
function tab(t){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));t==='library'?renderLibrary():t==='learn'?learn():compare()}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));let searchTimer;document.querySelector('#search').oninput=e=>{state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>renderLibrary(),180)};document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search').focus()}});
renderLibrary();