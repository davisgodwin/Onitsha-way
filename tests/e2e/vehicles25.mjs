import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
let dev;
try {
  await fetch("http://127.0.0.1:4240");
} catch {
  dev = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4240"],
    { stdio: "ignore" },
  );
  await new Promise((r) => setTimeout(r, 2000));
}
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [];
p.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGEERROR", e.message);
});
p.setDefaultTimeout(120000);
fs.mkdirSync("qa/v25", { recursive: true });
try {
  await p.addInitScript(() =>
    localStorage.setItem(
      "onitshaway:settings",
      JSON.stringify({
        quality: "low",
        liveWeather: false,
        clockFixVersion: 1,
      }),
    ),
  );
  await p.goto("http://127.0.0.1:4240/?quickstart");
  await p.waitForFunction(() => window.__game?.state === "playing", null, {
    timeout: 240000,
  });
  const report = await p.evaluate(async () => {
    const g = __game;
    g.renderer.renderer.setAnimationLoop(null);
    history.replaceState(null, "", "/");
    g.touch = true;
    g.economy.transact({
      key: "qa25:funds",
      amount: 99999999,
      reason: "Test fixture",
    });
    const { VEHICLE_CATALOGUE, VEHICLE_LOTS } =
      await import("/src/data/VehicleCatalogue.js");
    window.__catalog25 = VEHICLE_CATALOGUE;
    const T = await import("/node_modules/.vite/deps/three.js");
    window.__T25 = T;
    const { TYPES, SEATS } = await import("/src/sim/TrafficSystem.js");
    const models = VEHICLE_CATALOGUE.map((M) => {
      const m = g.vehicles.makeMesh(M.id, "#9fbdc4");
      m.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(m);
      let triangles = 0,
        draws = 0;
      m.traverse((o) => {
        if (o.isMesh) {
          triangles +=
            (o.geometry.index?.count ?? o.geometry.attributes.position.count) /
            3;
          draws++;
        }
      });
      return {
        id: M.id,
        finite: [...bb.min.toArray(), ...bb.max.toArray()].every(
          Number.isFinite,
        ),
        draws,
        triangles,
        width: bb.max.x - bb.min.x,
        length: bb.max.z - bb.min.z,
        seats: !!SEATS[M.id]?.driver,
        physics: !!TYPES[M.id],
      };
    });
    const lots = g.vehicles.dealerships.map((l) => {
      let offRoad = true;
      for (let x = -16; x <= 16; x += 2)
        for (let z = -12; z <= 12; z += 2) {
          const q = l.at(x, z);
          if (
            g.world.map.onCarriageway(q.x, q.z, 0.5) ||
            g.world.terrain.isWater(q.x, q.z)
          )
            offRoad = false;
        }
      let access = true;
      for (let z = -15; z <= -6; z += 1) {
        const q = l.at(0, z);
        if (!g.world.collision.isFree(q.x, q.z, 1.1)) access = false;
      }
      return {
        id: l.id,
        offRoad,
        access,
        deskClear: g.world.collision.isFree(l.desk.x, l.desk.z, 0.4),
        bayClear: g.world.collision.isFree(l.delivery.x, l.delivery.z, 2.2),
        suppliedDealer: !!l.group.userData.dealer.suppliedModel,
      };
    });
    const roadCars = g.world.props.parked.filter((c) =>
      g.world.map.nearestRoad(c.x, c.z, { maxDist: 12 }),
    ).length;
    const NPCs = g.saveData.world.npcVehicleOwners;
    g.updatePlaces();
    // v0.30.1 gave the six dealerships local names, so count dealership pins by kind rather than a "Car stand:" prefix
    const pins = g.minimap.places.filter((p) => p.kind === "car").length;
    for (let i = 0; i < 120; i++)
      g.traffic.spawn(g.spawn.x, g.spawn.z, 12, g.traffic.vehicles);
    // v0.29 police patrol cars carry a 'police-patrol:*' owner id; only resident-owned cars must match a garage
    // v0.39 ambulances are service vehicles too ('ambulance:*'), not resident cars
    const owners = g.traffic.vehicles.filter((v) => v.ownerId && !v.police && !v.ambulance);
    return {
      models,
      lots,
      stock: g.vehicles.spots.length,
      pins,
      npcGarages: NPCs.length,
      npcModels: new Set(NPCs.map((o) => o.model)).size,
      owners: owners.length,
      ownersValid: owners.every((v) =>
        NPCs.some((n) => n.id === v.ownerId && n.model === v.model),
      ),
      templates: g.traffic.occupants.templates.map((t) => ({
        supplied: t.suppliedModel,
        parts: t.parts.length,
        triangles: t.parts.reduce((s, p) => s + p.geometry.index.count / 3, 0),
      })),
      roadCars,
      recovered: window.__onitshaErrors ?? [],
    };
  });
  console.log("STRUCTURE", JSON.stringify(report));
  assert.equal(report.stock, 278); // v0.49: 228 at the lots and stands, 23 at Prestige Autos, 16 at Unity Motors, 11 at Executive Motors
  assert.equal(report.pins, 6);
  assert.equal(report.npcModels, 54);
  assert.ok(report.owners > 0 && report.ownersValid);
  assert.ok(report.models.every((m) => m.finite && m.seats && m.physics));
  assert.ok(
    report.lots.every(
      (l) =>
        l.offRoad && l.access && l.deskClear && l.bayClear && l.suppliedDealer,
    ),
  );
  assert.ok(report.templates.every((t) => t.supplied));
  // Real sales-desk interaction and payment, then drive a catalogue vehicle.
  await p.evaluate(() => {
    const g = __game,
      l = g.vehicles.dealerships[0];
    g.player.teleport(l.desk.x, l.desk.z);
    g.player.syncModel();
    g.interactions.update(l.desk.x, l.desk.z);
    g.interactions.trigger();
  });
  await p.getByRole("button", { name: /Toyota Corolla/ }).click();
  const before = await p.evaluate(() => __game.economy.balance);
  await p.getByRole("button", { name: /Buy it —/ }).click();
  report.purchase = await p.evaluate((before) => {
    const g = __game,
      v = g.vehicles.sys.list.find((v) => v.model === "toyota_corolla");
    return {
      exists: !!v,
      paid: before - g.economy.balance,
      rendered: g.vehicles.meshes.has(v?.id),
    };
  }, before);
  assert.ok(report.purchase.exists && report.purchase.rendered);
  assert.equal(report.purchase.paid, 95000);
  await p.evaluate(() => {
    const g = __game,
      v = g.vehicles.sys.list.find((v) => v.model === "toyota_corolla");
    g.vehicles._doorReady = true;
    g.vehicles.startDriving(v);
    g.vehicles._doorReady = false;
    g.vehicles.update(0.03, g.input);
  });
  assert.equal(await p.evaluate(() => __game.player.state), "driver");
  await p.evaluate(() => __game.vehicles.stopDriving({ silent: true }));
  // All vehicle classes enter the real controller, sit and exit safely; remove temporary QA cars.
  report.driving = await p.evaluate(() => {
    const g = __game,
      res = [];
    for (const M of __catalog25) {
      const l = g.vehicles.dealerships[0],
        v = {
          id: "qa-drive:" + M.id,
          model: M.id,
          x: l.delivery.x,
          z: l.delivery.z,
          heading: 0,
          paint: "#b5ced2",
          fuel: M.tank / 2,
          odo: 0,
          damage: 0,
        };
      g.vehicles.sys.list.push(v);
      g.vehicles.addOwned(v);
      g.vehicles._doorReady = true;
      g.vehicles.startDriving(v);
      g.vehicles._doorReady = false;
      g.vehicles.update(0.01, g.input);
      res.push({
        id: M.id,
        driver: g.player.state === "driver",
        finite: g.player.position.toArray().every(Number.isFinite),
      });
      g.vehicles.stopDriving({ silent: true });
      g.vehicles.removeOwned(v);
      g.vehicles.sys.list.splice(g.vehicles.sys.list.indexOf(v), 1);
    }
    return res;
  });
  assert.ok(report.driving.every((v) => v.driver && v.finite));
  await p.evaluate(() => {
    const g = __game;
    g.openChoice(() => g.vehicles.dealerView(g.vehicles.dealerships[5]));
  });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: "qa/v25/dealer-mobile.png" });
  report.mobileFits = await p.evaluate(
    () => document.documentElement.scrollWidth <= innerWidth,
  );
  assert.ok(report.mobileFits);
  await p.evaluate(() => __game.closeChoice());
  await p.setViewportSize({ width: 1280, height: 800 });
  // Save, reload and Continue must retain the car, wallet, owner garages and haircut.
  const saved = await p.evaluate(() => {
    __game.saveGameNow();
    return {
      balance: __game.economy.balance,
      owners: __game.saveData.world.npcVehicleOwners,
      appearance: __game.player.appearance,
    };
  });
  await p.reload();
  await p.waitForFunction(
    () =>
      window.__game?.state === "menu" ||
      document.body.innerText.includes("Open previous offline save"),
    null,
    { timeout: 240000 },
  );
  p.on("dialog", (d) => d.accept());
  const prev = p.getByRole("button", { name: /Open previous offline save/ });
  if (await prev.isVisible()) await prev.click();
  await p.locator("#screen-menu [data-action=continue]").click();
  await p.waitForFunction(() => window.__game.state === "playing", null, {
    timeout: 240000,
  });
  report.saved = await p.evaluate((saved) => {
    const g = __game;
    g.renderer.renderer.setAnimationLoop(null);
    g.touch = true;
    return {
      balance: g.economy.balance === saved.balance,
      car: g.saveData.vehicles.some((v) => v.model === "toyota_corolla"),
      owners:
        JSON.stringify(g.saveData.world.npcVehicleOwners) ===
        JSON.stringify(saved.owners),
      hair: g.player.appearance.hair === saved.appearance.hair,
    };
  }, saved);
  assert.ok(Object.values(report.saved).every(Boolean));
  await p.addStyleTag({
    content:
      "#app > :not(#viewport){visibility:hidden!important;} #viewport,#viewport *{visibility:visible!important;}",
  });
  // Render each physical stand in its actual city location.
  for (let i = 0; i < 6; i++) {
    await p.evaluate(async (i) => {
      const g = __game,
        r = g.renderer,
        l = g.vehicles.dealerships[i];
      await g.world.warmUp(l.x, l.z);
      for (const d of g.vehicles.dealerships) d.group.visible = true;
      r.scene.fog = null;
      r.hemi.intensity = 1.7;
      r.sun.intensity = 2.8;
      r.sun.position.set(l.x + 40, 90, l.z - 40);
      const cam = l.at(30, -39);
      r.camera.far = 450;
      r.camera.updateProjectionMatrix();
      r.camera.position.set(cam.x, 25, cam.z);
      r.camera.lookAt(l.x, 1.5, l.z);
      r.sky.position.copy(r.camera.position);
      r.renderer.render(r.scene, r.camera);
    }, i);
    await p
      .locator("#game-canvas")
      .screenshot({ path: `qa/v25/stand-${i + 1}.png` });
  }
  // Six showroom families: every catalogue model rendered once.
  for (let family = 0; family < 6; family++) {
    await p.evaluate(async (family) => {
      const g = __game,
        T = await import("/node_modules/.vite/deps/three.js"),
        { VEHICLE_LOTS } = await import("/src/data/VehicleCatalogue.js");
      const scene = new T.Scene();
      scene.background = new T.Color("#e4eae6");
      scene.add(new T.HemisphereLight("#ffffff", "#86948b", 2));
      const sun = new T.DirectionalLight("#fff6e4", 3);
      sun.position.set(10, 20, 15);
      scene.add(sun);
      const floor = new T.Mesh(
        new T.PlaneGeometry(100, 100),
        new T.MeshStandardMaterial({ color: "#cdd3cc" }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.03;
      scene.add(floor);
      for (const [i, id] of VEHICLE_LOTS[family].models.entries()) {
        const m = g.vehicles.makeMesh(
          id,
          ["#accbd0", "#ced1d0", "#af7766", "#d1c4a3", "#46636e", "#b8bea8"][i],
        );
        m.position.set(((i % 3) - 1) * 7, 0, i < 3 ? -5 : 5);
        scene.add(m);
      }
      scene.updateMatrixWorld(true);
      const camera = new T.PerspectiveCamera(40, 1280 / 800, 0.01, 200);
      camera.position.set(19, 17, 27);
      camera.lookAt(0, 0.7, 0);
      g.renderer.renderer.render(scene, camera);
      window.__showroom25 = { scene, camera };
    }, family);
    await p
      .locator("#game-canvas")
      .screenshot({ path: `qa/v25/family-${family + 1}.png` });
  }
  for (const mode of ["keke", "minibus", "cbus", "bus", "motorcycle"]) {
    await p.evaluate(async (mode) => {
      const g = __game,
        T = await import("/node_modules/.vite/deps/three.js"),
        { SEATS } = await import("/src/sim/TrafficSystem.js"),
        { SeatedOccupants } = await import("/src/vehicles/SeatedOccupants.js");
      const id = {
        keke: "keke",
        minibus: "commercial_minibus",
        cbus: "mercedes_sprinter",
        bus: "toyota_coaster",
        motorcycle: "motorcycle",
      }[mode];
      const scene = new T.Scene();
      scene.background = new T.Color("#e1e9e5");
      scene.add(new T.HemisphereLight("#fff", "#8d9588", 2.1));
      const light = new T.DirectionalLight("#fff4dc", 3);
      light.position.set(5, 9, 6);
      scene.add(light);
      const model = g.vehicles.makeMesh(id, "#d3cdbc");
      scene.add(model);
      const occupants = new SeatedOccupants(scene, 10);
      occupants.begin();
      const mat = new T.Matrix4();
      const S = SEATS[id];
      occupants.add(mat, S.driver, 0, { bike: mode === "motorcycle" });
      S.pax
        .slice(0, mode === "keke" ? 2 : 4)
        .forEach((s, i) => occupants.add(mat, s, i + 1));
      occupants.end();
      const cam = new T.PerspectiveCamera(35, 1280 / 800, 0.01, 150);
      const scale =
        mode === "bus" ? 1.6 : mode === "cbus" || mode === "minibus" ? 1.3 : 1;
      cam.position.set(-4.5 * scale, 2.1 * scale, 4.6 * scale);
      cam.lookAt(0, 1, 0);
      g.renderer.renderer.render(scene, cam);
    }, mode);
    await p
      .locator("#game-canvas")
      .screenshot({ path: `qa/v25/occupants-${mode}.png` });
  }
  report.errors = errors;
  report.recovered = await p.evaluate(() => window.__onitshaErrors ?? []);
  fs.writeFileSync(
    "qa/v25/vehicles-audit.json",
    JSON.stringify(report, null, 2),
  );
  assert.equal(errors.length, 0);
  assert.equal(report.recovered.length, 0);
  console.log(
    "PASS vehicles25",
    JSON.stringify({
      models: report.models.length,
      lots: report.lots.length,
      purchase: report.purchase,
      saved: report.saved,
    }),
  );
} catch (e) {
  console.error(e);
  console.error(
    await p
      .evaluate(() => ({
        state: window.__game?.state,
        error: window.__onitshaErrors,
        choice: document.querySelector("#screen-choice")?.innerText,
      }))
      .catch(() => null),
  );
  await p.screenshot({ path: "qa/v25/failed.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
  dev?.kill();
}
