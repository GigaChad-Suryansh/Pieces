// Simplified single-zone four-stroke thermodynamic + crank dynamics model.
// Educational model: pressure is estimated from trapped charge, polytropic
// compression/expansion and a smooth combustion heat-release pulse.
// It is not a CFD model or a manufacturer calibration.

const R_AIR=287.05;
const GAMMA=1.35;
const DEG=Math.PI/180;

export const ENGINE_PHYSICS={
 i4:{bore:0.086,stroke:0.086,compression:10.5,ve:.91,eff:.31,inertia:.22,friction:18,maxFuelRate:.00115},
 v6:{bore:0.086,stroke:0.086,compression:10.5,ve:.90,eff:.31,inertia:.30,friction:24,maxFuelRate:.00155},
 diesel:{bore:0.084,stroke:0.100,compression:17.5,ve:.94,eff:.39,inertia:.28,friction:23,maxFuelRate:.00135},
 bike:{bore:0.076,stroke:0.055,compression:11.5,ve:.96,eff:.30,inertia:.11,friction:8,maxFuelRate:.00072}
};

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function smoothstep(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)}

export class EnginePhysics{
 constructor(type='i4'){
  this.type=type; this.spec=ENGINE_PHYSICS[type]||ENGINE_PHYSICS.i4;
  this.cylinders=type==='v6'?6:4;
  this.rpm=900; this.theta=0; this.throttle=.18; this.load=.25;
  this.temperature=92; this.manifoldPressure=35e3; this.torque=0; this.power=0;
  this.fuelRate=0; this.pressure=1e5; this.airMass=0; this.imep=0;
 }
 reset(){this.rpm=900;this.theta=0;this.temperature=92;this.torque=0;this.power=0;this.fuelRate=0;this.manifoldPressure=35e3}
 displacementPerCylinder(){
  const s=this.spec,b=this.spec.bore,stroke=this.spec.stroke;
  return Math.PI*b*b/4*stroke;
 }
 pistonPosition(theta){
  const r=this.spec.stroke/2,L=this.spec.stroke*1.9;
  const c=Math.cos(theta), under=Math.max(0,L*L-r*r*(1-c*c));
  return r*(1-c)+L-Math.sqrt(under);
 }
 volume(theta){
  const area=Math.PI*this.spec.bore*this.spec.bore/4;
  const vSwept=area*this.spec.stroke;
  const vClear=vSwept/(this.spec.compression-1);
  return vClear+area*this.pistonPosition(theta);
 }
 volumeDerivative(theta){
  const h=1e-5;
  return (this.volume(theta+h)-this.volume(theta-h))/(2*h);
 }
 cylinderPressure(localDeg,throttle){
  // 0° = firing TDC; 180° intake BDC; 360° compression TDC;
  // 540° exhaust BDC; 720° next firing TDC.
  const a=((localDeg%720)+720)%720;
  const V=this.volume(a*DEG);
  const Vc=this.displacementPerCylinder()/(this.spec.compression-1);
  const pInt=15e3+Math.pow(clamp(throttle,0,1),.62)*88e3;
  const T=330;
  const m=pInt*(this.displacementPerCylinder()*this.spec.ve)/(R_AIR*T);
  const vBdc=this.volume(Math.PI);
  let p=pInt;
  if(a<180){ // intake
    p=pInt;
  }else if(a<360){ // compression
    p=pInt*Math.pow(vBdc/V,GAMMA);
  }else if(a<500){ // expansion after a smooth combustion pulse around TDC
    const pComp=pInt*Math.pow(vBdc/Vc,GAMMA);
    const burn=smoothstep(360,370,a)*(1-smoothstep(480,520,a));
    const peakBoost=(this.type==='diesel'?18:11)*Math.pow(clamp(throttle,0,1),.55);
    p=pComp*Math.pow(1+peakBoost*burn,GAMMA);
    p=Math.max(p,pComp*Math.pow(Vc/V,GAMMA));
  }else{ // exhaust
    p=105e3;
  }
  this.airMass=m;
  return Math.max(80e3,Math.min(p,1.4e7));
 }
 cylinderWorkTorque(phaseDeg){
  let torque=0, peak=0;
  const steps=72;
  const d=720/steps*DEG;
  for(let i=0;i<steps;i++){
   const a=phaseDeg+i*720/steps;
   const local=((a%720)+720)%720;
   const p=this.cylinderPressure(local,this.throttle);
   const dV=this.volumeDerivative(local*DEG);
   // Work torque: dW/dtheta = -p*dV/dtheta.
   // Convert from N*m per rad using the actual crank geometry.
   const t=-p*dV;
   torque+=t;
   peak=Math.max(peak,p);
  }
  return {torque:torque/steps*2,peak};
 }
 step(dt){
  dt=Math.min(.03,Math.max(.0001,dt));
  const phases=[];
  for(let i=0;i<this.cylinders;i++)phases.push(i*720/this.cylinders);
  let indicated=0,peak=0;
  for(const phase of phases){const r=this.cylinderWorkTorque(phase);indicated+=r.torque;peak=Math.max(peak,r.peak)}
  const throttle=this.throttle;
  const pumping=(1-throttle)*7;
  const friction=this.spec.friction+0.0000045*this.rpm*this.rpm;
  const loadTorque=5+this.load*95;
  const brakeTorque=indicated*.72-pumping-friction-loadTorque;
  const omega=Math.max(20,this.rpm*2*Math.PI/60);
  const alpha=brakeTorque/this.spec.inertia;
  this.rpm=clamp(this.rpm+alpha*dt*60/(2*Math.PI),550,8000);
  this.theta=(this.theta+omega*dt/DEG)%720;
  // Fuel rate follows air mass and a gasoline/diesel-like target AFR.
  const afr=this.type==='diesel'?20:14.7;
  const totalAirPerSec=this.airMass*this.cylinders*this.rpm/120;
  this.fuelRate=clamp(totalAirPerSec/afr*throttle,0,.0025);
  this.torque=Math.max(0,indicated*.72-pumping-friction);
  this.power=this.torque*this.rpm*2*Math.PI/60/1000;
  this.pressure=peak;
  this.manifoldPressure=15e3+Math.pow(throttle,.62)*88e3;
  this.imep=Math.max(0,indicated/(this.displacementPerCylinder()*this.cylinders));
  this.temperature=90+clamp(this.pressure/1e6,0,12)*5+this.rpm*.004;
  return this.snapshot();
 }
 snapshot(){
  return {rpm:this.rpm,theta:this.theta,torque:this.torque,power:this.power,
   pressure:this.pressure/1e5,manifold:this.manifoldPressure/1000,
   fuel:this.fuelRate*3600,temperature:this.temperature,imep:this.imep/1e5};
 }
}
