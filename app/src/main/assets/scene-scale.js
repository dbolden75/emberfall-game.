/* Scene-only scale: tree trunks and actor coordinates/collision radii unchanged. */
(() => {
 const tile=drawTile;
 drawTile=function(tx,ty,x,y,size=32){
  if(ty===9&&(tx===13||tx===15)&&size>=40){
   const baseX=x+size/2,baseY=y+size*.57;
   const variation=(Math.sin(baseX*12.9898+baseY*78.233)*43758.5453)%1;
   const height=(size<50?108:154)+Math.abs(variation)*22;
   // Canopy can overhang a path; only the original trunk footprint blocks travel.
   if(standArt(tx===13?'oak':'pine',baseX,baseY,height))return;
  }
  return tile(tx,ty,x,y,size);
 };
 const pet=drawPet;
 drawPet=function(actor){
  const factor=actor.id==='ember_dragon'?.80:.62;
  ctx.save();ctx.translate(actor.x,actor.y);ctx.scale(factor,factor);ctx.translate(-actor.x,-actor.y);
  try{return pet(actor);}finally{ctx.restore();}
 };
})();
