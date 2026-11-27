

import { shipModelFromJson } from "./CompanionApiUtils";
import { shipFromLoadoutJSON } from "./JournalUtils";
import { Ships } from 'coriolis-data/dist';

/**
 * Import SLEF formatted builds. Sets state to a map of the builds on success
 * and flags if there was only a single build.
 *
 * @param  {string} importData - Array of the list of builds.
 * @throws {string} If parse / import fails
 */
export function shipFromInaraSlef(importData) {
  const builds = importData.reduce((memo, { data }) => {
    const shipModel = shipModelFromJson(data);
    const ship = shipFromLoadoutJSON(data);
    const shipTemplate = Ships[shipModel];
    const shipName = data.ShipName || shipTemplate.properties.name;

    const key = `Imported ${shipName}`;
    memo[shipModel] = {};
    memo[shipModel][key] = ship.toString();

    return memo;
  }, {});

  return {
    builds,
    singleBuild: (Object.keys(builds).length === 1),
    importValid: true,
  };
}

