// Hide the freshness label only when the actual visible controls need its space.
export function fitHeader(header, updated) {
  let frame = 0;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext?.('2d');
  if (!context) return; // Layout measurement is unavailable in non-rendering environments.
  function update() {
    frame = 0;
    const style = getComputedStyle(header);
    const children = [...header.children].filter(el => el !== updated && getComputedStyle(el).display !== 'none');
    const labelStyle = getComputedStyle(updated);
    context.font = labelStyle.font;
    const labelWidth = context.measureText(updated.textContent || '').width + 1;
    const controlsWidth = children.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
    const required = controlsWidth + labelWidth + children.length * (parseFloat(style.columnGap) || 0)
      + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const hide = !updated.textContent || required > header.clientWidth;
    if (updated.hidden !== hide) updated.hidden = hide;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  const watch = () => { resize?.observe(header); for (const el of header.children) if (el !== updated) resize?.observe(el); schedule(); };
  const changes = new MutationObserver(watch);
  changes.observe(header, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['hidden'] });
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  watch();
}
