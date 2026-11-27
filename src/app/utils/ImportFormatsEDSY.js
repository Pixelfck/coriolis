
import { Ships } from 'coriolis-data/dist';
import { ModuleNameToGroup } from '../shipyard/Constants';
import Ship from "../shipyard/Ship";
import * as ModuleUtils from "../shipyard/ModuleUtils";


const textBuildRegex = new RegExp('^\\[([\\w \\-]+)\\]( \\[([+\\d]+)\\])?\r?\n');
const lineRegex = new RegExp('^([\\dA-Z]{1,2}): (\\d)([A-I])[/]?([FGT])?([SD])? ([\\w\\- ]+)');
const mountMap = { 'H': 4, 'L': 3, 'M': 2, 'S': 1, 'U': 0 };
const standardMap = { 'RB': 0, 'TM': 1, 'FH': 2, 'EC': 3, 'PC': 4, 'SS': 5, 'FS': 6 };
const bhMap = { 'lightweight alloy': 0, 'reinforced alloy': 1, 'military grade composite': 2, 'mirrored surface composite': 3, 'reactive surface composite': 4 };

/**
 * Check is slot is empty
 * @param  {Object}  slot Slot model
 * @return {Boolean}      True if empty
 */
function isEmptySlot(slot) {
  return slot.maxClass == this && slot.m === null;
}

/**
 * Test if importString matches EDSY (Elite: Dangerous Shipyard) text format signature
 * @param importString
 * @returns {boolean}
 */
export function isEdsyTextFormat(importString) {
  return textBuildRegex.test(importString); // EDSY build text
}

/**
 * Import a text build from ED Shipyard
 * @param  {string} buildStr Build string
 * @throws {string} If parse / import fails
 */
export function shipFromEdsyText(buildStr) {
  let buildName = textBuildRegex.exec(buildStr)[1].trim();
  let shipName = buildName.toLowerCase();
  let shipId = null;

  for (let sId in Ships) {
    if (Ships[sId].properties.name.toLowerCase() == shipName) {
      shipId = sId;
      break;
    }
  }

  if (!shipId) {
    throw 'No such ship found: "' + buildName + '"';
  }

  let lines = buildStr.split('\n');
  let ship = new Ship(shipId, Ships[shipId].properties, Ships[shipId].slots);
  ship.buildWith(null);

  for (let i = 1; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) { continue; }
    if (line.substring(0, 3) == '---') { break; }

    let parts = lineRegex.exec(line);

    if (!parts) { throw 'Error parsing: "' + line + '"'; }

    let typeSize = parts[1];
    let cl = parts[2];
    let rating = parts[3];
    let mount = parts[4];
    let missile = parts[5];
    let name = parts[6].trim();
    let slot, group;

    if (isNaN(typeSize)) {  // Standard or Hardpoint
      if (typeSize.length == 1) { // Hardpoint
        let slotClass = mountMap[typeSize];

        if (cl > slotClass) { throw cl + rating + ' ' + name + ' exceeds slot size: "' + line + '"'; }

        slot = ship.hardpoints.find(isEmptySlot, slotClass);

        if (!slot) { throw 'No hardpoint slot available for: "' + line + '"'; }

        group = ModuleNameToGroup[name.toLowerCase()];

        let hp = ModuleUtils.findHardpoint(group, cl, rating, group ? null : name, mount, missile);

        if (!hp) { throw 'Unknown component: "' + line + '"'; }

        ship.use(slot, hp, true);
      } else if (typeSize == 'BH') {
        let bhId = bhMap[name.toLowerCase()];

        if (bhId === undefined) { throw 'Unknown bulkhead: "' + line + '"'; }

        ship.useBulkhead(bhId, true);
      } else if (standardMap[typeSize] != undefined) {
        let standardIndex = standardMap[typeSize];

        if (ship.standard[standardIndex].maxClass < cl) { throw name + ' exceeds max class for the ' + ship.name; }

        ship.use(ship.standard[standardIndex], ModuleUtils.standard(standardIndex, cl + rating), true);
      } else {
        throw 'Unknown component: "' + line + '"';
      }
    } else {
      if (cl > typeSize) { throw cl + rating + ' ' + name + ' exceeds slot size: "' + line + '"'; }

      slot = ship.internal.find(isEmptySlot, typeSize);

      if (!slot) { throw 'No internal slot available for: "' + line + '"'; }

      group = ModuleNameToGroup[name.toLowerCase()];

      let intComp = ModuleUtils.findInternal(group, cl, rating, group ? null : name);

      if (!intComp) { throw 'Unknown component: "' + line + '"'; }

      ship.use(slot, intComp);
    }
  }

  // Never leave the Planetary Approach Suite slot empty on import
  ModuleUtils.fitDefaultPlanetaryApproachSuite(ship);

  let builds = {};
  builds[shipId] = {};
  builds[shipId]['Imported ' + buildName] = ship.toString();

  return {
    builds,
    singleBuild: true,
    importValid: true,
  };
}
