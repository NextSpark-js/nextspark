/**
 * Block Selector Injection Script
 *
 * Generates a self-contained JS string that, when injected into the preview
 * iframe, highlights blocks on hover and sends a postMessage on click so the
 * studio parent can open the corresponding block editor.
 *
 * Supports three DOM structures:
 * 1. Core PageRenderer: elements with `data-block-slug` attributes
 * 2. Dashboard zones: elements with `data-ns-zone` attributes
 * 3. Studio-generated templates: `<section>` children of `<main>`
 */

export function getInjectionScript(): string {
  return `
(function() {
  if (window.__nsBlockSelectorActive) return;
  window.__nsBlockSelectorActive = true;

  /* ── Detect block elements ──
   * First try data-block-slug (core PageRenderer).
   * Then try data-ns-zone (dashboard zones).
   * Fallback to section children of main (Studio templates). */
  function getBlockElements() {
    var slugged = document.querySelectorAll('[data-block-slug]');
    if (slugged.length > 0) return { blocks: Array.from(slugged), mode: 'slug' };
    var zones = document.querySelectorAll('[data-ns-zone]');
    if (zones.length > 0) return { blocks: Array.from(zones), mode: 'dashboard' };
    var main = document.querySelector('main[data-cy]') || document.querySelector('main');
    if (main) {
      var sections = Array.from(main.querySelectorAll(':scope > section'));
      if (sections.length > 0) return { blocks: sections, mode: 'section' };
    }
    return { blocks: [], mode: 'none' };
  }

  /* ── CSS ── */
  var style = document.createElement('style');
  style.id = '__ns-block-selector-styles';
  style.textContent = [
    '.ns-block-selectable { cursor: pointer !important; position: relative; }',
    '.ns-block-hover { outline: 2px solid rgba(99,102,241,0.7); outline-offset: -2px; }',
    '.ns-block-hover[data-ns-zone] { outline-color: rgba(20,184,166,0.7); }',
    '.ns-block-label {',
    '  position: absolute; top: 6px; right: 6px; z-index: 99999;',
    '  background: rgba(99,102,241,0.9); color: #fff;',
    '  font-size: 10px; font-family: ui-monospace, monospace;',
    '  padding: 2px 6px; border-radius: 4px; pointer-events: none;',
    '  line-height: 1.4; font-weight: 500; letter-spacing: 0.02em;',
    '}',
    '.ns-block-label.ns-dashboard-label { background: rgba(20,184,166,0.9); }',
  ].join('\\n');
  document.head.appendChild(style);

  /* ── Mark blocks as selectable ── */
  function markBlocks() {
    var result = getBlockElements();
    result.blocks.forEach(function(el) {
      el.classList.add('ns-block-selectable');
      /* Ensure positioned for absolute label */
      var pos = window.getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';
    });
    return result;
  }
  var detected = markBlocks();

  /* ── Helpers ── */
  function closestBlock(el) {
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('ns-block-selectable')) return el;
      el = el.parentElement;
    }
    return null;
  }

  var lastHovered = null;
  var activeLabel = null;

  function removeLabel() {
    if (activeLabel && activeLabel.parentNode) activeLabel.parentNode.removeChild(activeLabel);
    activeLabel = null;
  }

  function onMouseOver(e) {
    var block = closestBlock(e.target);
    if (block === lastHovered) return;
    if (lastHovered) { lastHovered.classList.remove('ns-block-hover'); removeLabel(); }
    lastHovered = block;
    if (block) {
      block.classList.add('ns-block-hover');
      /* Show label */
      var info = getBlockElements();
      var idx = info.blocks.indexOf(block);
      var slug;
      if (info.mode === 'dashboard') {
        var zone = block.getAttribute('data-ns-zone');
        var entity = block.getAttribute('data-ns-entity');
        slug = entity ? zone + ': ' + entity : zone;
      } else {
        slug = block.getAttribute('data-block-slug') || 'block ' + idx;
      }
      var label = document.createElement('span');
      label.className = 'ns-block-label' + (info.mode === 'dashboard' ? ' ns-dashboard-label' : '');
      label.textContent = slug;
      block.appendChild(label);
      activeLabel = label;
    }
  }

  function onMouseOut(e) {
    if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
      if (lastHovered) { lastHovered.classList.remove('ns-block-hover'); removeLabel(); lastHovered = null; }
    }
  }

  function onClick(e) {
    var block = closestBlock(e.target);
    if (!block) return;
    e.preventDefault();
    e.stopPropagation();

    var info = getBlockElements();
    var blockIndex = info.blocks.indexOf(block);

    if (info.mode === 'dashboard') {
      /* Remove injected label before reading text content */
      removeLabel();
      window.parent.postMessage({
        type: 'nextspark:dashboard-selected',
        zone: block.getAttribute('data-ns-zone'),
        entitySlug: block.getAttribute('data-ns-entity') || null,
        label: block.textContent.trim().substring(0, 50),
      }, '*');
    } else {
      var slug = block.getAttribute('data-block-slug') || '';
      window.parent.postMessage({
        type: 'nextspark:block-selected',
        blockSlug: slug,
        blockIndex: blockIndex,
      }, '*');
    }

    block.classList.remove('ns-block-hover');
    removeLabel();
    if (lastHovered === block) lastHovered = null;
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);

  /* ── Cleanup hook ── */
  window.__nsBlockSelectorCleanup = function() {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    var s = document.getElementById('__ns-block-selector-styles');
    if (s) s.remove();
    removeLabel();
    document.querySelectorAll('.ns-block-hover').forEach(function(el) {
      el.classList.remove('ns-block-hover');
    });
    document.querySelectorAll('.ns-block-selectable').forEach(function(el) {
      el.classList.remove('ns-block-selectable');
    });
    delete window.__nsBlockSelectorActive;
    delete window.__nsBlockSelectorCleanup;
  };
})();
`
}
