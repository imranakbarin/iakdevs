/* Toy Town Diorama renderer: projected miniature architecture, soft hand-crafted materials.
 * Classic script loaded before toy-town.js. No camera or simulation ownership. */
const ToyTownDiorama = (() => {
  const poly = (c,points,fill,edge) => {
    c.beginPath(); c.moveTo(...points[0]); for(const p of points.slice(1))c.lineTo(...p);
    c.closePath(); c.fillStyle=fill; c.fill();
    if(edge){c.strokeStyle=edge;c.lineWidth=Math.max(.6, .8*scale);c.stroke();}
  };
  let scale=1;
  const gradient = (c,x,y,r,bright,base) => {
    const g=c.createRadialGradient(x-r*.32,y-r*.4,Math.max(.1,r*.08),x,y,r);
    g.addColorStop(0,bright);g.addColorStop(1,base);return g;
  };
  function glazing(c,P,x,y,z,w,h,side,night,flowers=false){
    const pt=(u,v)=>side==='south'?P(x+u,y+.412,z+v):P(x+.412,y+u,z+v);
    const a=pt(-w/2,0),b=pt(w/2,0),d=pt(w/2,h),e=pt(-w/2,h);
    c.save();c.lineJoin='round';
    c.strokeStyle='#f9e8cf';c.lineWidth=Math.max(2.2,3.6*scale);
    c.beginPath();c.moveTo(...a);c.lineTo(...e);c.lineTo(...d);c.lineTo(...b);c.stroke();
    const g=c.createLinearGradient(a[0],e[1],b[0],b[1]);
    g.addColorStop(0,night?'#e8c38e':'#73aab8');
    g.addColorStop(.42,night?'#fff1c6':'#c8f0ea');
    g.addColorStop(1,night?'#c89668':'#508b9b');
    poly(c,[a,b,d,e],g,'rgba(255,255,255,.66)');
    const midA=pt(0,0),midB=pt(0,h),midC=pt(-w/2,h*.52),midD=pt(w/2,h*.52);
    c.strokeStyle='rgba(249,253,244,.88)';c.lineWidth=Math.max(.9,1.2*scale);
    c.beginPath();c.moveTo(...midA);c.lineTo(...midB);c.moveTo(...midC);c.lineTo(...midD);c.stroke();
    c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=Math.max(.7,scale*.8);
    const re1=pt(-w*.34,2),re2=pt(-w*.18,h-2);
    c.beginPath();c.moveTo(...re1);c.lineTo(...re2);c.stroke();
    c.strokeStyle='#f6e8d2';c.lineWidth=Math.max(2,3*scale);
    c.beginPath();c.moveTo(...pt(-w*.6,-.8));c.lineTo(...pt(w*.6,-.8));c.stroke();
    if(flowers){
      const q=pt(0,-3);
      c.fillStyle='#ae785b';c.beginPath();c.ellipse(q[0],q[1],7.5*scale,1.9*scale,0,0,Math.PI*2);c.fill();
      for(let k=-2;k<=2;k++){
        const xx=q[0]+k*3.1*scale,yy=q[1]-3.2*scale-(k%2)*scale;
        c.fillStyle='#5e9b70';c.beginPath();c.arc(xx,yy+1.7*scale,2.3*scale,0,Math.PI*2);c.fill();
        c.fillStyle=k%2?'#f2e7c9':'#f09b9b';c.beginPath();c.arc(xx,yy,1.6*scale,0,Math.PI*2);c.fill();
      }
    }
    c.restore();
  }
  function door(c,P,x,y,z,w,h,wall){
    const a=P(x-w/2,y,z),b=P(x+w/2,y,z),
      tl=P(x-w/2,y,z+h-5),tr=P(x+w/2,y,z+h-5),mid=P(x,y,z+h);
    c.beginPath();c.moveTo(...a);c.lineTo(...tl);c.quadraticCurveTo(mid[0],mid[1]-2*scale,tr[0],tr[1]);
    c.lineTo(...b);c.closePath();c.fillStyle=wall;c.fill();
    c.strokeStyle='#f9e3c7';c.lineWidth=Math.max(1.8,2.5*scale);c.stroke();
    const k=P(x+w*.29,y,z+h*.43);
    c.fillStyle='#ebcc88';c.beginPath();c.arc(k[0],k[1],1.25*scale,0,Math.PI*2);c.fill();
    c.strokeStyle='rgba(255,255,255,.26)';c.lineWidth=scale;
    const lo=P(x-.02,y,z+4),hi=P(x-.02,y,z+h-7);
    c.beginPath();c.moveTo(...lo);c.lineTo(...hi);c.stroke();
  }
  function gable(c,P,cx,cy,h,roof,taller,shade){
    const hw=.50,hd=.49,lift=taller?21:16,eave=h+1;
    const rb=P(cx-hw,cy,h+lift),rf=P(cx+hw,cy,h+lift);
    const bl=P(cx-hw,cy-hd,eave),br=P(cx+hw,cy-hd,eave);
    const fl=P(cx-hw,cy+hd,eave),fr=P(cx+hw,cy+hd,eave);
    poly(c,[br,fr,rf],shade(roof,1.21));
    poly(c,[bl,br,rf,rb],shade(roof,1.16),'rgba(255,255,255,.22)');
    poly(c,[rb,rf,fr,fl],shade(roof,.88),'rgba(72,48,48,.20)');
    c.save();c.lineCap='round';c.lineJoin='round';
    for(let row=1;row<=5;row++){
      const t=row/6, yy=cy+hd*t, zz=eave+(1-t)*lift;
      c.strokeStyle=row%2?'rgba(255,240,206,.42)':'rgba(99,58,43,.24)';
      c.lineWidth=Math.max(.65,.86*scale);c.beginPath();
      c.moveTo(...P(cx-hw+.02,yy,zz));c.lineTo(...P(cx+hw-.02,yy,zz));c.stroke();
      for(let col=0;col<5;col++){
        const u=cx-hw+(col+.6+(row%2)*.4)*hw*2/5,p=P(u,yy,zz);
        c.strokeStyle='rgba(77,53,45,.24)';c.beginPath();
        c.moveTo(p[0],p[1]);c.lineTo(p[0]+3.6*scale,p[1]+1.8*scale);c.stroke();
      }
    }
    c.strokeStyle='rgba(255,246,222,.87)';c.lineWidth=Math.max(1.5,2.7*scale);
    c.beginPath();c.moveTo(...rb);c.lineTo(...rf);c.stroke();
    c.strokeStyle=shade(roof,.61);c.lineWidth=Math.max(1.3,1.8*scale);
    c.beginPath();c.moveTo(...fl);c.lineTo(...rb);c.lineTo(...rf);c.lineTo(...fr);c.stroke();
    c.restore();
  }
  function countryRoof(c,b,v,cx,cy,h,roof,tall){
    const {P,box,shade,S}=v;
    if(!b.country){gable(c,P,cx,cy,h,roof,tall,shade);return;}
    if(b.country==='india'){
      box(c,cx,cy,.46,.45,h,3,b.trim);box(c,cx,cy-.38,.46,.026,h+2,4,b.trim);
      const q=P(cx,cy,h+9);c.fillStyle=roof;c.beginPath();c.ellipse(q[0],q[1],10*S,7*S,0,Math.PI,Math.PI*2);c.fill();
      for(const x of [-.15,.15])box(c,cx+x,cy,.018,.018,h+2,7,b.trim);
    }else if(b.country==='netherlands'){
      gable(c,P,cx,cy,h,roof,tall,shade);
      for(let i=0;i<4;i++)box(c,cx,cy+.42,.40-i*.085,.025,h+i*3.5,3.5,b.wall,b.trim);
    }else{
      gable(c,P,cx,cy,h,roof,b.country==='japan'?false:tall,shade);
      if(b.country==='japan'){
        box(c,cx,cy+.46,.50,.13,h*.63,2,roof);
        for(let i=-3;i<=3;i++)box(c,cx+i*.11,cy+.416,.009,.015,5,h*.5,'#694e3c');
      }else if(b.country==='usa'){
        box(c,cx,cy+.52,.35,.15,0,2,b.trim);
        for(const x of [-.29,.29])box(c,cx+x,cy+.62,.018,.018,2,17,b.trim);
        box(c,cx,cy+.53,.37,.17,19,2,roof);
      }else if(b.country==='italy')for(const x of [-.32,-.05])box(c,cx+x,cy+.42,.032,.02,h*.36,13,'#6b8470');
    }
  }
  function building(c,b,night,v){
    const {P,box,shade,S}=v;scale=S;
    const cx=b.x+.5,cy=b.y+.5,h=b.h,shop=b.kind==='shop';
    const roof=shop?b.awning:b.roof;
    c.save();
    // Ground shadow extends only underneath the plinth, not onto neighbouring roofs.
    const foot=P(cx,cy+.16),rad=28*S;
    c.fillStyle=gradient(c,foot[0],foot[1],rad,'rgba(52,55,46,.23)','rgba(52,55,46,0)');
    c.beginPath();c.ellipse(foot[0],foot[1],rad,rad*.43,0,0,Math.PI*2);c.fill();
    box(c,cx,cy,.455,.44,0,4,'#c5b39c','#e7d4bb');
    box(c,cx,cy,.403,.405,4,h-3,b.wall,shade(b.wall,1.2));
    for(const u of [-.385,.385])
      box(c,cx+u,cy+.401,.024,.022,4,h-4,shade(b.wall,1.14),shade(b.wall,1.22));
    if(shop){
      glazing(c,P,cx-.185,cy,h*.31,.29,12,'south',night);
      glazing(c,P,cx+.19,cy,h*.31,.27,12,'south',night);
      glazing(c,P,cx,cy,h*.67,.31,11,'south',night);
      glazing(c,P,cx,cy,h*.59,.28,13,'east',night);
      door(c,P,cx+.195,cy+.417,4,.17,14,'#79604b');
      // Cloth awning: continuous sloped canopy with a row of sewn scallops.
      const canopy=[P(cx-.47,cy+.42,h*.57),P(cx+.47,cy+.42,h*.57),
        P(cx+.47,cy+.70,h*.46),P(cx-.47,cy+.70,h*.46)];
      poly(c,canopy,shade(roof,1.04),'rgba(255,241,219,.75)');
      for(let k=0;k<8;k++){
        const xx=cx-.415+(k+.5)*.83/8,top=P(xx,cy+.42,h*.57),bottom=P(xx,cy+.695,h*.46);
        c.strokeStyle='rgba(255,244,220,.58)';c.lineWidth=Math.max(.8,1.3*S);
        c.beginPath();c.moveTo(...top);c.lineTo(...bottom);c.stroke();
        c.fillStyle=k%2?shade(roof,1.15):shade(roof,.92);
        c.beginPath();c.arc(bottom[0],bottom[1],1.55*S,0,Math.PI*2);c.fill();
      }
      const p=P(cx,cy+.428,h*.83),fs=Math.max(7,7.4*S);
      c.fillStyle='#f7ead2';c.beginPath();c.roundRect(p[0]-26*S,p[1]-6.4*S,52*S,12.8*S,3.6*S);c.fill();
      c.strokeStyle=shade(roof,.8);c.lineWidth=Math.max(1.1,1.3*S);c.stroke();
      c.fillStyle='#4b4140';c.font='800 '+fs+'px Georgia,serif';c.textAlign='center';
      c.fillText(b.name,p[0],p[1]+2.5*S);
      countryRoof(c,b,v,cx,cy,h,roof,false);
      for(const side of [-1,1]){
        const x=cx+side*.36,y=cy+.505;
        box(c,x,y,.055,.075,0,4,'#c78c6b','#d9a587');
        const q=P(x,y,7),g=gradient(c,q[0],q[1]-2*S,4*S,'#bddda0','#467c5d');
        c.fillStyle=g;c.beginPath();c.ellipse(q[0],q[1]-2*S,4.4*S,5*S,0,0,Math.PI*2);c.fill();
      }
    }else{
      glazing(c,P,cx-.17,cy,h*.48,.27,12,'south',night,true);
      glazing(c,P,cx,cy,h*.48,.28,12,'east',night);
      door(c,P,cx+.2,cy+.416,4,.20,16,shade(roof,.67));
      box(c,cx+.2,cy+.54,.185,.14,0,2,'#cab294','#ecd9b9');
      countryRoof(c,b,v,cx,cy,h,roof,true);
      // Short chimney intersects the roof slope rather than floating.
      box(c,cx-.18,cy-.11,.078,.078,h+10,12,'#ae826d','#e7b49a');
      box(c,cx-.18,cy-.11,.096,.096,h+21,2.2,'#926557','#dba58b');
    }
    c.restore();return true;
  }
  function tree(c,p,v){
    const {P,S,shade}=v;scale=S;
    const k=S*p.s,[x,y]=P(p.x,p.y);
    const sway=Math.sin(v.clock*.7+p.x*2.4)*.9*k;
    c.save();
    const shadow=gradient(c,x+4*k,y+1*k,17*k,'rgba(46,66,42,.21)','rgba(46,66,42,0)');
    c.fillStyle=shadow;c.beginPath();c.ellipse(x+4*k,y+3*k,17*k,5*k,0,0,Math.PI*2);c.fill();
    c.lineCap='round';c.strokeStyle='#79573d';c.lineWidth=3.2*k;
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-1.5*k,y-11*k,x+sway,y-22*k);c.stroke();
    const lobes=[[-10,-22,8],[-5,-31,10],[7,-28,11],[11,-19,8],[0,-21,11],[-11,-27,7],[3,-35,7]];
    for(let i=0;i<lobes.length;i++){
      const [lx,ly,r]=lobes[i],cx=x+(lx+sway/k)*k,cy=y+ly*k;
      c.fillStyle=gradient(c,cx,cy,r*k,i%2?'#b8de99':'#99d3a1',shade(p.c,i%3===0?.78:.91));
      c.beginPath();c.arc(cx,cy,r*k,0,Math.PI*2);c.fill();
    }
    c.fillStyle='rgba(245,255,225,.33)';
    for(let i=0;i<7;i++){
      const q=lobes[i],xx=x+(q[0]-2+sway/k)*k,yy=y+(q[1]-3)*k;
      c.beginPath();c.ellipse(xx,yy,2.1*k,1.2*k,-.6,0,Math.PI*2);c.fill();
    }
    c.restore();return true;
  }
  return {building,tree};
})();
