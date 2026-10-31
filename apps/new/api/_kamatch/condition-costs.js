// Shared default selections mean the provider's reviewed basic configuration,
// not another provider's product or accessory price.
export function kamatchExtraOptions(costs, baselines) {
  const defaultSelection = {
    deliveryFee: costs.basis?.delivery === 'LAUNCH_REGION:수도권',
    tintFee: costs.basis?.tint === 'COMPAT_FIXED:루마 일반',
    dashcamFee: costs.basis?.dashcam === 'COMPAT_FIXED:파인뷰 SF500',
  };
  return ['deliveryFee','tintFee','dashcamFee'].map(key => ({
    amount: defaultSelection[key] ? baselines[key] : costs[key],
    baseline: baselines[key],
    removed: !defaultSelection[key] && costs[key] === 0,
  }));
}
