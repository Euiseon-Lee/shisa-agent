// Cap lists using actual row heights, including wrapped titles.
export function completedListHeight(rows, padding=0, limit=10) {
 if(rows.length<=limit)return null;
 const height=rows[limit-1].bottom-rows[0].top+padding;
 return height>0 ? Math.ceil(height) : null;
}
export function observeCompletedList(box, scrollTop=0, limit=10) {
 if(!box || box.children.length<=limit)return ()=>{};
 let restore=true;
 const measure=()=>{
  const rows=[...box.children].map(row=>row.getBoundingClientRect());
  const css=getComputedStyle(box);
  const height=completedListHeight(rows,parseFloat(css.paddingTop||0)+parseFloat(css.paddingBottom||0)+parseFloat(css.borderTopWidth||0)+parseFloat(css.borderBottomWidth||0),limit);
  if(height===null)return;
  const value=height+'px';if(box.style.maxHeight!==value)box.style.maxHeight=value;
  if(restore){box.scrollTop=scrollTop;restore=false;}
 };
 const observer=new ResizeObserver(measure);
 observer.observe(box);for(const row of [...box.children].slice(0,limit))observer.observe(row);
 measure();return ()=>observer.disconnect();
}
