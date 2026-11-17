// View defaults apply before per-route overrides. Endpoint types differ:
// model relationships use target ports; reference connectors use path fractions.
const fields = ['from', 'to', 'via', 'curve', 'label', 'path', 'icon', 'iconPosition', 'showIcon', 'showLabel', 'sharePath', 'color', 'width', 'dasharray'];
const geometryFields = ['from', 'to', 'via', 'curve'];
export function routingOptions(view, specific, reference = false) {
  const defaults = {...view.routeDefaults};
  if (reference) {
    delete defaults.sharePath;
    delete defaults.label;
    delete defaults.icon;
    delete defaults.iconPosition;
    delete defaults.showIcon;
    delete defaults.showLabel;
    if (typeof defaults.to !== 'number') delete defaults.to;
  } else if (typeof defaults.to === 'number') delete defaults.to;
  // A locally specified geometry replaces an inherited free-path fallback.
  if (specific && geometryFields.some(key => specific[key] !== undefined)) delete defaults.path;
  if (!specific && !fields.some(key => defaults[key] !== undefined)) return undefined;
  return {...defaults, ...specific};
}
