import fs from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
let devServer;
if (!process.env.TEST_URL) {
  try {
    await fetch("http://127.0.0.1:4240");
  } catch {
    devServer = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "4240",
        "--strictPort",
      ],
      { stdio: "ignore" },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://127.0.0.1:4240")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
fs.mkdirSync("qa/v241", { recursive: true });
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
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4240/?quickstart");
  await p.waitForFunction(() => window.__game?.state === "playing", null, {
    timeout: 240000,
  });
  const report = await p.evaluate(async () => {
    const g = __game;
    g.renderer.renderer.setAnimationLoop(null);
    const T = await import("/node_modules/.vite/deps/three.js");
    const H = await import("/src/characters/HumanRig.js");
    const W = await import("/src/characters/Wardrobe.js");
    window.__T = T;
    window.__H = H;
    window.__W = W;
    const rows = [];
    for (const gender of ["male", "female"])
      for (const look of W.OUTFITS[gender]) {
        const h = H.buildHuman({
          ...H.defaultAppearance(gender),
          outfit: look.id,
        });
        const oneSkeleton = h.meshes.every((m) => m.skeleton === h.skeleton);
        const poses = [];
        for (const [speed, grounded, seated] of [
          [0, true, false],
          [1.75, true, false],
          [5.4, true, false],
          [0, false, false],
          [0, true, true],
        ]) {
          for (let t = 0; t < 6; t++)
            h.animate(1 / 30, { speed, grounded, seated });
          h.group.updateMatrixWorld(true);
          h.skeleton.update();
          const b = new T.Box3().setFromObject(h.group, true);
          poses.push({
            speed,
            grounded,
            seated,
            height: b.max.y - b.min.y,
            span: b.max.x - b.min.x,
            finite: [...b.min.toArray(), ...b.max.toArray()].every(
              Number.isFinite,
            ),
          });
        }
        rows.push({
          gender,
          outfit: look.id,
          supplied: h.suppliedModel,
          source: h.sourceModel,
          meshes: h.meshes.length,
          oneSkeleton,
          poses,
        });
        h.dispose();
      }
    const hair = [];
    for (const gender of ["male", "female"])
      for (const style of H.HAIR_STYLES[gender]) {
        const h = H.buildHuman({
          ...H.defaultAppearance(gender),
          hair: style.id,
          outfit: gender === "male" ? "senator" : "ankara_gown",
        });
        hair.push({
          gender,
          hair: style.id,
          supplied: h.suppliedModel,
          materials: Object.keys(h.materials),
          meshCount: h.meshes.length,
        });
        h.dispose();
      }
    let detailed = 0,
      coarse = 0;
    for (const ch of g.world.city.chunks.values())
      if (ch.group) {
        detailed += [...(ch.importLOD?.sets.values() ?? [])].reduce(
          (a, l) => a + l.mesh.count,
          0,
        );
        coarse += ch.importLOD?.coarse.count ?? 0;
      }
    return {
      rows,
      hair,
      playerSupplied: g.player.human.suppliedModel,
      npcPool: g.npcs.pool.length,
      allNPCsSupplied: g.npcs.pool.every((n) => n.rig.suppliedModel),
      detailCounts: { detailed, coarse },
      runtimeErrors: window.__onitshaErrors ?? [],
    };
  });
  await p.addStyleTag({
    content:
      "#app > :not(#viewport){visibility:hidden!important}#viewport,#viewport *{visibility:visible!important}",
  });
  async function shot(kind) {
    return p.evaluate(async (kind) => {
      const T = __T,
        H = __H,
        W = __W,
        scene = new T.Scene();
      scene.background = new T.Color("#e5ebe8");
      scene.add(new T.HemisphereLight("#ffffff", "#89958a", 2));
      const sun = new T.DirectionalLight("#fff6e8", 2.6);
      sun.position.set(-3, 6, 5);
      scene.add(sun);
      const floor = new T.Mesh(
        new T.PlaneGeometry(200, 200),
        new T.MeshStandardMaterial({ color: "#cad1c7" }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.018;
      scene.add(floor);
      const camera = new T.PerspectiveCamera(32, 1280 / 800, 0.01, 100);
      const models = [];
      const add = (gender, outfit, hair, x, z = 0, pose = {}) => {
        const app = {
            ...H.defaultAppearance(gender),
            outfit,
            hair,
            palette: models.length % 7,
            color: [7, 3, 1, 0, 5, 2][models.length % 6],
          },
          h = H.buildHuman(app);
        h.animate(0.2, { speed: 0, grounded: true, ...pose });
        h.group.position.set(x, 0, z);
        scene.add(h.group);
        models.push(h);
        return h;
      };
      if (kind === "male-original-styles") {
        for (const [o, hair, x] of [
          ["ankara_jeans", "waves", -1.5],
          ["senator", "redcap", -0.5],
          ["suit_tie", "fade", 0.5],
          ["hoodie_jeans", "twists", 1.5],
        ])
          add("male", o, hair, x);
        camera.position.set(2.7, 1.95, 7);
        camera.lookAt(0, 0.9, 0);
      }
      if (kind === "female-original-styles") {
        for (const [o, hair, x] of [
          ["ankara_top_jeans", "braids", -1.5],
          ["ankara_gown", "gele", -0.5],
          ["blouse_skirt", "bun", 0.5],
          ["tracksuit", "afro", 1.5],
        ])
          add("female", o, hair, x);
        camera.position.set(2.7, 1.95, 7);
        camera.lookAt(0, 0.9, 0);
      }
      if (kind === "male-hair" || kind === "female-hair") {
        const gender = kind.startsWith("female") ? "female" : "male",
          styles = H.HAIR_STYLES[gender];
        for (let i = 0; i < styles.length; i++) {
          const h = add(
            gender,
            "tee_chinos",
            styles[i].id,
            (i - (styles.length - 1) / 2) * 0.52,
          );
          h.group.position.y = -1.14;
        }
        camera.position.set(0, 0.55, gender==='female'?5:4.1);
        camera.lookAt(0, 0.48, 0);
      }
      if (kind === "motion") {
        for (const [g, o, hair, x, pose] of [
          ["male", "tee_shorts", "short_afro", -1.5, { speed: 1.75 }],
          ["female", "blouse_skirt", "ponytail", -0.5, { speed: 1.75 }],
          ["male", "tracksuit", "cornrows", 0.5, { speed: 5.4 }],
          ["female", "ankara_gown", "bob", 1.5, { grounded: false }],
        ])
          add(g, o, hair, x, 0, pose);
        camera.position.set(2.8, 1.9, 7);
        camera.lookAt(0, 0.9, 0);
      }
      if (kind === "seated") {
        const { buildKekeGeometry } =
            await import("/src/vehicles/KekeModel.js"),
          { SEATS } = await import("/src/sim/TrafficSystem.js"),
          { SEAT_HEIGHT } =
            await import("/src/characters/CharacterAnimator.js");
        scene.add(
          new T.Mesh(
            buildKekeGeometry(),
            new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
          ),
        );
        const driver = add("male", "tee_chinos", "waves", 0, 0, {
            seated: true,
          }),
          passenger = add("female", "ankara_top_jeans", "braids", 0, 0, {
            seated: true,
          });
        driver.group.position.set(...SEATS.keke.driver);
        passenger.group.position.set(...SEATS.keke.pax[0]);
        driver.group.position.y -= SEAT_HEIGHT;
        passenger.group.position.y -= SEAT_HEIGHT;
        camera.position.set(-4.5, 2.2, 3.6);
        camera.lookAt(0, 1, 0);
      }
      if (kind === "closeup") {
        add("male", "tee_shorts", "fade", -0.32);
        add("female", "ankara_top_jeans", "bun", 0.32);
        camera.position.set(0.5, 1.6, 2.15);
        camera.lookAt(0, 1.35, 0);
      }
      scene.updateMatrixWorld(true);
      for (const h of models) h.skeleton.update();
      __game.renderer.renderer.render(scene, camera);
      window.__review = { scene, camera, models };
      return { kind, count: models.length };
    }, kind);
  }
  report.images = [];
  for (const kind of [
    "male-original-styles",
    "female-original-styles",
    "male-hair",
    "female-hair",
    "motion",
    "seated",
    "closeup",
  ]) {
    report.images.push(await shot(kind));
    await p
      .locator("#game-canvas")
      .screenshot({ path: `qa/v241/${kind}.png`, timeout: 120000 });
    await p.evaluate(() => {
      for (const h of __review.models) h.dispose();
    });
  }
  report.errors = errors;
  fs.writeFileSync(
    "qa/v241/characters-audit.json",
    JSON.stringify(report, null, 2),
  );
  assert.equal(report.rows.length, 32);
  assert(report.playerSupplied && report.allNPCsSupplied);
  assert(report.detailCounts.coarse > report.detailCounts.detailed);
  assert(
    report.rows.every(
      (r) =>
        r.supplied &&
        r.oneSkeleton &&
        r.meshes <= 18 &&
        r.poses.every(
          (p) => p.finite && p.height > 0.9 && p.height < 2.4 && p.span < 2,
        ),
    ),
  );
  assert.equal(errors.length, 0);
  assert.equal(report.runtimeErrors.length, 0);
  console.log(
    "PASS characters241 " +
      JSON.stringify({
        looks: report.rows.length,
        hairstyles: report.hair.length,
        npcs: report.npcPool,
        detail: report.detailCounts,
        maxDraws: Math.max(...report.rows.map((r) => r.meshes)),
      }),
  );
} finally {
  await browser.close();
  devServer?.kill();
}
