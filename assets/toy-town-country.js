/* Architectural journeys: one choice, shared by WebGL and classic Canvas. */
(function(){
  'use strict';
  const styles={
    town:{name:'Toy Town'},
    india:{name:'India',inspiration:'Jaipur courtyard houses',wall:['#d9a184','#e0b69a','#cd907b'],roof:'#b56e51',trim:'#f5dfb9'},
    japan:{name:'Japan',inspiration:'Kyoto timber townhouses',wall:['#e8dcc2','#dfd1b7','#d1b99b'],roof:'#505b60',trim:'#694e3c'},
    italy:{name:'Italy',inspiration:'Tuscan village streets',wall:['#e8c38c','#e5b3a0','#ead9b0'],roof:'#b96f4c',trim:'#eee0c4'},
    netherlands:{name:'Netherlands',inspiration:'Dutch canal houses',wall:['#9d6555','#b57e62','#bba186'],roof:'#645c56',trim:'#f0e5cc'},
    usa:{name:'USA',inspiration:'American porch and brownstone streets',wall:['#b87964','#c8ac85','#d2dcd2'],roof:'#66747a',trim:'#f4eada'}
  };
  let saved='town';try{saved=localStorage.getItem('toy-town:country')||saved;}catch(e){}
  const requested=new URLSearchParams(location.search).get('country');
  let id=Object.hasOwn(styles,requested)?requested:Object.hasOwn(styles,saved)?saved:'town';
  const select=document.getElementById('country-select'),status=document.getElementById('country-status');
  function paint(){
    if(select)select.value=id;
    document.documentElement.dataset.country=id;
    if(status)status.textContent=styles[id].inspiration||'Original miniature town';
  }
  window.ToyTownCountry={get id(){return id;},styles,
    set(next){
      if(!Object.hasOwn(styles,next))return false;
      if(next===id){paint();return true;}
      // Build first: a renderer failure must not leave a falsely selected country.
      if(window.ToyTown3D?.active&&window.ToyTown3D.setCountry(next)===false)return false;
      id=next;try{localStorage.setItem('toy-town:country',id);}catch(e){}
      try{const u=new URL(location.href);if(id==='town')u.searchParams.delete('country');else u.searchParams.set('country',id);history.replaceState(null,'',u);}catch(e){}
      paint();return true;
    },
    building(b){
      const style=styles[id];if(!style.wall||b.kind==='site')return b;
      return {...b,country:id,wall:style.wall[Math.abs(b.x*7+b.y*11)%style.wall.length],roof:style.roof,awning:style.roof,trim:style.trim};
    }
  };
  select?.addEventListener('change',()=>{if(!window.ToyTownCountry.set(select.value))paint();});
  paint();
})();
