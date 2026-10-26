/* Sparse, seeded accents. Major scenery is owned by each tradition's chunk grammar. */
const ArtFinishing={install(){
 const mb=STYLES.madhubani.chunk;
 STYLES.madhubani.chunk=function(r,x,add,z,act){
  mb.call(this,r,x,add,z,act);
  if(r()<.45)add(1,(c,q)=>{
   const xx=x+65+q()*450,yy=topY+65+q()*30;
   c.save();c.translate(xx,yy);
   for(let k=0;k<8;k++){const a=k*TAU/8;mbLeaf(c,Math.cos(a)*12,Math.sin(a)*12,a,18,4,k%2?'#d1a446':'#57845b');}
   mbFlowerDot(c,0,0,5,'#b7503d');c.restore();
  });
 };
 const japan=STYLES.japan.chunk;
 STYLES.japan.chunk=function(r,x,add,z,act){
  japan.call(this,r,x,add,z,act);
  if(z==='headland'&&r()<.32){
   const px=x+140+r()*300,w=110+r()*35,h=16+r()*8,y=602+r()*10;
   add(4,(c,q)=>{jpBank(c,px,y,w,h,q);jpTorii(c,px,jpBankY(px,px,y,w,h)+2,.5+q()*.1);});
  }
 };
}};
