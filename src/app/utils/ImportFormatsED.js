
import {shipFromJson, shipModelFromJson} from "./CompanionApiUtils";
import { Ships } from 'coriolis-data/dist';
import { shipFromLoadoutJSON } from './JournalUtils';


/**
 * Import a build direct from the Companion API
 * @param  {string} build JSON from the Companion API information
 * @throws {string} if parse/import fails
 */
export function shipFromEdCompanionApi(importData) {
  const shipModel = shipModelFromJson(importData);
  const ship = shipFromJson(importData);

  let builds = {};
  builds[shipModel] = {};
  builds[shipModel]['Imported ' + Ships[shipModel].properties.name] = ship.toString();

  return { builds, importValid: true, singleBuild: true };
}


/**
 * Import a Loadout event from Elite: Dangerous journal files
 * @param  {Object} importData Loadout event
 * @throws {string} If import fails
 */
export function shipFromEdGameEngineJournalFileLoadoutEvent(importData) {
  if (!(importData && importData.Ship && importData.Modules)) {
    throw 'Loadout event must contain Ship and Modules';
  }

  // Build the ship here, exactly as a single SLEF build is imported (a SLEF
  // `importData` object IS a journal Loadout event). This used to gzip the event
  // into a /import?importData= URL instead, which broke with pako 2 (deflate no
  // longer supports { to: 'string' }) and could exceed browser URL limits
  // for large ships.
  const shipModel = shipModelFromJson(importData);
  if (!shipModel || !Ships[shipModel]) {
    throw 'No such ship found: "' + importData.Ship + '"';
  }

  let ship;
  try {
    ship = shipFromLoadoutJSON(importData);
  } catch (e) {
    throw Ships[shipModel].properties.name + ' loadout could not be imported: ' + (typeof e == 'string' ? e : e.message);
  }

  const shipName = importData.ShipName || Ships[shipModel].properties.name;
  const builds = { [shipModel]: { [`Imported ${shipName}`]: ship.toString() } };

  return {
    builds,
    singleBuild: true,
    importValid: true,
  };
}
