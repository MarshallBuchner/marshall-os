/**
 * Preference / live-resolve unit cases for Jarvis TTS.
 * Run: npx tsx --tsconfig tsconfig.json scripts/tts-voice-preference.unit.ts
 */

import {
  normalizeLangTag,
  pickJarvisTtsVoice,
  resolveLiveVoice,
} from "../src/lib/voice/speechSynthesis";

type FakeVoice = SpeechSynthesisVoice;

function voice(
  name: string,
  lang: string,
  voiceURI?: string,
): FakeVoice {
  return {
    name,
    lang,
    voiceURI: voiceURI || `${name}-${lang}`,
    localService: true,
    default: false,
  } as FakeVoice;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function expectName(
  label: string,
  got: SpeechSynthesisVoice | null,
  expected: string | null,
) {
  const name = got?.name ?? null;
  assert(name === expected, `${label}: expected ${expected}, got ${name}`);
  console.log(`PASS ${label} → ${name}`);
}

// Daniel first
expectName(
  "daniel first",
  pickJarvisTtsVoice([
    voice("Samantha", "en-US"),
    voice("Kate", "en-GB"),
    voice("Daniel", "en-GB"),
    voice("Arthur", "en-GB"),
  ]),
  "Daniel",
);

// Google UK English Male over Kate/Serena
expectName(
  "google uk male over kate/serena",
  pickJarvisTtsVoice([
    voice("Kate", "en-GB"),
    voice("Serena", "en-GB"),
    voice("Google UK English Male", "en-GB"),
  ]),
  "Google UK English Male",
);

// en_GB underscore
expectName(
  "en_GB underscore daniel",
  pickJarvisTtsVoice([
    voice("Kate", "en_GB"),
    voice("Daniel", "en_GB"),
  ]),
  "Daniel",
);

assert(normalizeLangTag("en_GB") === "en-gb", "normalizeLangTag en_GB");
console.log("PASS normalizeLangTag en_GB → en-gb");

// Microsoft George UK
expectName(
  "microsoft george uk",
  pickJarvisTtsVoice([
    voice("Microsoft George - English (United Kingdom)", "en-GB"),
    voice("Kate", "en-GB"),
  ]),
  "Microsoft George - English (United Kingdom)",
);

// female-only en-GB fallback (catalog limit)
expectName(
  "female-only en-GB fallback",
  pickJarvisTtsVoice([voice("Kate", "en-GB"), voice("Serena", "en-GB")]),
  "Kate",
);

// US male English fallback when no en-GB
expectName(
  "us male english fallback",
  pickJarvisTtsVoice([
    voice("Samantha", "en-US"),
    voice("Alex", "en-US"),
  ]),
  "Alex",
);

// resolveLiveVoice by URI
{
  const preferred = voice("Daniel", "en-GB", "uri-daniel");
  const live = [
    voice("Daniel", "en-GB", "uri-daniel-fresh"),
    voice("Daniel", "en-GB", "uri-daniel"),
  ];
  const got = resolveLiveVoice(preferred, live);
  assert(got?.voiceURI === "uri-daniel", "resolveLiveVoice URI");
  console.log("PASS resolveLiveVoice URI");
}

// resolveLiveVoice name+lang with underscore normalization
{
  const preferred = voice("Daniel", "en_GB", "stale");
  const live = [voice("Daniel", "en-GB", "live")];
  const got = resolveLiveVoice(preferred, live);
  assert(got?.voiceURI === "live", "resolveLiveVoice name+lang normalize");
  console.log("PASS resolveLiveVoice name+lang normalize");
}

console.log("\nAll TTS preference unit cases passed.");
