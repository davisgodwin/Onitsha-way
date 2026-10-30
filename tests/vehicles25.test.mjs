import "./helpers/loadModels24.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  VEHICLE_CATALOGUE,
  VEHICLE_LOTS,
} from "../src/data/VehicleCatalogue.js";
import { VEHICLE_MODELS } from "../src/data/housing.js";
import { variantGeometry } from "../src/vehicles/VehicleVariants.js";
import { VehicleSystem } from "../src/vehicles/VehicleSystem.js";
import { Economy } from "../src/economy/Economy.js";
import { Inventory } from "../src/economy/Inventory.js";
import { defaultSave, migrate } from "../src/save/SaveSystem.js";
import { ensureNPCVehicleOwners } from "../src/vehicles/NPCVehicleOwners.js";
test("the 36 requested vehicles (v0.48: plus 18 more, 54 in all), six stands and all entries stocked once", () => {
  assert.equal(VEHICLE_CATALOGUE.length, 54);
  assert.equal(new Set(VEHICLE_CATALOGUE.map((v) => v.id)).size, 54);
  assert.equal(VEHICLE_LOTS.length, 6);
  assert.equal(new Set(VEHICLE_LOTS.flatMap((l) => l.models)).size, 36);
  for (const l of VEHICLE_LOTS) assert.equal(l.models.length, 6);
});
for (const M of VEHICLE_CATALOGUE)
  test(
    M.label +
      ": model, purchase, duplicate guard, fuel, resale and saved ownership",
    () => {
      const g = variantGeometry(M.id);
      assert.ok(g.attributes.position.count > 50);
      assert.ok([...g.attributes.position.array].every(Number.isFinite));
      assert.ok(
        Math.abs(g.boundingBox.max.z - g.boundingBox.min.z - M.len) < 0.8,
      );
      const save = defaultSave({ name: "Obi", gender: "male" });
      save.wallet.balance = 5000000;
      const e = new Economy(save.wallet),
        sys = new VehicleSystem((save.vehicles ??= []), save.world, {
          economy: e,
          inventory: new Inventory(save.inventory),
          spots: [
            {
              id: M.id,
              model: M.id,
              label: M.label,
              price: M.price,
              x: 100,
              z: 100,
              heading: 0,
              lotName: "Test",
              paint: "#ccc",
            },
          ],
        });
      const b = e.balance,
        r = sys.buy(M.id);
      assert.ok(r.ok);
      assert.equal(e.balance, b - M.price);
      assert.equal(sys.buy(M.id).error, "sold");
      assert.equal(r.vehicle.fuel, M.tank / 2);
      assert.equal(
        migrate(JSON.parse(JSON.stringify(save))).vehicles[0].model,
        M.id,
      );
      assert.ok(sys.burn(r.vehicle, 100));
      assert.ok(sys.sell(r.vehicle.id, VEHICLE_LOTS[0]).ok);
      assert.equal(sys.sell(r.vehicle.id, VEHICLE_LOTS[0]).ok, false);
    },
  );
test("insufficient funds and blocked collection never take money or mark stock sold", () => {
  for (const [balance, clear] of [
    [0, true],
    [99999999, false],
  ]) {
    const M = VEHICLE_CATALOGUE[0],
      e = new Economy({ balance }),
      w = {},
      v = [],
      s = new VehicleSystem(v, w, {
        economy: e,
        inventory: new Inventory({}),
        spots: [
          { id: "x", model: M.id, label: M.label, price: M.price, x: 0, z: 0 },
        ],
        canDeliver: () => clear,
      });
    assert.equal(s.buy("x").ok, false);
    assert.equal(e.balance, balance);
    assert.equal(v.length, 0);
    assert.equal(w.soldVehicles.length, 0);
  }
});
test("existing owned vehicle blocks shared bay without charging; moving it allows next purchase", () => {
  const e = new Economy({ balance: 9999999 }),
    v = [{ id: "old", model: "sedan", x: 0, z: 0 }],
    s = new VehicleSystem(
      v,
      {},
      {
        economy: e,
        inventory: new Inventory({}),
        spots: [
          {
            id: "x",
            model: "motorcycle",
            label: "Motorcycle",
            price: 18000,
            x: 0,
            z: 0,
          },
        ],
      },
    );
  const b = e.balance;
  assert.equal(s.buy("x").error, "delivery-blocked");
  assert.equal(e.balance, b);
  v[0].x = 30;
  assert.ok(s.buy("x").ok);
});
test("NPC garages persist all 54 models (v0.48) with stable IDs and paint", () => {
  const w = {},
    a = ensureNPCVehicleOwners(w),
    saved = JSON.stringify(a);
  assert.equal(new Set(a.map((o) => o.model)).size, 54);
  assert.equal(new Set(a.map((o) => o.id)).size, 108);
  ensureNPCVehicleOwners(w);
  assert.equal(JSON.stringify(w.npcVehicleOwners), saved);
  const clone = JSON.parse(JSON.stringify(w));
  ensureNPCVehicleOwners(clone);
  assert.deepEqual(clone, w);
});
test("all legacy model IDs remain valid in existing saves", () => {
  for (const id of [
    "sedan",
    "executive",
    "suv",
    "mercedes_c300",
    "mercedes_g63",
    "bmw_330i",
    "bmw_x5",
  ]) {
    const s = defaultSave({ name: "Ada", gender: "female" });
    s.vehicles = [
      { id: "old", model: id, x: 0, z: 0, fuel: 3, odo: 1, heading: 0 },
    ];
    assert.equal(migrate(s).vehicles[0].model, id);
    assert.ok(VEHICLE_MODELS[id]);
  }
});
