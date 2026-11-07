/**
 * Keep-in-sync checks for the shared script detector.
 *
 *   node scripts/test-detect.mjs        (also: npm run test:detect)
 *
 * These assertions are the contract between the text pipeline and the
 * renderer: every scene has an action, props follow the nouns, and a guest only
 * appears for an actual person's name.
 */
import assert from "node:assert/strict";
import {
  applyDetection,
  detectGuestNames,
  detectLine,
  detectProps,
} from "../shared/detect.mjs";

const cases = [];

const test = (name, fn) => cases.push({ name, fn });

test("every line gets an action", () => {
  const lines = [
    "Rahul ne paisa kamaya",
    "Wo bahut khush hai!",
    "Kya yeh sahi hai?",
    "50,000 rupaye",
    "Aur phir kuch bhi nahi hua",
    "मेहनत करो",
  ];
  for (const line of lines) {
    const line1 = detectLine(line);
    assert.ok(line1.actions.length >= 1, `no action for: ${line}`);
  }
});

test("verbs map to the right actions", () => {
  assert.equal(detectLine("Wo ghar ke liye bhaagta hai").actions[0].id, "run");
  assert.equal(detectLine("usne paisa invest kiya").actions[0].id, "invest");
  assert.equal(detectLine("wo naachne lage").actions[0].id, "dance");
  assert.equal(detectLine("usne laptop par kaam kiya").actions[0].id, "type");
});

test("nouns become props", () => {
  assert.deepEqual(detectProps("phone par baat ki"), ["phone"]);
  assert.ok(detectProps("ghar kharidne ke liye paisa").includes("money"));
  assert.ok(detectProps("ghar kharidne ke liye paisa").includes("house"));
  assert.ok(detectLine("2 minute me 50,000 kamaye").props.includes("money"));
});

test("guest names only for people", () => {
  assert.deepEqual(detectGuestNames("Rahul ne kaha"), ["Rahul"]);
  assert.deepEqual(detectGuestNames("Priya ko phone kiya"), ["Priya"]);
  assert.deepEqual(detectGuestNames("Sita"), []);
  assert.deepEqual(detectGuestNames("Key points"), []);
  assert.deepEqual(detectGuestNames("Mehnat karo"), []);
  assert.deepEqual(detectGuestNames("Paisa hi sab kuch hai"), []);
});

test("applyDetection fills every scene, keeps the title still", () => {
  const scenes = [
    { text: "Paisa Ka Sach", voiceover: "Paisa Ka Sach.", scene_type: "text", duration: 1.7 },
    { text: "Rahul", voiceover: "Rahul ne paisa kamaya.", scene_type: "text", duration: 4 },
    { text: "Points", voiceover: "Points. Mehnat karo. Paisa bachao.", scene_type: "points", duration: 4, items: ["Mehnat karo", "Paisa bachao"] },
  ];
  applyDetection(scenes, { title: "Paisa Ka Sach" });

  assert.equal(scenes[0].actions.length, 0);
  assert.equal(scenes[0].props.length, 0);
  for (const scene of scenes.slice(1)) {
    assert.ok(scene.actions.length >= 1, `no action in ${scene.text}`);
    for (const action of scene.actions) {
      assert.ok(action.id.length > 0);
      assert.ok(action.at >= 0);
    }
  }
  assert.equal(scenes[1].guest.name, "Rahul");
  assert.equal(scenes[2].guest, undefined);
});

let failed = 0;
for (const { name, fn } of cases) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}\n     ${error.message}`);
  }
}

console.log(`${cases.length - failed}/${cases.length} detection checks passed`);
if (failed > 0) process.exit(1);
