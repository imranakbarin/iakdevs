/* Tradition-specific composition details, cached with their existing world tiles. */
const ArtFinishing={install(){
 const warli=STYLES.warli.chunk;STYLES.warli.chunk=function(r,x,add,z,act){warli.call(this,r,x,add,z,act);add(3,(c,q)=>{const tx=x+525,y=gy(tx);c.save();c.translate(tx,y);c.scale(.8,.8);c.translate(-tx,-y);wTree(c,tx,q);c.restore();});};
 const mb=STYLES.madhubani.chunk;STYLES.madhubani.chunk=function(r,x,add,z,act){mb.call(this,r,x,add,z,act);add(1,(c,q)=>{for(let j=0;j<3;j++){const xx=x+70+j*210,yy=topY+85+(j%2)*35;c.save();c.translate(xx,yy);for(let k=0;k<8;k++){const a=k*TAU/8;mbLeaf(c,Math.cos(a)*12,Math.sin(a)*12,a,18,4,k%2?'#d1a446':'#57845b');}mbFlowerDot(c,0,0,5,'#b7503d');c.restore();}});};
 const japan=STYLES.japan.chunk;STYLES.japan.chunk=function(r,x,add,z,act){japan.call(this,r,x,add,z,act);add(4,(c,q)=>{const px=x+435; jpBank(c,px,600,120,18,q);jpTorii(c,px,583,.55);for(let j=0;j<5;j++){c.beginPath();c.moveTo(px-45+j*21,604);c.quadraticCurveTo(px-35+j*21,602,px-23+j*21,604);artStroke(c,'rgba(235,218,179,.45)',.6);}});};
 const china=STYLES.china.chunk;STYLES.china.chunk=function(r,x,add,z,act){china.call(this,r,x,add,z,act);add(4,(c,q)=>{const px=x+535;inkMass(c,px,616,100,32,q,'#7b8b73',.6);inkBamboo(c,px,610,.72,q);});};
}};
