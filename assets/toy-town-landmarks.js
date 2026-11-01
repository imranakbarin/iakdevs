/* Toy Town — five hand-authored miniature landmark assets.
 * These are actual independent 3D model assemblies, not overlays on the
 * old box buildings. The rest of the generated town retains its light renderer.
 * Each asset is built from a compact, cached mesh kit with custom wall profiles,
 * curved roofs, shaped masonry, glazing and architectural elements.
 * No external art service, binary model loader, or runtime download required.
 */
const kits=new WeakMap();
export function buildLandmark(THREE, RoundedBoxGeometry, b) {
  if(!b?.hero || !['shop','house'].includes(b.kind))return null;
  let kit=kits.get(THREE);
  if(!kit){kit=makeKit(THREE,RoundedBoxGeometry);kits.set(THREE,kit);}
  if(b.kind==='shop'){
    return b.name==='BAKERY'?kit.bakery(b):kit.bookshop(b);
  }
  return b.x<=7?kit.roseCottage(b):b.y<=8?kit.blueCottage(b):kit.honeyCottage(b);
}

function makeKit(T,Round){
  const cache=new Map(), pigments=new Map(), TAU=Math.PI*2;
  const material=(color,rough=.85,extra='')=>{
    const key=color+':'+rough+':'+extra;
    if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({
      color,roughness:rough,metalness:.025,
      ...(extra==='lit'?{emissive:'#f8d5a2',emissiveIntensity:.33}:{})
    }));
    return cache.get(key);
  };
  const geom=(type,...args)=>{
    const key=type+':'+args.join(':');
    if(!cache.has(key)){
      const v=type==='round'?new Round(...args,3,Math.min(...args)*.12):
        type==='box'?new T.BoxGeometry(...args):
        type==='ball'?new T.SphereGeometry(args[0],14,10):
        type==='cyl'?new T.CylinderGeometry(...args,12):
        type==='cone'?new T.ConeGeometry(...args,16):
        type==='torus'?new T.TorusGeometry(...args,6,16):
        new T.PlaneGeometry(...args);
      cache.set(key,v);
    }
    return cache.get(key);
  };
  const mesh=(p,geometry,mat,x=0,y=0,z=0,shadow=true)=>{
    const m=new T.Mesh(geometry,typeof mat==='string'?material(mat):mat);
    m.position.set(x,y,z);
    m.castShadow=shadow;
    m.receiveShadow=true;
    p.add(m);
    return m;
  };
  const block=(p,w,h,d,c,x=0,y=0,z=0,round=true,cast=true)=>
    mesh(p,geom(round?'round':'box',w,h,d),c,x,y,z,cast);
  const sphere=(p,r,c,x=0,y=0,z=0,cast=false)=>
    mesh(p,geom('ball',r),c,x,y,z,cast);
  const cyl=(p,top,bottom,h,c,x,y,z,cast=true)=>
    mesh(p,geom('cyl',top,bottom,h),c,x,y,z,cast);
  const rng=n=>{let x=Math.imul(n^0x9e3779b9,0x85ebca6b);x=Math.imul(x^x>>>13,0xc2b2ae35);return(x>>>0)/4294967296;};
  function texture(base,type){
    const key='paint:'+base+':'+type;
    if(pigments.has(key))return pigments.get(key);
    const c=document.createElement('canvas');c.width=256;c.height=256;
    const ctx=c.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
    if(type==='stucco'){
      for(let i=0;i<1100;i++){
        const x=rng(i*13+2)*256,y=rng(i*31+3)*256;
        ctx.fillStyle=i%5?'rgba(99,72,55,.055)':'rgba(255,255,241,.26)';
        ctx.fillRect(x,y,.4+rng(i+19)*1.5,.4+rng(i+22)*1.1);
      }
    } else {
      for(let row=0;row<18;row++)for(let col=-1;col<18;col++){
        const x=col*16+(row%2)*8,y=row*15;
        ctx.fillStyle=(row+col)%7===0?'rgba(255,229,201,.13)':'rgba(86,48,41,.04)';
        ctx.beginPath();ctx.roundRect(x+1,y+1,15.5,14.4,[2,2,5,5]);ctx.fill();
        ctx.strokeStyle='rgba(70,51,45,.16)';ctx.lineWidth=.8;ctx.stroke();
        ctx.fillStyle='rgba(255,248,222,.09)';ctx.fillRect(x+3,y+2,9,1);
      }
    }
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    const m=new T.MeshStandardMaterial({map:tex,color:'#ffffff',roughness:.93,metalness:0});
    pigments.set(key,m);return m;
  }
  function roundedFootprint(w=.80,d=.79,corner=.09){
    const k='foot:'+w+':'+d+':'+corner;
    if(cache.has(k))return cache.get(k);
    const s=new T.Shape(),x=w/2,z=d/2,r=corner;
    s.moveTo(-x+r,-z);s.lineTo(x-r,-z);
    s.quadraticCurveTo(x,-z,x,-z+r);s.lineTo(x,z-r);
    s.quadraticCurveTo(x,z,x-r,z);s.lineTo(-x+r,z);
    s.quadraticCurveTo(-x,z,-x,z-r);s.lineTo(-x,-z+r);
    s.quadraticCurveTo(-x,-z,-x+r,-z);
    s.closePath();cache.set(k,s);return s;
  }
  function walls(g,w,h,d,pigment,corner=.075){
    const key='walls:'+w+':'+h+':'+d+':'+corner;
    let geometry=cache.get(key);
    if(!geometry){
      geometry=new T.ExtrudeGeometry(roundedFootprint(w,d,corner),{
        depth:h,steps:1,bevelEnabled:true,bevelSize:.012,bevelThickness:.015,
        bevelSegments:3,curveSegments:6
      });
      geometry.rotateX(-Math.PI/2);
      cache.set(key,geometry);
    }
    mesh(g,geometry,texture(pigment,'stucco'),0,.13,0);
    block(g,w+.07,.095,d+.07,'#d8c3a6',0,.12,0);
    block(g,w+.025,.09,d+.025,'#c8b095',0,.205,0);
    return h+.13;
  }
  function volumeRoof(g,width,depth,top,pigment,{arch=.10,hip=false,crest=.34}={}){
    const key='roof:'+width+':'+depth+':'+arch+':'+hip+':'+crest;
    let geometries=cache.get(key);
    if(!geometries){
      geometries=[];
      for(const side of [-1,1]){
        const shape=new T.Shape(),N=20,half=width*.60;
        shape.moveTo(0,crest);
        for(let k=1;k<=N;k++){
          const t=k/N;
          const y=crest*(1-Math.pow(t,.92))+arch*Math.sin(Math.PI*t);
          shape.lineTo(side*half*t,y);
        }
        for(let k=N;k>=0;k--){
          const t=k/N;
          const y=crest*(1-Math.pow(t,.92))+arch*Math.sin(Math.PI*t)-.09;
          shape.lineTo(side*half*t,y);
        }
        shape.closePath();
        const shape3=new T.ExtrudeGeometry(shape,{depth:depth*1.17,
          steps:1,bevelEnabled:true,bevelSize:.012,bevelThickness:.010,
          bevelSegments:2,curveSegments:16});
        shape3.translate(0,0,-depth*.585);
        geometries.push(shape3);
      }
      const fill=new T.Shape();
      const N=20;
      fill.moveTo(-width*.50,-.03);fill.lineTo(width*.50,-.03);
      for(let i=N;i>=0;i--){
        const t=i/N;
        fill.lineTo(width*.50*t,crest*(1-Math.pow(t,.92))+arch*Math.sin(Math.PI*t)-.04);
      }
      for(let i=1;i<=N;i++){
        const t=i/N;
        fill.lineTo(-width*.50*t,crest*(1-Math.pow(t,.92))+arch*Math.sin(Math.PI*t)-.04);
      }
      fill.closePath();
      const gable=new T.ExtrudeGeometry(fill,{depth:depth*.85,
        bevelEnabled:true,bevelSize:.010,bevelThickness:.011,bevelSegments:2});
      gable.translate(0,0,-depth*.425);
      geometries.push(gable);cache.set(key,geometries);
    }
    const roofMat=texture(pigment,'tile');
    for(let i=0;i<2;i++)mesh(g,geometries[i],roofMat,0,top,0);
    mesh(g,geometries[2],material('#e4c8aa'),0,top-.012,0);
    block(g,.07,.075,depth*1.20,'#eedac4',0,top+crest+.006,0);
    for(const side of [-1,1])
      block(g,.055,.047,depth*1.24,'#ead5b8',
        side*width*.598,top+.02,0);
  }
  function sill(g,x,y,z,w=.23){
    block(g,w+.10,.036,.115,'#f3e0c3',x,y-.16,z+.034);
    block(g,w+.047,.02,.09,'#b79e7f',x,y-.199,z+.046);
  }
  function glazing(g,x,y,z,w=.24,h=.32,{curve=0,side=false}={}){
    const f=new T.Group();f.position.set(x,y,z);if(side)f.rotation.y=Math.PI/2;g.add(f);
    block(f,w+.07,h+.095,.06,'#e9d6bb');
    block(f,w,h,.045,material('#a8d2c9',.25),0,0,.038,false,false);
    block(f,w*.86,h*.92,.009,material('#b9d9cc',.2),0,0,.064,false,false);
    block(f,.016,h+.015,.076,'#fff3de',0,0,.068,false,false);
    block(f,w+.015,.016,.076,'#fff3de',0,0,.071,false,false);
    block(f,.027,h*.57,.010,'#e1f0e4',-w*.22,0,.083,false,false);
    sill(f,0,-h*.36,.035,w);
  }
  function flowerBox(g,x,z,y=.54,w=.28) {
    block(g,w,.105,.145,'#bd8367',x,y,z);
    for(let i=0;i<5;i++){
      const fx=x-w*.4+i*w*.2;
      sphere(g,.056,i%2?'#6b9b78':'#93b68b',fx,y+.089,z-.02);
      if(i%2===0)sphere(g,.022,i%4?'#efb9b4':'#f6e6c9',fx,y+.14,z+.03);
    }
  }
  function arch(g,x,z,y,w,h,wood='#896950'){
    // A real pierced, extruded limestone arch with inset curved timber door.
    const key='arch:'+w+':'+h;
    let geometry=cache.get(key);
    if(!geometry){
      const S=new T.Shape(),P=new T.Path();
      const trace=(shape,ww,hh)=>{
        shape.moveTo(-ww/2,-hh/2);shape.lineTo(ww/2,-hh/2);
        shape.lineTo(ww/2,hh*.10);
        for(let n=0;n<=18;n++){
          const a=Math.PI*n/18;
          shape.lineTo(Math.cos(a)*ww/2,hh*.10+Math.sin(a)*ww*.43);
        }
        shape.closePath();
      };
      trace(S,w,h);trace(P,w*.78,h*.83);S.holes.push(P);
      geometry=new T.ExtrudeGeometry(S,{depth:.06,bevelEnabled:true,
        bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1});
      cache.set(key,geometry);
    }
    mesh(g,geometry,material('#f8e9d0'),x,y,z);
    block(g,w*.74,h*.79,.034,wood,x,y-h*.08,z+.03);
    block(g,.014,h*.66,.038,'#b98c6c',x,y-h*.10,z+.053);
    sphere(g,.018,'#edcf8c',x+w*.24,y-h*.18,z+.062);
    block(g,w*1.18,.042,.18,'#d6bd9d',x,y-h*.5,z+.093);
  }
  function pot(g,x,z,sz=.86,col='#729c78'){
    const key='pot-lathe';
    let geometry=cache.get(key);
    if(!geometry) {
      geometry=new T.LatheGeometry([
        [0,0],[.062,0],[.069,.018],[.092,.12],[.099,.136],
        [.080,.157],[.065,.160]
      ].map(([r,y])=>new T.Vector2(r,y)),12);
      cache.set(key,geometry);
    }
    const p=mesh(g,geometry,material('#c5886a'),x,.14,z);
    p.scale.setScalar(sz);
    for(let i=0;i<4;i++){
      sphere(g,.066*sz,i%2?col:'#8db88b',x+(i-1.5)*.042,.32*sz,z);
      if(i%2===0)sphere(g,.026*sz,'#eab0ad',
        x+(i-1.5)*.044,.39*sz,z+.04);
    }
  }
  function sign(g,txt,x,y,z,width,background='#f9e9cd',ink='#7d6757'){
    const c=document.createElement('canvas');c.width=384;c.height=128;
    const p=c.getContext('2d');p.fillStyle=background;
    p.beginPath();p.roundRect(5,8,374,111,18);p.fill();
    p.strokeStyle='rgba(136,100,74,.45)';p.lineWidth=7;p.stroke();
    p.fillStyle=ink;p.textAlign='center';p.textBaseline='middle';
    p.font=txt.length>12?'bold 33px Georgia,serif':'bold 50px Georgia,serif';
    p.fillText(txt,192,65,352);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
    const m=new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide});
    mesh(g,geom('plane',width,width/3),m,x,y,z,false);
  }
  function awning(g,x,y,z,w,color,depth=.33) {
    // A scalloped canopy follows a curved valance, not a row of floating bars.
    const fabric=block(g,w,.045,depth,color,x,y,z,false);
    fabric.rotation.x=-.10;
    const highlight=block(g,w,.015,.023,'#ffead6',x,y-.036,z+depth*.49);
    for(let n=0;n<9;n++){
      const xx=x-w/2+(n+.5)*w/9;
      const p=sphere(g,w/18,n%2?'#f6e9cf':color,xx,y-.06,z+depth*.52);
      p.scale.set(1,.58,.55);
    }
  }
  function ground(g,tint='#dbc7ae',w=.9,d=.85) {
    block(g,w,.085,d,tint,0,.08,0);
    block(g,w+.035,.029,d+.045,'#f5e2c6',0,.132,0);
  }
  function planter(g,x,z,c='#75a07d'){
    block(g,.28,.09,.16,'#d2b18c',x,.16,z);
    for(let j=0;j<5;j++){
      const p=sphere(g,.059,c,x+(j-2)*.052,.247,z);
      p.scale.set(.95,.88,.8);
      if(j%2===0)sphere(g,.022,'#e8b3b5',x+(j-2)*.052,.306,z);
    }
  }
  function chimney(g,x,y,z,color='#bf8670'){
    block(g,.14,.37,.14,color,x,y,z);
    block(g,.19,.06,.19,'#f0ddc6',x,y+.20,z);
    block(g,.125,.03,.125,'#7f7366',x,y+.237,z);
  }
  function roofDormer(g,x,y,z,color){
    block(g,.22,.20,.20,'#f3ddc1',x,y,z);
    const cap=block(g,.29,.047,.26,color,x,y+.13,z);
    cap.rotation.z=-.10;
    glazing(g,x,y,z+.116,.10,.12);
  }
  function base(b){
    const g=new T.Group();
    g.position.set(b.x+.5,0,b.y+.5);
    g.userData={landmark:true,kind:b.name||b.kind,uniqueAsset:true};
    return g;
  }
  function bakery(b) {
    const g=base(b),roof='#b96552';
    ground(g,'#d5bea3');
    const top=walls(g,.85,1.29,.76,'#f1d8bc',.12);
    // Signature barn-like scalloped terracotta roof and chimney.
    volumeRoof(g,.82,.83,top,roof,{arch:.09,crest:.44});
    chimney(g,-.25,top+.17,-.18);
    // Front counter: deep vertical windows flanking an arched caramel door.
    glazing(g,-.255,.63,.419,.22,.54);
    glazing(g,.252,.63,.419,.23,.54);
    arch(g,.025,.454,.42,.22,.59,'#956344');
    // Elegant projecting bakery window and cream striped valance.
    const display=block(g,.45,.46,.20,'#ead5b5',-.248,.58,.507);
    display.castShadow=false;
    glazing(g,-.248,.62,.627,.37,.33);
    awning(g,-.234,1.015,.57,.53,'#c87967');
    block(g,.84,.063,.20,'#e4c5a6',0,1.118,.455);
    sign(g,'BAKERY',0,1.17,.545,.60,'#f8ebd4','#8d5647');
    // Bread trays sit inside the display, visually behind the glass.
    for(let i=-1;i<=1;i++){
      const bun=sphere(g,.045,'#bd8c57',-.25+i*.105,.47,.645);
      bun.scale.set(1.25,.62,.9);
    }
    block(g,.38,.034,.15,'#a77f5f',-.245,.37,.56);
    pot(g,-.395,.53,.88);pot(g,.378,.54,.91);
    for(let i=0;i<4;i++)block(g,.041,.18,.039,'#efdbbc',-.35+i*.23,.84,.443);
    return g;
  }
  function bookshop(b) {
    const g=base(b);
    ground(g,'#c4c1a7');
    const top=walls(g,.81,1.24,.80,'#c4dcd1',.10);
    // Old-world slate mansard: lower lip and raised upper attic.
    volumeRoof(g,.81,.84,top,'#467a73',{arch:.06,crest:.42});
    block(g,.33,.35,.33,'#d8e6d9',.16,top+.20,-.10);
    roofDormer(g,.16,top+.28,.28,'#427971');
    chimney(g,-.23,top+.15,-.22,'#b5a895');
    // Curved book-bay to the right, handmade wooden entry to the left.
    arch(g,-.22,.45,.42,.23,.61,'#6c745c');
    glazing(g,.21,.61,.43,.30,.50);
    block(g,.40,.45,.20,'#d1e1cd',.20,.57,.52);
    glazing(g,.20,.62,.640,.28,.34);
    awning(g,.205,1.015,.58,.48,'#537e78');
    // Shelf of pastel spines within the bay.
    for(let i=0;i<6;i++){
      block(g,.038,.14,.045,['#d8a582','#b88e98','#819ca6','#d5ba7e','#7c9b8d','#b695a0'][i],
        -.012+i*.084,.44,.653);
    }
    block(g,.87,.068,.18,'#f2dfc4',0,1.09,.47);
    sign(g,'THE BOOK NOOK',0,1.16,.553,.65,'#e2efe0','#496f67');
    planter(g,.35,.54,'#6e9880');pot(g,-.40,.56,.80,'#729c89');
    // Thin, suspended store sign with a wrought-iron bracket.
    block(g,.18,.016,.02,'#687a71',-.38,1.01,.49);
    const oval=sphere(g,.105,'#f8ebd3',-.415,.88,.50);
    oval.scale.set(.71,.98,.26);
    return g;
  }
  function roseCottage(b){
    const g=base(b);
    ground(g,'#e0c5aa');
    const top=walls(g,.79,1.10,.79,'#e5c1a8',.14);
    // Asymmetric little cottage with a genuine attached second volume.
    volumeRoof(g,.83,.85,top,'#a85f50',{arch:.11,crest:.39});
    const wing=new T.Group();wing.position.set(-.27,0,-.22);wing.scale.set(.56,.79,.60);g.add(wing);
    walls(wing,.68,.94,.68,'#efcfb5',.10);
    volumeRoof(wing,.72,.75,1.07,'#b47a61',{arch:.09,crest:.34});
    arch(g,.19,.446,.38,.26,.55,'#91674b');
    glazing(g,-.23,.70,.415,.23,.31);
    glazing(g,.425,.66,-.10,.22,.34,{side:true});
    roofDormer(g,-.10,top+.23,.34,'#ad6d59');
    chimney(g,-.25,top+.16,-.24,'#b88d75');
    flowerBox(g,-.23,.489,.51);
    block(g,.33,.046,.31,'#dec5a5',.20,.17,.54);
    pot(g,-.35,.53,.88,'#729a7a');pot(g,.37,.50,.95,'#7d9e77');
    return g;
  }
  function blueCottage(b) {
    const g=base(b);
    ground(g,'#c7c8bb');
    const top=walls(g,.78,1.34,.77,'#c7dce3',.13);
    volumeRoof(g,.86,.84,top,'#658ba7',{arch:.075,crest:.38});
    // Tall seaside tower integrated into back corner, with its own pointed roof.
    cyl(g,.18,.225,1.40,'#b9d4da',.295,.84,.27);
    cyl(g,.22,.22,.045,'#f1dfc8',.295,1.55,.27);
    mesh(g,geom('cone',.27,.41),texture('#6484a4','tile'),.295,1.77,.27);
    glazing(g,.292,.96,.504,.13,.26);
    arch(g,.18,.446,.43,.23,.57,'#628a96');
    glazing(g,-.24,.73,.413,.21,.36);
    glazing(g,.422,.71,-.12,.20,.30,{side:true});
    // Delicate second-floor verandah balcony, structural rather than floating.
    block(g,.47,.059,.26,'#ead9bf',-.17,1.03,.52);
    for(let k=0;k<6;k++)block(g,.018,.22,.028,'#fff0da',-.375+k*.08,1.16,.64);
    block(g,.51,.028,.035,'#dfc4a6',-.17,1.28,.64);
    pot(g,-.38,.52,.89,'#7a9f8f');
    return g;
  }
  function honeyCottage(b) {
    const g=base(b);
    ground(g,'#dfcbac');
    const top=walls(g,.80,1.18,.81,'#e7d3b3',.12);
    // Warm buttercup cottage with a curved gingerbread roof & turret.
    volumeRoof(g,.84,.88,top,'#b58352',{arch:.14,crest:.43});
    cyl(g,.20,.24,1.26,'#edd9b9',.31,.76,.23);
    cyl(g,.25,.24,.045,'#f4e3c7',.31,1.41,.23);
    mesh(g,geom('cone',.28,.43),texture('#be9160','tile'),.31,1.65,.23);
    glazing(g,.315,.97,.445,.125,.22);
    arch(g,-.18,.447,.42,.24,.60,'#9b7752');
    glazing(g,.14,.64,.421,.22,.31);
    roofDormer(g,-.13,top+.21,.35,'#ae8056');
    // Curved timber porch and trellis meet the path.
    block(g,.56,.056,.30,'#d9b995',-.10,.205,.55);
    for(const x of [-.38,.18]){
      cyl(g,.027,.036,.53,'#e9d4b9',x,.49,.70);
    }
    block(g,.59,.043,.37,'#b38d67',-.10,.77,.56);
    for(let i=0;i<4;i++)sphere(g,.082,i%2?'#7ba282':'#94b38a',
      -.34+i*.16,.27,.70);
    flowerBox(g,.14,.47,.47);
    pot(g,-.40,.50,.83,'#7b9d81');
    return g;
  }
  return {bakery,bookshop,roseCottage,blueCottage,honeyCottage};
}
