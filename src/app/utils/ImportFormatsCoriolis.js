
import * as ModuleUtils from '../shipyard/ModuleUtils';
import { fromDetailedBuild } from "../shipyard/Serializer";
import Ship from "../shipyard/Ship";
import { Ships } from 'coriolis-data/dist';
import { Insurance } from '../shipyard/Constants';

/**
 * Convert a ship-loadout JSON object to a Coriolis build
 * @param  {Object} detailedBuild ship-loadout
 * @return {Object}               Coriolis build
 */
function detailedJsonToBuild(detailedBuild) {
  let ship;
  if (!detailedBuild.name) {
    throw 'Build Name missing!';
  }

  if (!detailedBuild.name.trim()) {
    throw 'Build Name must be a string at least 1 character long!';
  }

  try {
    ship = fromDetailedBuild(detailedBuild);
  } catch (e) {
    throw detailedBuild.ship + ' Build "' + detailedBuild.name + '": Invalid data';
  }

  // Never leave the Planetary Approach Suite slot empty on import
  ModuleUtils.fitDefaultPlanetaryApproachSuite(ship);

  return { shipId: ship.id, name: detailedBuild.name, code: ship.toString() };
}

/**
 * Test if importJSON matches our own Coriolis.io detailed export JSON format signature
 * @param importJson the JSON Object to check for a signature match
 * @returns {boolean} true if importJSON matches the signature, false otherwise
 */
export function isCoriolisDetailedExportFormat(importJson) {
  return Boolean(importJson instanceof Array); // Must be Coriolis detailed export json (i.e. an array of ships in https://coriolis.io/schemas/ship-loadout/5.json format)
}

/**
 * Test if importJSON matches our own Coriolis.io single ship export JSON format signature
 * @param importJson the JSON Object to check for a signature match
 * @returns {boolean} true if importJSON matches the signature, false otherwise
 */
export function isCoriolisSingleShipFormat(importJson) {
  return Boolean(importJson.ship && typeof importJson.name !== undefined); // Must be Coriolis single ship export json (i.e. a single ships in https://coriolis.io/schemas/ship-loadout/5.json format)
}

/**
 * Test if importJSON matches our own Coriolis.io full application backup JSON format signature
 * @param importJson the JSON Object to check for a signature match
 * @returns {boolean} true if importJSON matches the signature, false otherwise
 */
export function isCoriolisFullBackupFormat(importJson) { // Using Coriolis Backup JSON
  return Boolean(importJson.builds !== null && importJson.comparisons && importJson.insurance !== null && importJson.shipDiscount !== null && importJson.moduleDiscount !== null);
}

/**
 * Import an array of ship-loadout objects / builds
 * @param  {Array} importData  Array of ship-loadout JSON Schema builds
 */
export function shipFromCoriolisDetailedFormat(importData) {
  let builds = {};
  for (let i = 0, l = importData.length; i < l; i++) {
    let build = detailedJsonToBuild(importData[i]);
    if (!builds[build.shipId]) {
      builds[build.shipId] = {};
    }
    builds[build.shipId][build.name] = build.code;
  }
  return {
    builds,
    importValid: true,
  };
}

export function shipFromCoriolisSingleShipFormat(importData) {
  const detailedFormat = [importData]; // Detailed format is an array of single ship formatted objects
  const state = shipFromCoriolisDetailedFormat(detailedFormat);
  state.singleBuild = true;
  return state;
}

/**
 * Determine if a build is valid
 * @param  {string} shipId Ship ID
 * @param  {string} code   Serialzied ship build 'code'
 * @param  {string} name   Build name
 * @throws {string} If build is not valid
 */
function validateBuild(shipId, code, name) {
  let shipData = Ships[shipId];

  if (!shipData) {
    throw '"' + shipId + '" is not a valid Ship Id!';
  }
  if (typeof name != 'string' || name.length == 0) {
    throw shipData.properties.name + ' build "' + name + '" must be a string at least 1 character long!';
  }
  if (typeof code != 'string' || code.length < 10) {
    throw shipData.properties.name + ' build "' + name + '" is not valid!';
  }
  try {
    let ship = new Ship(shipId, shipData.properties, shipData.slots);
    ship.buildFrom(code);
  } catch (e) {
    throw shipData.properties.name + ' build "' + name + '" is not valid!';
  }
}


/**
 * Import a Coriolis backup
 * @param  {Object} importData Backup Data
 * @throws {string} If import fails
 */
export function backupFromCoriolisFullBackupFormat(importData) {
  const state = {};

  if (importData.builds && typeof importData.builds == 'object') {
    for (let shipId in importData.builds) {
      for (let buildName in importData.builds[shipId]) {
        try {
          validateBuild(shipId, importData.builds[shipId][buildName], buildName);
        } catch (err) {
          delete importData.builds[shipId][buildName];
        }
      }
    }
    state.builds = importData.builds;
  } else {
    throw 'builds must be an object!';
  }
  if (importData.comparisons) {
    for (let compName in importData.comparisons) {
      let comparison = importData.comparisons[compName];
      for (let i = 0, l = comparison.builds.length; i < l; i++) {
        let build = comparison.builds[i];
        if (!importData.builds[build.shipId] || !importData.builds[build.shipId][build.buildName]) {
          throw build.shipId + ' build "' + build.buildName + '" data is missing!';
        }
      }
    }
    state.comparisons = importData.comparisons;
  }
  // Check for old/deprecated discounts
  if (importData.discounts instanceof Array && importData.discounts.length == 2) {
    state.shipDiscount = importData.discounts[0];
    state.moduleDiscount = importData.discounts[1];
  }
  // Check for ship discount
  if (!isNaN(importData.shipDiscount)) {
    state.shipDiscount = importData.shipDiscount * 1;
  }
  // Check for module discount
  if (!isNaN(importData.moduleDiscount)) {
    state.moduleDiscount = importData.moduleDiscount * 1;
  }

  if (typeof importData.insurance == 'string') {
    let insurance = importData.insurance.toLowerCase();

    if (Insurance[insurance] !== undefined) {
      state.insurance = insurance;
    } else {
      throw 'Invalid insurance type: ' + insurance;
    }
  }
  state.importValid = true;

  return state;
}
