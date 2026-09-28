// One visual vocabulary across discovery surfaces. Project previews stay live UI.
const covers = {
  knowledge: ['knowledge', 'Reference handbook with a marked source passage'],
  triage: ['triage', 'Message cards sorted into three correspondence trays'],
  insight: ['insight', 'Plotting sheets and physical bars revealing a data pattern'],
};
export function catalogArt(kind = 'knowledge') {
  const [name, alt] = covers[kind] || covers.knowledge;
  return `<img class="catalog-art" src="assets/${name}-cover.webp" alt="${alt}" width="900" height="600" loading="lazy" decoding="async">`;
}
