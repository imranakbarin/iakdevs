/* Localized motion in the original artwork's 1448 × 1086 coordinates.
   No camera drift: furniture, window frames, and interior walls stay fixed. */
window.CozySceneMotion = (() => {
  const W=1448,H=1086;
  const GLASS=[
    [[1052,15],[1152,15],[1152,138],[1052,149]],
    [[1205,10],[1285,10],[1285,124],[1205,129]],
    [[1299,10],[1323,10],[1323,122],[1299,124]],
    [[1103,165],[1151,162],[1151,242],[1103,242]],
    [[1205,153],[1285,149],[1285,278],[1205,287]],
    [[1299,147],[1324,143],[1324,285],[1299,287]],
    [[1205,305],[1284,302],[1284,360],[1205,370]],
    [[1301,308],[1323,308],[1323,443],[1301,443]]
  ];
  function polygon(ctx,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
  function create(image,kind,options={}){
    const make=options.makeCanvas||((w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
    const random=options.random||Math.random;
    function patch(x,y,w,h,{points,feather=10,ellipse=false}={}){
      const c=make(w,h),p=c.getContext('2d'),mask=make(w,h),m=mask.getContext('2d');
      p.drawImage(image,x,y,w,h,0,0,w,h);m.filter=`blur(${feather}px)`;m.fillStyle='#fff';
      if(ellipse){m.beginPath();m.ellipse(w/2,h/2,Math.max(1,w/2-feather),Math.max(1,h/2-feather),0,0,Math.PI*2);}
      else polygon(m,points?points.map(([a,b])=>[a-x,b-y]):[[feather,feather],[w-feather,feather],[w-feather,h-feather],[feather,h-feather]]);
      m.fill();p.globalCompositeOperation='destination-in';p.drawImage(mask,0,0);return {c,x,y,w,h};
    }
    function wave(ctx,p,t,amplitude=2.5,rate=.8){
      for(let y=0;y<p.h;y+=3){
        const h=Math.min(3,p.h-y),depth=y/p.h;
        const dx=Math.sin(y*.085-t*rate)*amplitude*(.24+.76*depth)+Math.sin(y*.041+t*.7)*amplitude*.35;
        ctx.drawImage(p.c,0,y,p.w,h,p.x+dx,p.y+y,p.w,h);
      }
    }
    function sway(ctx,p,t,phase=0){
      const pivotX=p.x+p.w*.52,pivotY=p.y+p.h;
      ctx.save();ctx.translate(pivotX,pivotY);ctx.rotate(Math.sin(t*.7+phase)*.008+Math.sin(t*.31+phase)*.002);
      ctx.drawImage(p.c,p.x-pivotX,p.y-pivotY);ctx.restore();
    }
    function glow(ctx,x,y,r,alpha){
      ctx.save();ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(255,195,100,${alpha})`);g.addColorStop(.4,`rgba(255,158,58,${alpha*.35})`);g.addColorStop(1,'rgba(255,158,58,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    const waters=[],leaves=[],flames=[];let body,ear;
    if(kind==='nook'){
      body=patch(750,519,199,126,{ellipse:true,feather:11});ear=patch(944,494,53,64,{ellipse:true,feather:6});
      [[117,126],[116,399],[340,563],[473,210],[636,245],[1430,77]].forEach(([x,y],i)=>flames.push({...patch(x-15,y-25,30,48,{feather:4}),phase:i*1.37,cx:x,cy:y}));
    }else if(kind==='tea'){
      waters.push(patch(811,549,295,62,{feather:5,points:[[840,582],[865,564],[900,580],[959,579],[998,558],[1060,552],[1090,573],[1050,596],[956,603],[835,603]]}));
      leaves.push(patch(978,91,239,423,{ellipse:true,feather:26}),patch(376,60,279,315,{ellipse:true,feather:25}));
    }else if(kind==='cabin'){
      waters.push(patch(508,502,792,204,{feather:9,points:[[521,515],[1284,515],[1284,566],[1215,589],[1160,625],[1000,644],[900,692],[720,659],[521,623]]}));
      flames.push({...patch(0,455,54,163,{feather:6,points:[[0,463],[34,463],[44,601],[0,601]]}),phase:0,cx:14,cy:552});
    }
    const drops=GLASS.map(points=>{
      const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      return {points,minX,maxX,minY,maxY,drops:Array.from({length:13},()=>({x:minX+4+random()*(maxX-minX-8),start:random(),speed:100+random()*105,len:9+random()*15,alpha:.22+random()*.25})),beads:Array.from({length:6},()=>({x:minX+3+random()*(maxX-minX-6),start:random(),speed:7+random()*10,r:.9+random()*1.5}))};
    });
    function rain(ctx,t){
      for(const p of drops){ctx.save();polygon(ctx,p.points);ctx.clip();
        for(const d of p.drops){const span=p.maxY-p.minY+30,y=p.minY-15+((d.start*span+t*d.speed)%span);ctx.strokeStyle=`rgba(213,233,248,${d.alpha})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(d.x,y);ctx.lineTo(d.x-2,y+d.len);ctx.stroke();}
        for(const d of p.beads){const span=p.maxY-p.minY+10,y=p.minY-5+((d.start*span+t*d.speed)%span);ctx.strokeStyle='rgba(225,244,255,.26)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(d.x,y-10);ctx.lineTo(d.x,y);ctx.stroke();ctx.fillStyle='rgba(239,249,255,.48)';ctx.beginPath();ctx.ellipse(d.x,y,d.r*.65,d.r,0,0,Math.PI*2);ctx.fill();}
        ctx.restore();
      }
    }
    function fire(ctx,t){
      for(const p of flames){
        for(let y=0;y<p.h;y+=2){const h=Math.min(2,p.h-y),lift=1-y/p.h,dx=Math.sin(t*5.1+y*.09+p.phase)*lift*(kind==='cabin'?2.7:1.8);ctx.drawImage(p.c,0,y,p.w,h,p.x+dx,p.y+y,p.w,h);}
        const pulse=.5+.3*Math.sin(t*3.4+p.phase)+.2*Math.sin(t*7.1+p.phase);
        glow(ctx,p.cx,p.cy,kind==='cabin'?120:49,.055+pulse*.065);
      }
      if(kind==='nook')glow(ctx,1028,329,215,.06+.009*Math.sin(t*.8));
      if(kind==='cabin'){glow(ctx,226,609,108,.025+.006*Math.sin(t*.9));glow(ctx,220,759,225,.022+.013*Math.sin(t*2.1));}
    }
    function cat(ctx,t){
      const breath=(1-Math.cos(t*Math.PI*2/4.8))*.5;
      ctx.save();ctx.translate(843,630);ctx.scale(1+breath*.007,1+breath*.032);ctx.drawImage(body.c,body.x-843,body.y-630);ctx.restore();
      const cycle=t%11;if(cycle>7.8&&cycle<8.5){const s=(cycle-7.8)/.7,a=Math.sin(s*Math.PI*2)*Math.sin(s*Math.PI)*.055;ctx.save();ctx.translate(972,548);ctx.rotate(a);ctx.drawImage(ear.c,ear.x-972,ear.y-548);ctx.restore();}
    }
    // The steam is blurred on a small canvas of its own and laid on the scene:
    // a filter on the full-screen canvas blurred all of it for every wisp,
    // every frame (it held Cozy Worlds to 20-30 frames a second).
    let steamBuf=null;
    function steam(ctx,t){
      const [x,y]=kind==='tea'?[1067,660]:kind==='cabin'?[523,770]:[460,522];
      const m=ctx.getTransform?ctx.getTransform():{a:1},k=Math.max(.5,Math.abs(m.a)||1),bx=x-48,by=y-136,bw=96,bh=144;
      const cw=Math.ceil(bw*k),chh=Math.ceil(bh*k);
      if(!steamBuf||steamBuf.width!==cw||steamBuf.height!==chh)steamBuf=make(cw,chh);
      const g0=steamBuf.getContext('2d');g0.setTransform(1,0,0,1,0,0);g0.clearRect(0,0,cw,chh);g0.setTransform(k,0,0,k,-bx*k,-by*k);g0.filter='blur(1.4px)';
      for(let i=0;i<3;i++){
        const px=x+(i-1)*10,top=y-109-i*7,sway=Math.sin(t*.65+i*1.6)*10;
        const g=g0.createLinearGradient(px,y,px,top);g.addColorStop(0,'rgba(250,247,239,0)');g.addColorStop(.18,'rgba(250,247,239,.25)');g.addColorStop(.55,'rgba(250,247,239,.14)');g.addColorStop(1,'rgba(250,247,239,0)');
        g0.strokeStyle=g;g0.lineWidth=2.2+i*.45;g0.beginPath();g0.moveTo(px,y);g0.bezierCurveTo(px-9+sway,y-28,px+14-sway,y-73,px+sway,top);g0.stroke();
      }
      ctx.save();ctx.globalCompositeOperation='screen';ctx.drawImage(steamBuf,bx,by,bw,bh);ctx.restore();
    }
    return {draw(ctx,t){
      waters.forEach(p=>wave(ctx,p,t,kind==='cabin'?3.4:1.8));
      leaves.forEach((p,i)=>sway(ctx,p,t,i*2));
      if(kind==='nook'){rain(ctx,t);cat(ctx,t);}
      if(kind!=='tea')fire(ctx,t);
      steam(ctx,t);
    },dispose(){for(const p of [...waters,...leaves,...flames,body,ear])if(p){p.c.width=1;p.c.height=1;}if(steamBuf){steamBuf.width=steamBuf.height=1;}}};
  }
  return {create,width:W,height:H};
})();
