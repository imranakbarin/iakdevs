/* Gond benchmark: composition-first, grounded living landscape.
   Intentionally local to Gond. Other art traditions keep their own grammars. */
const GondBenchmark = (() => {
  const scenes = [
    {bank:['#954b35','#e1a653'],water:'#306f78',hill:'#819064',grove:'#436b58'},
    {bank:['#a3533c','#e3b45e'],water:'#347684',hill:'#8c9b69',grove:'#4f795e'},
    {bank:['#934836','#dba050'],water:'#366e83',hill:'#838c69',grove:'#466f62'}
  ];

  // A low patterned rise lives behind the trunks, not on top of the river.
  function distantRise(c, x, y, w, h, fill, q, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.moveTo(x-w/2, y);
    for(let j=0; j<=32; j++) {
      const u=j/32, xx=x-w/2+u*w;
      c.lineTo(xx, y-Math.pow(Math.sin(Math.PI*u), .84)*h
        +Math.sin(u*12+q()*0.02)*1.8);
    }
    c.lineTo(x+w/2,y);
    c.closePath();
    c.fillStyle=fill;
    c.fill();
    c.clip();
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

  function restingBird(c,x,y,q,t,phase){
    c.save();
    c.translate(0,Math.sin(t*.63+phase)*1.6);
    bird(c,x,y,1,.56,q,false);
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
      const hero=index===0||((index%3+3)%3===0);
      const shade=this.benchmarkPalette||scenes[0];
      const primary=x0+(hero?316:160+r()*280);
      const scale=hero?1.19+r()*.08:.82+r()*.13;
      const occupancy=[primary];

      // One composed distance, with a different silhouette per chapter.
      // This section is intentionally sparse so the patterned tree stays dominant.
      add(0,c=>paperGrain(c,x0-4,x0+CW+4));
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
      add(3,function*(c,q){
        const y=gy(primary);
        c.translate(primary,y);
        c.scale(scale,scale);
        c.translate(-primary,-y);
        yield* tree(c,primary,q);
      });

      // Small supporting foliage is asymmetrical, and never competes with the hero.
      const supports=hero?[x0+64,x0+554]:(r()<.52?[x0+525]:[x0+70]);
      for(const tx of supports){
        if(Math.abs(tx-primary)<160)continue;
        occupancy.push(tx);
        const s=hero?.55+r()*.11:.69+r()*.11;
        add(2,c=>contact(c,tx,s));
        add(3,function*(c,q){
          const y=gy(tx);
          c.translate(tx,y);c.scale(s,s);c.translate(-tx,-y);
          yield* tree(c,tx,q);
        });
      }

      // Rooted, deliberately spaced plants replace the former floating foreground.
      const plants=hero?[x0+46,x0+560]:[x0+64,x0+530];
      for(const px of plants){
        if(Math.abs(px-primary)<88)continue;
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
        const y=gy(primary)-155+u*127;
        c.globalAlpha=Math.min(.82,u*8,(1-u)*6);
        c.save();c.translate(x,y);c.rotate(Math.sin(u*TAU)*.2);
        leaf(c,0,0,-PI/2+Math.sin(t*.42+phase)*.17,19,7,1,
          '#c5824d','#e5b755');
        c.restore();
        c.globalAlpha=1;
      });

      // A single animal story per chapter; feet resolve against the same terrain.
      const possible=[x0+84,x0+510,x0+445,x0+120];
      possible.sort((a,b)=>Math.min(...occupancy.map(x=>Math.abs(b-x)))-
                             Math.min(...occupancy.map(x=>Math.abs(a-x))));
      const ax=possible[0], travel=36+r()*22, phaseWalk=r();
      const subject=z==='jungle'?tiger:z==='meadow'?peacock:
                    z==='grassland'?rabbit:deer;
      act((c,t,q)=>{
        if(!artVisible(ax,180))return;
        walkA(t,ax,travel,z==='jungle'?2.6:2.1,phaseWalk,42,(x,A)=>{
          if(artVisible(x,160))subject(c,x,q,A);
        });
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

      // A single distant bird, with a slower rhythm than the foreground life.
      if(index%2===0){
        const bx=x0+190+r()*230,by=topY+128+r()*40,ph=r()*TAU;
        act((c,t,q)=>{
          const x=bx+Math.sin(t*.19+ph)*58;
          if(artVisible(x,75))bird(c,x,by+Math.sin(t*.48+ph)*6,1,.55,q,true,
             Math.sin(t*2.3+ph));
        },true);
      } else if(hero) {
        const bx=primary-72,by=gy(primary)-210;
        act((c,t,q)=>{if(artVisible(bx,80))restingBird(c,bx,by,q,t,phase);});
      }
    };
  }
  return {install};
})();