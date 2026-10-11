/* A tiny GPU ray/sphere renderer; no engine, models, downloads or full-screen WebGL canvas. */
const ZenSteelGPU=(()=>{
 let canvas,gl,program,texture,turn,attempted=false,key='';
 function init(){
  if(attempted)return Boolean(gl);attempted=true;
  try{
   canvas=document.createElement('canvas');canvas.width=canvas.height=64;
   gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,depth:false,stencil:false,antialias:false});
   if(!gl)return false;
   const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
   const vs=shader(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=(p+1.0)*0.5;gl_Position=vec4(p,0.0,1.0);}');
   const fs=shader(gl.FRAGMENT_SHADER,`precision highp float;
    varying vec2 uv;uniform vec4 turn;uniform sampler2D reflection;
    void main(){
     vec2 xy=vec2(uv.x,1.0-uv.y)*2.031746-1.015873;
     float r=dot(xy,xy);if(r>1.0){gl_FragColor=vec4(0.0);return;}
     vec3 n=vec3(xy,sqrt(1.0-r));
     vec3 world=vec3(n.x,n.y*0.572-n.z*0.82,-n.y*0.82+n.z*0.572);
     vec3 q=-turn.xyz;vec3 t=2.0*cross(q,world);vec3 m=world+turn.w*t+cross(q,t);
     float brushed=sin(m.y*40.0+m.x*6.0)*0.011;
     float arc=pow(max(0.0,1.0-abs((m.y-0.26)*43.0)),2.0)*0.12;
     float witness=pow(max(0.0,1.0-dot(m-vec3(0.48,-0.33,0.81),m-vec3(0.48,-0.33,0.81))*95.0),3.0)*0.24;
     vec3 col=texture2D(reflection,vec2(uv.x,1.0-uv.y)).rgb;
     float light=max(0.0,dot(n,vec3(-0.38,-0.55,0.744)));
     float spec=(pow(light,110.0)*105.0+pow(light,20.0)*13.0)/255.0;
     float alpha=clamp((1.0-sqrt(r))*31.5,0.0,1.0);
     gl_FragColor=vec4(min(vec3(1.0),col*(1.0+brushed-arc-witness)+spec),alpha);
    }`);
   program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
   gl.useProgram(program);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
   turn=gl.getUniformLocation(program,'turn');texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,'reflection'),0);gl.viewport(0,0,64,64);
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gl=null;key='';if(typeof wakeScene==='function')wakeScene();});
   canvas.addEventListener('webglcontextrestored',()=>{attempted=false;key='';if(typeof wakeScene==='function')wakeScene();});
   return true;
  }catch(e){gl=null;return false;}
 }
 function render(q,colors,normals,garden){
  if(!init())return null;
  if(key!==garden){const pixels=new Uint8Array(64*64*4);for(let i=0;i<normals.length;i++){const n=normals[i];if(!n)continue;for(let k=0;k<3;k++)pixels[i*4+k]=colors[i][k]*(.84+n.fresnel*.16);pixels[i*4+3]=255;}gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,64,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);key=garden;}
  gl.uniform4fv(turn,q);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return canvas;
 }
 return {render};
})();
