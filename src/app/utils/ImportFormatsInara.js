

import { shipModelFromJson } from "./CompanionApiUtils";
import { shipFromLoadoutJSON } from "./JournalUtils";
import { Ships } from 'coriolis-data/dist';

/**
 * Test if importJSON matches the Inara SLEF (Ship Loadout Exchange Format) JSON format signature
 * @param importJson the JSON Object to check for a signature match
 * @returns {boolean} true if importJSON matches the signature, false otherwise
 */
export function isSlefFormat(importJson) {
  return Boolean(importJson?.[0]?.header?.appName); // We assume only the SLEF format has this envelope data, so if it is present (see: https://inara.cz/elite/inara-impexp-slef/)
}

/**
 * Import SLEF formatted builds. Sets state to a map of the builds on success
 * and flags if there was only a single build.
 *
 * @param  {string} importData - Array of the list of builds.
 * @throws {string} If parse / import fails
 */
export function shipFromSlefFormat(importData) {
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

