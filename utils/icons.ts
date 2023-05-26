import {
  findIconDefinition,
  IconPrefix,
  IconName,
} from '@fortawesome/fontawesome-svg-core';

export function generateIcon(iconName: IconName, prefix: IconPrefix = 'fad') {
  return findIconDefinition({
    prefix,
    iconName,
  });
}
