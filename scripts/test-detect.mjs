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
import { splitScript } from "../studio/split.mjs";

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

test("book titles are not people, full names are", () => {
  assert.deepEqual(
    detectGuestNames("In Atomic Habits, James Clear calls this habit stacking."),
    ["James Clear"],
  );
  // The name tag keeps both words and points at the first one.
  const line = detectLine("In Atomic Habits, James Clear calls this habit stacking.");
  assert.equal(line.guest.name, "James Clear");
  assert.equal(line.guest.word, 3);
});

test("beats land on the spoken word, in script order", () => {
  assert.equal(detectLine("He just attached the new habit to an old one").actions[0].word, 2);
  assert.equal(detectLine("he read one page").actions[0].id, "read");
  // "brewing" comes before "read" in the line, so the beats follow the line.
  const words = "And while the tea was brewing he read one page".split(" ");
  const beats = detectLine("And while the tea was brewing he read one page").actions;
  for (let i = 1; i < beats.length; i++) {
    assert.ok(beats[i].word > beats[i - 1].word, "beats must be in spoken order");
  }
  assert.ok(beats.every((beat) => beat.word < words.length));
});

test("a narrator talking to himself is not a guest", () => {
  // "Aman told himself" names the storyteller, not a visitor.
  assert.equal(detectLine("Every night, Aman told himself").guest, null);
  assert.equal(detectLine("Aman ne khud se kaha").guest, null);
  // A third party named in the line still walks in.
  assert.equal(
    detectLine("In Atomic Habits, James Clear calls this habit stacking").guest.name,
    "James Clear",
  );
});

test("one scene per sentence: caption, voice and acting share a line", () => {
  const { title, scenes } = splitScript(
    'Every night, Aman told himself:\n"Tomorrow, I\'ll start reading."\n\nAgain... and again.',
  );
  assert.equal(title, "Untitled", "narration must not be mistaken for a title");
  assert.deepEqual(
    scenes.map((scene) => scene.voiceover),
    [
      "Every night, Aman told himself.",
      "Tomorrow, I'll start reading.",
      "Again... and again.",
    ],
  );
  for (const scene of scenes) {
    assert.equal(
      scene.text,
      scene.voiceover.replace(/[.!?]+$/, ""),
      `caption and voice disagree: "${scene.text}" vs "${scene.voiceover}"`,
    );
  }
  // Props follow the nouns in that same sentence.
  assert.deepEqual(scenes[1].props, ["book"]);
  assert.equal(scenes[1].actions[0].id, "read");
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
