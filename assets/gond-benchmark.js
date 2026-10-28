/* Gond benchmark: composition-first, grounded living landscape.
   Intentionally local to Gond. Other art traditions keep their own grammars. */
const GondBenchmark = (() => {
  const scenes = [
    {bank:['#954b35','#e1a653'],water:'#306f78',hill:'#819064',grove:'#436b58'},
    {bank:['#a3533c','#e3b45e'],water:'#347684',hill:'#8c9b69',grove:'#4f795e'},
    {bank:['#934836','#dba050'],water:'#366e83',hill:'#838c69',grove:'#466f62'}
  ];

  // Opaque pigment pre-blended with the paper: far tiles overlap by a pixel, and
  // translucent fills doubled there into visible vertical seams.
  function wash(hex,a){
    const p=v=>parseInt(v.slice(1),16),f=p(hex),b=p(T.bg||'#f6efe0');
    const ch=k=>Math.round(((b>>k)&255)*(1-a)+((f>>k)&255)*a);
    return 'rgb('+ch(16)+','+ch(8)+','+ch(0)+')';
  }

  // A low patterned rise lives behind the trunks. Its base runs down to the river
  // so the bank always overlaps it; a flat base left a strip of bare paper below.
  function distantRise(c, x, y, w, h, fill, q, alpha) {
    c.save();
    c.beginPath();
    c.moveTo(x-w/2, RIVER);
    c.lineTo(x-w/2, y);
    for(let j=0; j<=32; j++) {
      const u=j/32, xx=x-w/2+u*w;
      c.lineTo(xx, y-Math.pow(Math.sin(Math.PI*u), .84)*h
        +Math.sin(u*12+q()*0.02)*1.8);
    }
    c.lineTo(x+w/2,RIVER);
    c.closePath();
    c.fillStyle=wash(fill,alpha);
    c.fill();
    c.clip();
    c.globalAlpha=alpha;
    c.strokeStyle=T.mark;
    c.lineWidth=.85;
    // Horizontal rhythm follows the rise, instead of making random stickers.
    for(let j=0;j<5;j++){
      c.beginPath();
      const yy=y-10-j*13;
      for(let xx=x-w/2+15;xx<x+w/2-10;xx+=12){
        c.moveTo(xx,yy);
        c.lineTo(xx+4,yy-2);
      }
      c.stroke();
    }
    c.restore();
  }

  function contact(c,x,scale) {
    const y=gy(x)+2;
    c.save();
    c.translate(x,y);
    c.scale(scale,.18*scale);
    const shade=c.createRadialGradient(0,0,4,0,0,72);
    shade.addColorStop(0,'rgba(37,31,19,.28)');
    shade.addColorStop(1,'rgba(37,31,19,0)');
    c.fillStyle=shade;
    c.fillRect(-72,-72,144,144);
    c.restore();
  }

  // Plants are rooted at gy(x), never at the absolute screen bottom (which is water).
  function bankSprig(c,x,q,scale=1) {
    const y=gy(x)+2, h=(33+q()*19)*scale;
    c.save();
    c.translate(x,y);
    c.strokeStyle='#345c4a';
    c.lineWidth=2*scale;
    c.beginPath();
    c.moveTo(0,0);
    c.quadraticCurveTo(-5*scale,-h*.58,3*scale,-h);
    c.stroke();
    for(let j=0;j<4;j++){
      const yy=-h*(.22+j*.19), dir=j%2?1:-1;
      leaf(c,dir*3*scale,yy,
        -PI/2+dir*.9,(12+j*1.7)*scale,4.4*scale,0,
        j%2?'#548879':'#78945b','#e4b85c');
    }
    c.restore();
  }

  // Layout comes from its own seeded stream so a chunk can read its neighbours'
  // plan. Supports sit near chunk edges; a right-edge support yields when the next
  // chunk wants a left-edge one, so canopies never collide across the seam.
  function plan(index){
    const q=mulberry32(hash(seed^0x60d1,index));
    const hero=index===0||((index%3+3)%3===0);
    const x0=index*CW,primary=x0+(hero?316:170+q()*260),coin=q()<.5;
    // Supports take the side with more room, so two canopies never interleave.
    const side=hero?(coin?-1:1):(primary-x0<300?1:-1);
    return {hero,primary,side,leftX:x0+(hero?72:82),rightX:x0+(hero?552:520)};
  }
  function layout(index){
    const me=plan(index),next=plan(index+1);
    let support=me.side<0?me.leftX:(next.side<0?null:me.rightX);
    if(support!==null&&Math.abs(support-me.primary)<215)support=null;
    return {hero:me.hero,primary:me.primary,support};
  }

  // One animal per chapter. Its territory stays inside the chapter by its own
  // half body width, so neighbouring animals never overlap across a seam.
  const SPECIES={
    tiger:{draw:(c,x,q,A)=>tiger(c,x,q,A),half:110,speed:16,stride:40,period:18},
    deer:{draw:(c,x,q,A)=>deer(c,x,q,A),half:98,speed:20,stride:44,period:15},
    peacock:{draw:(c,x,q,A)=>peacock(c,x,q,A),half:150,speed:9,stride:26,period:17},
    rabbit:{draw:(c,x,q,A)=>rabbit(c,x,q,A),half:48,speed:32,stride:22,period:7.5}
  };
  const animals=new Map();
  function animalOf(index){
    const id=seed+':'+index;
    if(animals.has(id))return animals.get(id);
    if(animals.size>96)animals.clear();
    const z=zoneOf(index),kind=z==='jungle'?'tiger':z==='meadow'?'peacock':z==='grassland'?'rabbit':'deer';
    const sp=SPECIES[kind],x0=index*CW,L=layout(index);
    const a={kind,sp,k:hash(seed^0x5eed,index)%997/57,mind:{key:hash(seed^0xa71e,index),
      lo:x0+sp.half,hi:x0+CW-sp.half,speed:sp.speed,stride:sp.stride,period:sp.period,
      avoid:[L.primary,L.support].filter(x=>x!==null),clear:72}};
    animals.set(id,a);
    return a;
  }

  // Prey notices a tiger in the next chapter, stops grazing and watches it; the
  // tiger sinks into a stalk. Both read each other from the same pure clock.
  function awareness(index,me,x,t){
    let al=0,cr=0,toward=null;
    for(const j of[index-1,index+1]){
      const o=animalOf(j);
      if((o.kind==='tiger')===(me.kind==='tiger'))continue;
      const ox=CreatureMind.wander(o.mind,t-ArtPresence.lag(o.mind.key)).x,d=Math.abs(ox-x);
      if(me.kind==='tiger'){const v=CreatureMind.proximity(d,230,400);if(v>cr){cr=v;toward=ox;}}
      else{const v=CreatureMind.proximity(d,250,430);if(v>al){al=v;toward=ox;}}
    }
    return {al,cr,toward};
  }

  // Replays the first draws of tree() to find its crown, so birds perch in
  // real foliage instead of at a guessed height.
  const crowns=new Map();let crownSeed=null;
  function crownOf(x,s,sc){
    const q=mulberry32(s),h=150+q()*110;q();
    const tx=x+(q()-.5)*44;
    return [x+(tx-x)*sc,gy(x)+(4-h)*sc,sc];
  }
  function remember(index,list){
    if(crownSeed!==seed){crowns.clear();crownSeed=seed;}
    // Chunk objects are evicted beyond five chapters; keep crowns a little longer.
    if(crowns.size>40)for(const k of crowns.keys())if(Math.abs(k-index)>12)crowns.delete(k);
    crowns.set(index,list);
  }
  function perches(index){
    if(crownSeed!==seed||!crowns.has(index))objs(index);
    const out=[];
    for(const [cx,cy,sc] of crowns.get(index)||[])
      for(const side of[-1,1])out.push([cx+side*28*sc,cy-62*sc]);
    return out;
  }

  function restingBird(c,x,y,q,t,phase,dir=1){
    c.save();
    c.translate(0,Math.sin(t*.63+phase)*1.6);
    bird(c,x,y,dir,.56,q,false);
    c.restore();
  }

  function install() {
    const originalInit=STYLES.gond.init;
    STYLES.gond.init=function(r){
      originalInit(r);
      const theme=scenes[Math.floor(r()*scenes.length)];
      G=theme.bank.slice();
      WC=theme.water;
      this.benchmarkPalette=theme;
    };
    STYLES.gond.focus=330;
    STYLES.gond.anim=(c,xa,xb,t)=>glints(c,xa,xb,t,.26);

    STYLES.gond.chunk=function(r,x0,add,z,act){
      const index=Math.round(x0/CW);
      const L=layout(index),hero=L.hero,primary=L.primary;
      const shade=this.benchmarkPalette||scenes[0];
      const scale=hero?1.19+r()*.08:.82+r()*.13;
      const occupancy=[primary];
      // Neighbouring trees count too, so animals and sprigs stay clear across seams.
      const nearby=[layout(index-1),layout(index+1)];
      const clearance=[primary,...nearby.flatMap(n=>[n.primary,n.support])
        .filter(x=>x!==null&&Math.abs(x-x0-CW/2)<CW)];

      // One composed distance, with a different silhouette per chapter.
      // This section is intentionally sparse so the patterned tree stays dominant.
      add(0,c=>paperGrain(c,x0,x0+CW)); // exact span: overlapping grain doubled at chunk seams
      const hillX=x0+(hero?336:280+r()*120);
      add(1,(c,q)=>{
        distantRise(c,hillX+114,475,480,94,shade.hill,q,.28);
        distantRise(c,hillX-130,490,370,67,shade.grove,q,.22);
      });
      if(index%5===2){
        add(1,(c,q)=>{c.save();c.globalAlpha=.82;
          sun(c,x0+410,topY+92);
          c.restore();});
      }

      // The focal tree is the only large silhouette within its chapter.
      add(2,c=>contact(c,primary,scale));
      const primarySeed=add(3,function*(c,q){
        const y=gy(primary);
        c.translate(primary,y);
        c.scale(scale,scale);
        c.translate(-primary,-y);
        yield* tree(c,primary,q);
      });
      const crownList=[crownOf(primary,primarySeed,scale)];

      // Small supporting foliage is asymmetrical, and never competes with the hero.
      const supports=L.support===null?[]:[L.support];
      for(const tx of supports){
        occupancy.push(tx);
        clearance.push(tx);
        const s=hero?.55+r()*.11:.69+r()*.11;
        add(2,c=>contact(c,tx,s));
        const supportSeed=add(3,function*(c,q){
          const y=gy(tx);
          c.translate(tx,y);c.scale(s,s);c.translate(-tx,-y);
          yield* tree(c,tx,q);
        });
        crownList.push(crownOf(tx,supportSeed,s));
      }
      remember(index,crownList);

      // Rooted, deliberately spaced plants replace the former floating foreground.
      const plants=hero?[x0+46,x0+560]:[x0+64,x0+530];
      for(const px of plants){
        if(clearance.some(x=>Math.abs(px-x)<70))continue;
        add(4,(c,q)=>bankSprig(c,px,q,.9+q()*.2));
      }
      if(!hero){
        const sx=x0+360;
        if(Math.abs(sx-primary)>110)add(4,(c,q)=>shrub(c,sx,q));
      }

      // The tree breathes, but its trunk and ground contact remain fixed.
      const phase=r()*TAU, left=primary-30-r()*30;
      act((c,t,q)=>{
        if(!artVisible(primary,250))return;
        const u=((t*.026+phase/TAU)%1+1)%1;
        const x=left+Math.sin(u*TAU)*18+u*32;
        const y=gy(primary)-210+u*185;
        c.globalAlpha=Math.min(.82,u*8,(1-u)*6);
        c.save();c.translate(x,y);c.rotate(Math.sin(u*TAU)*.2);
        leaf(c,0,0,-PI/2+Math.sin(t*.42+phase)*.17,19,7,1,
          '#c5824d','#e5b755');
        c.restore();
        c.globalAlpha=1;
      });

      // One animal story per chapter, with a mind of its own: it picks a spot,
      // walks there, rests (grazing, nibbling, preening) and watches its neighbours.
      const me=animalOf(index);
      act((c,t,q)=>{
        if(!artVisible(x0+CW/2,CW/2+180))return;
        // The viewer counts as one more neighbour: prey stop and look, the tiger
        // watches, and a peacock that is watched displays its fan.
        const s=ArtPresence.creature(me.mind,t),w=awareness(index,me,s.x,t),you=s.notice;
        const watch=s.resting&&w.toward!==null&&Math.max(w.al,w.cr)>.35&&you<.3;
        const peacock=me.kind==='peacock',al=peacock||me.kind==='tiger'?w.al:Math.max(w.al,you*.9);
        me.sp.draw(c,s.x,q,{t,ph:s.ph,m:s.m,dir:watch?(w.toward>s.x?1:-1):s.dir,k:me.k,
          g:peacock?Math.max(s.env,you):s.env,idle:peacock&&you>.2?0:s.idle,al,cr:w.cr});
      });

      // Water creatures and glints stay below the actual RIVER boundary.
      if((index%2+2)%2===0){
        const fx=x0+155+r()*260,fy=RIVER+24+r()*19,ph=r()*TAU;
        act((c,t,q)=>{
          const x=fx+Math.sin(t*.32+ph)*38;
          if(!artVisible(x,65))return;
          fish(c,x,fy+Math.sin(t*.65+ph)*1.6,
            Math.cos(t*.32+ph)>=0?1:-1,.67,q);
        });
      }

      // A bird commutes between the crowns of this chapter and the next: it perches,
      // shuffles along the branch, then flies an arc to another canopy. Birds live
      // on even chapters only, so two never share a pair of trees.
      if(index%2===0){
        const key=hash(seed^0xb1d,index),ph=key%7;
        act((c,t,q)=>{
          const spots=[...perches(index),...perches(index+1)];
          if(spots.length<2)return;
          const b=ArtPresence.perch({key,spots,speed:120,period:16,lift:24},t);
          if(!artVisible(b.x,80))return;
          if(b.flying)bird(c,b.x,b.y,b.dir,.55,q,true,Math.sin(t*13+ph));
          else{
            // Preening: a small tilt that settles before take-off.
            c.translate(b.x,b.y);c.rotate(Math.sin(t*3.1+ph)*.07*b.env);c.translate(-b.x,-b.y);
            restingBird(c,b.x,b.y,q,t,ph,b.dir);
          }
        });
      }
    };
  }
  return {install};
})();