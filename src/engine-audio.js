// Pieces Engineverse: synthesized engine audio. No external sound files required.
const AudioEngine = (() => {
  let ctx = null, master = null, low = null, mid = null, high = null;
  let lowGain = null, midGain = null, highGain = null, exhaustGain = null;
  let noiseFilter = null, lfo = null, lfoGain = null, enabled = false;
  let button = null, lastState = '';

  function buildAudio() {
    if (ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (button) { button.textContent = '🔇 AUDIO UNSUPPORTED'; button.disabled = true; }
      return;
    }
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    low = ctx.createOscillator(); low.type = 'sawtooth';
    const lowFilter = ctx.createBiquadFilter(); lowFilter.type = 'lowpass'; lowFilter.frequency.value = 170;
    lowGain = ctx.createGain(); lowGain.gain.value = 0.48;
    low.connect(lowFilter); lowFilter.connect(lowGain); lowGain.connect(master); low.start();

    mid = ctx.createOscillator(); mid.type = 'triangle';
    const midFilter = ctx.createBiquadFilter(); midFilter.type = 'lowpass'; midFilter.frequency.value = 620;
    midGain = ctx.createGain(); midGain.gain.value = 0.25;
    mid.connect(midFilter); midFilter.connect(midGain); midGain.connect(master); mid.start();

    high = ctx.createOscillator(); high.type = 'square';
    const highFilter = ctx.createBiquadFilter(); highFilter.type = 'lowpass'; highFilter.frequency.value = 1250;
    highGain = ctx.createGain(); highGain.gain.value = 0.035;
    high.connect(highFilter); highFilter.connect(highGain); highGain.connect(master); high.start();

    // Filtered looping noise supplies a soft exhaust/air texture under the tonal engine note.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
    noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 380;
    exhaustGain = ctx.createGain(); exhaustGain.gain.value = 0.012;
    noise.connect(noiseFilter); noiseFilter.connect(exhaustGain); exhaustGain.connect(master); noise.start();

    // The firing-rate LFO adds a subtle repeating combustion pulse.
    lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 30;
    lfoGain = ctx.createGain(); lfoGain.gain.value = 0.10;
    const pulse = ctx.createGain(); pulse.gain.value = 0.9;
    lfo.connect(lfoGain); lfoGain.connect(pulse.gain);
    // Keep the pulsing audible but not harsh by using it on the low layer only.
    low.disconnect(); low.connect(lowFilter); lowFilter.disconnect(); lowFilter.connect(pulse); pulse.connect(lowGain);
    lfo.start();
  }

  function getRpm() {
    const value = Number(document.querySelector('#teleRPM')?.textContent || 900);
    return Number.isFinite(value) ? Math.max(0, value) : 900;
  }
  function isRunning() {
    const status = document.querySelector('#engineStatus')?.textContent || '';
    return status.includes('ENGINE RUNNING');
  }
  function sync() {
    if (!ctx || !enabled) return;
    const rpm = getRpm();
    const throttle = Number(document.querySelector('#throttle')?.value || 18) / 100;
    const running = isRunning();
    const t = ctx.currentTime;
    const rpmFactor = Math.max(0.35, rpm / 900);
    const firing = Math.max(8, rpm / 60 * 2); // typical inline-four firing events per second
    low.frequency.setTargetAtTime(Math.max(28, firing * 0.72), t, 0.035);
    mid.frequency.setTargetAtTime(Math.max(55, firing * 1.55), t, 0.035);
    high.frequency.setTargetAtTime(Math.max(90, firing * 2.8), t, 0.035);
    lfo.frequency.setTargetAtTime(firing, t, 0.025);
    noiseFilter.frequency.setTargetAtTime(260 + throttle * 1150 + rpmFactor * 120, t, 0.08);
    const volume = running ? Math.min(0.42, 0.11 + rpmFactor * 0.065 + throttle * 0.14) : 0;
    master.gain.setTargetAtTime(volume, t, running ? 0.07 : 0.16);
    exhaustGain.gain.setTargetAtTime(running ? 0.008 + throttle * 0.035 : 0, t, 0.08);
    highGain.gain.setTargetAtTime(0.018 + throttle * 0.075 + Math.min(rpmFactor, 5) * 0.006, t, 0.06);
    midGain.gain.setTargetAtTime(0.12 + throttle * 0.17, t, 0.06);
    if (button) {
      button.classList.toggle('soundActive', enabled);
      button.textContent = enabled ? '🔊 SOUND ON' : '🔇 SOUND OFF';
      button.setAttribute('aria-pressed', String(enabled));
      button.title = enabled ? 'Turn engine audio off' : 'Enable synthesized engine audio';
    }
  }
  function frame() {
    sync();
    requestAnimationFrame(frame);
  }
  function mountButton(viewport) {
    if (!viewport || viewport.querySelector('.engineSoundToggle')) return;
    button = document.createElement('button');
    button.className = 'engineSoundToggle';
    button.type = 'button';
    button.textContent = '🔇 SOUND OFF';
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Enable synthesized engine audio';
    button.addEventListener('click', async () => {
      enabled = !enabled;
      if (enabled) {
        buildAudio();
        if (ctx?.state === 'suspended') await ctx.resume();
      }
      sync();
    });
    viewport.appendChild(button);
  }
  function boot() {
    const style = document.createElement('style');
    style.textContent = `
      .engineSoundToggle{position:absolute;z-index:8;right:16px;top:58px;border:1px solid rgba(72,230,255,.35);border-radius:10px;padding:9px 12px;background:rgba(7,13,28,.86);color:#c6d4ef;font:800 9px/1.2 'DM Sans',system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(12px);box-shadow:0 8px 22px rgba(0,0,0,.22);transition:transform .18s,border-color .18s,background .18s}
      .engineSoundToggle:hover{transform:translateY(-1px);border-color:#48e6ff}
      .engineSoundToggle.soundActive{background:linear-gradient(110deg,rgba(72,230,255,.19),rgba(155,124,255,.2));border-color:rgba(72,230,255,.62);color:#fff}
      .engineSoundToggle:focus-visible{outline:2px solid #48e6ff;outline-offset:3px}
      @media(max-width:700px){.engineSoundToggle{top:52px;right:10px;padding:8px 9px;font-size:8px}}
    `;
    document.head.appendChild(style);
    const observer = new MutationObserver(() => mountButton(document.querySelector('#viewport')));
    observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
    mountButton(document.querySelector('#viewport'));
    document.addEventListener('click', async (event) => {
      if (event.target.closest('#play, [data-preset]') && enabled && ctx?.state === 'suspended') await ctx.resume();
    });
    requestAnimationFrame(frame);
  }
  return { boot };
})();
AudioEngine.boot();
