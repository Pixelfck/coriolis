

import {shipFromJson, shipModelFromJson} from "./CompanionApiUtils";
import { Ships } from 'coriolis-data/dist';


/**
 * Import a build direct from the Companion API
 * @param  {string} build JSON from the Companion API information
 * @throws {string} if parse/import fails
 */
export function shipFromCompanionApi(importData) {
  const shipModel = shipModelFromJson(importData);
  const ship = shipFromJson(importData);

  let builds = {};
  builds[shipModel] = {};
  builds[shipModel]['Imported ' + Ships[shipModel].properties.name] = ship.toString();

  return { builds, importValid: true, singleBuild: true };
}
