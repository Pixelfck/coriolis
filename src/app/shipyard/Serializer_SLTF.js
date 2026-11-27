
import { getLanguage } from '../i18n/Language';


const CRLN = '\r\n';
const translate = getLanguage('en').translate;

function sanitizeUtf8(string) {
  if (typeof string !== 'string') return '';

  let result = '';

  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);

    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = string.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += string.slice(i, i + 2);
        i++; // Keep the valid surrogate pair.
      }
      // Otherwise skip the unpaired high surrogate.
    } else if (code < 0xDC00 || code > 0xDFFF) {
      result += string[i]; // Keep ordinary characters; skip unpaired lows.
    }
  }

  return result;
}

function escape(string, charactersToEscape) {
  let result = '';

  for (const character of string) {
    if (charactersToEscape.includes(character)) {
      result += '\\';
    }
    result += character;
  }

  return result;
}

function unescape(string, charactersToUnescape) {
  let result = '';
  let escaped = false;

  for (const character of string) {
    if (escaped) {
      if (charactersToUnescape.includes(character)) {
        result += character;
      } else {
        result += '\\';
        result += character;
      }
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else {
      result += character;
    }
  }

  if (escaped) { // Preserve any trailing backslash that wasn't escaping anything.
    result += '\\';
  }

  return result;
}

function capitalize(string) {
  if (!string) return '';
  return string.replace(/\b[a-z]/gi, letter => letter.toUpperCase());
}

function getModuleString(module, isWeapon = false) {
  if (module === null || module.getInfo()) return '-';

  const moduleName = capitalize(translate(module.name || module.grp)); // TODO: see if we can update coriolis-data to make this cleaner
  const size = module.grp === 'bh' ? '' : module.class;    // TODO: see if we can add the bulkhead module into coriolis-data, and eliminate this exception
  const rating = module.grp === 'bh' ? '' : module.rating; // TODO: see if we can add the bulkhead module into coriolis-data, and eliminate this exception
  const modifications = getModuleModificationsString(module);
  const mounting = isWeapon ? ' (' + getWeaponMounting(module) + ')': '';

  return (size + rating + ' ' + escape(moduleName + mounting, '<>') + ' ' + modifications).trim();
}

function getWeaponMounting(module) {
  switch (module.mount) {
    case 'F':
      return 'Fixed'
    case 'G':
      return 'Gimballed'
    case 'T':
      return 'Turreted'
    default:
      return ''; // TODO: should we throw an Exception?
  }
}

function getModuleStrings(slots, type) {
  const isWeapon = (type === 'weapon');
  return slots.map(slot => getSlotType(slot, type) + ' | ' + getModuleString(slot.m, isWeapon));
}

function getSlotType(slot, type) {
  switch (type) {
    case 'optional':
      return 'S' + slot.maxClass;
    case 'weapon':
      return ['U', 'S', 'M', 'L', 'H'][slot.maxClass];
    case 'utility':
      return 'U';
    default:
      throw('Unknown value for type parameter');
  }
}

function getModuleModificationsString(module) {
  if (module.preEngineered) {
    return '<Pre-engineered>';
  }

  if (module.blueprint && module.blueprint.grade) {
    const blueprint = escape(module.blueprint.name, '<>') + ' G' + module.blueprint.grade;
    const experimentalEffect = module.blueprint.special ? ' + ' + module.blueprint.special.name : '';

    return '<' + blueprint + experimentalEffect + '>';
  }

  return '';
}

function getCoreModules(ship) {
  const core = [];
  core.push('ARM | ' + getModuleString(ship.bulkheads.m));
  core.push('PP  | ' + getModuleString(ship.standard[0].m));
  core.push('THR | ' + getModuleString(ship.standard[1].m));
  core.push('FSD | ' + getModuleString(ship.standard[2].m));
  core.push('LS  | ' + getModuleString(ship.standard[3].m));
  core.push('PD  | ' + getModuleString(ship.standard[4].m));
  core.push('SEN | ' + getModuleString(ship.standard[5].m));
  core.push('FT  | ' + getModuleString(ship.standard[6].m));
  return core;
}
function getOptionalModules(ship) {
  const modules = ship.internal;

  return getModuleStrings(modules, 'optional');
}
function getWeaponModules(ship) {
  const modules = ship.hardpoints.filter(item => item.isUtilityMount === false);

  return getModuleStrings(modules, 'weapon');
}
function getUtilityModules(ship) {
  const modules = ship.hardpoints.filter(item => item.isUtilityMount === true);

  return getModuleStrings(modules, 'utility');
}

// TODO: build a SLEF -> SLTF (and inverse) function

export function toSLTF(shipName, ship) {

  console.log(ship);

  const sltf = [];

  sltf.push('SLTF/1.0');
  sltf.push('Ship | ' + escape(ship.name, '<>') + ' <' + escape(sanitizeUtf8(shipName), '<>') + '>');
  sltf.push('');
  sltf.push('[Core]');
  sltf.push(...getCoreModules(ship));
  sltf.push('');
  sltf.push('[Optional]');
  sltf.push(...getOptionalModules(ship));
  sltf.push('');
  sltf.push('[Hardpoints]');
  sltf.push(...getWeaponModules(ship));
  sltf.push('');
  sltf.push('[Utility]');
  sltf.push(...getUtilityModules(ship));
  sltf.push(''); // trailing newline

  return sltf.join(CRLN);
}
