/* Original, locally synthesized accompaniment. No recordings or network requests.
   A pentatonic melody, sympathetic string-like drone, and quiet pitched percussion.
   Audio is created only after a user gesture and suspended in background tabs. */
(() => {
  'use strict';
  const button=document.getElementById('sound'),label=document.getElementById('sound-label');
  const volume=document.getElementById('volume'),output=document.getElementById('volume-value');
  let audio,master,dry,delay,feedback,filter,compressor,timer=null,enabled=false,busy=false;
  let next=0,step=0,noise=null,level=.35;
  const active=new Set(),buffers=new Map();
  const melody=[0,2,4,7,9,7,4,2,0,null,4,7,9,12,9,7,4,null,2,4,7,4,2,0,2,4,null,7,9,7,4,2];
  const beat=.62,root=146.832;
  const pref={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
  const stored=pref.get('scrolls-volume');if(stored!==null&&Number.isFinite(Number(stored)))level=Math.max(0,Math.min(1,Number(stored)));
  volume.value=Math.round(level*100);output.value=volume.value+'%';
  function track(source,nodes=[]){active.add(source);source.onended=()=>{active.delete(source);source.disconnect();for(const node of nodes)node.disconnect();};return source;}
  function init(){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw new Error('Audio synthesis is not supported in this browser.');
    audio=new Audio({latencyHint:'playback'});
    compressor=audio.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=4;compressor.connect(audio.destination);
    master=audio.createGain();master.gain.value=0;master.connect(compressor);
    dry=audio.createGain();dry.gain.value=.65;dry.connect(master);
    // Short, filtered echoes give the small ensemble a natural room instead of a dry beep.
    delay=audio.createDelay(2);delay.delayTime.value=.31;
    feedback=audio.createGain();feedback.gain.value=.23;
    filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2300;
    const wet=audio.createGain();wet.gain.value=.21;
    dry.connect(delay);delay.connect(filter);filter.connect(feedback);feedback.connect(delay);filter.connect(wet);wet.connect(master);
    noise=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);
    const n=noise.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=(Math.random()*2-1)*.12;
  }
  function pluckBuffer(frequency){
    if(buffers.has(frequency))return buffers.get(frequency);
    const rate=audio.sampleRate,duration=4,buffer=audio.createBuffer(1,rate*duration,rate),data=buffer.getChannelData(0);
    // Karplus–Strong string: a decaying noise excitation circulating through a lowpass loop.
    const period=Math.round(rate/frequency),ring=new Float32Array(period);for(let i=0;i<period;i++)ring[i]=(Math.random()*2-1)*.45;
    let dc=0;for(let i=0;i<data.length;i++){const p=i%period,n=(p+1)%period,value=ring[p];ring[p]=.498*(value+ring[n]);dc+=.002*(value-dc);data[i]=(value-dc)*Math.min(1,i/200)*Math.exp(-i/(rate*3));}
    buffers.set(frequency,buffer);return buffer;
  }
  function drone(time,freq){
    const src=audio.createBufferSource(),gain=audio.createGain();src.buffer=pluckBuffer(freq);gain.gain.value=.37;src.connect(gain);gain.connect(dry);track(src,[gain]);src.start(time);src.stop(time+4);
  }
  function flute(time,semitone,duration){
    const freq=root*2**(semitone/12),gain=audio.createGain(),tone=audio.createOscillator();
    const harmonic=audio.createOscillator(),hg=audio.createGain(),breath=audio.createBufferSource(),bp=audio.createBiquadFilter(),bg=audio.createGain();
    tone.type='sine';tone.frequency.setValueAtTime(freq*.992,time);tone.frequency.exponentialRampToValueAtTime(freq,time+.12);
    harmonic.type='sine';harmonic.frequency.value=freq*2;hg.gain.value=.1;
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.14,time+.12);gain.gain.setTargetAtTime(.105,time+.18,.15);gain.gain.setTargetAtTime(0,time+duration-.22,.07);
    const vibrato=audio.createOscillator(),vGain=audio.createGain();vibrato.frequency.value=4.7;vGain.gain.setValueAtTime(0,time);vGain.gain.linearRampToValueAtTime(freq*.004,time+.4);vibrato.connect(vGain);vGain.connect(tone.frequency);
    tone.connect(gain);harmonic.connect(hg);hg.connect(gain);gain.connect(dry);
    breath.buffer=noise;breath.loop=true;bp.type='bandpass';bp.frequency.value=2300;bp.Q.value=.7;bg.gain.value=.11;breath.connect(bp);bp.connect(bg);bg.connect(gain);
    const end=time+duration+.25;track(tone,[gain]);track(harmonic,[hg]);track(vibrato,[vGain]);track(breath,[bp,bg]);
    for(const src of [tone,harmonic,vibrato,breath]){src.start(time);src.stop(end);}
  }
  function percussion(time,low){
    const tone=audio.createOscillator(),gain=audio.createGain();tone.frequency.setValueAtTime(low?145:440,time);tone.frequency.exponentialRampToValueAtTime(low?75:220,time+.16);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(low?.085:.035,time+.005);gain.gain.exponentialRampToValueAtTime(.0001,time+.32);
    tone.connect(gain);gain.connect(dry);track(tone,[gain]);tone.start(time);tone.stop(time+.38);
  }
  function schedule(){
    if(!enabled||document.hidden||audio.state!=='running')return;
    if(next<audio.currentTime-.2)next=audio.currentTime+.06;
    while(next<audio.currentTime+.2){
      const index=step%64;
      if(index%4===0)drone(next,[root/2,root*.75,root,root/2][(index/4)%4]);
      if(index%2===0){const note=melody[(index/2)%melody.length];if(note!==null)flute(next,note,beat*(index%8===0?1.6:1.25));}
      if(index%4===0||index%4===3)percussion(next,index%4===0);
      next+=beat;step++;
    }
  }
  function sync(){button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Mute soundscape':'Enable soundscape');label.textContent=enabled?'Sound on':'Sound off';document.getElementById('sound-icon').setAttribute('href',enabled?'#i-sound':'#i-muted');}
  function stopSources(){for(const src of active){try{src.stop();}catch{}}}
  button.addEventListener('click',async()=>{
    if(busy)return;busy=true;button.disabled=true;
    try{
      if(!audio)init();
      if(!enabled){await audio.resume();if(audio.state!=='running')throw new Error('Tap Sound again to enable audio.');enabled=true;next=audio.currentTime+.06;master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(level,audio.currentTime,.25);schedule();timer=setInterval(schedule,100);}
      else{enabled=false;clearInterval(timer);timer=null;master.gain.cancelScheduledValues(audio.currentTime);master.gain.setTargetAtTime(0,audio.currentTime,.04);await new Promise(resolve=>setTimeout(resolve,180));stopSources();await audio.suspend();}
      sync();
    }catch(error){enabled=false;clearInterval(timer);timer=null;stopSources();if(audio)await audio.suspend().catch(()=>{});sync();const status=document.getElementById('status');status.hidden=false;status.textContent=error.message||'Sound could not start. Try tapping Sound again.';}
    finally{button.disabled=false;busy=false;}
  });
  volume.addEventListener('input',()=>{level=Number(volume.value)/100;output.value=volume.value+'%';pref.set('scrolls-volume',String(level));if(audio&&enabled)master.gain.setTargetAtTime(level,audio.currentTime,.05);});
  document.addEventListener('visibilitychange',async()=>{
    if(!audio||!enabled)return;
    if(document.hidden){clearInterval(timer);timer=null;await audio.suspend();}
    else{try{await audio.resume();if(audio.state!=='running')throw new Error();next=Math.max(next,audio.currentTime+.05);schedule();clearInterval(timer);timer=setInterval(schedule,100);}catch{enabled=false;sync();}}
  });
  window.addEventListener('pagehide',()=>{clearInterval(timer);if(audio)audio.suspend();});
  sync();
})();
