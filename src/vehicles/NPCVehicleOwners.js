import { VEHICLE_CATALOGUE } from "../data/VehicleCatalogue.js";
const COLORS = ["#c4cbd0", "#24343c", "#8d3435", "#e5dfd1", "#476b70"];
/** Stable fictional resident garages. Owners/model/paint persist; ambient journeys do not need saving. */
export function ensureNPCVehicleOwners(world) {
  world.npcVehicleOwners ??= [];
  const owners = world.npcVehicleOwners;
  for (const [i, M] of VEHICLE_CATALOGUE.entries())
    for (let n = 0; n < 2; n++) {
      const id = `resident-motorist:${M.id}:${n}`;
      if (!owners.some((o) => o.id === id))
        owners.push({
          id,
          model: M.id,
          paint: COLORS[(i + n) % COLORS.length],
        });
    }
  return owners;
}
