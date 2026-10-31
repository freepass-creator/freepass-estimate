// Initial confirmed launch scope. Add Renault/KGM/Chevrolet as Kamatch quote
// coverage and model mappings are verified (docs/references/kamatch/INITIAL-LAUNCH-SCOPE.md).
// This filters selection surfaces without changing the master.
(() => {
  const manufacturerIds = Object.freeze(['hyundai', 'kia', 'genesis']);
  const manufacturerNames = Object.freeze(['현대', '기아', '제네시스']);
  const isManufacturerOpen = (manufacturer) => manufacturerIds.includes(manufacturer?.manufacturer_id) || manufacturerNames.includes(manufacturer?.manufacturer_name);
  globalThis.FreePassNewcarLaunch = Object.freeze({
    manufacturerIds,
    manufacturerNames,
    isManufacturerOpen,
    manufacturers: (items = []) => items.filter(isManufacturerOpen),
  });
})();
