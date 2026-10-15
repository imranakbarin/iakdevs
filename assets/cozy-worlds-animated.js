/* Cozy Worlds: packaged full-image animated 2D scene. */
window.CozyWorlds=(()=>{
 let current=null;
 function mount(host){
  if(current)current.dispose();
  const frame=document.createElement('iframe');
  frame.src='assets/cozy-reading-nook.html?v=1';
  frame.title='Cozy Worlds — animated illustrated reading nook';
  frame.setAttribute('loading','eager');
  frame.setAttribute('allow','autoplay');
  frame.style.cssText='display:block;width:100%;height:100%;border:0;background:#0c0e14';
  host.replaceChildren(frame);
  current={frame,dispose(){frame.remove();if(current&&current.frame===frame)current=null;}};
 }
 return {mount,dispose(){current?.dispose();},pause(){},resume(){}};
})();