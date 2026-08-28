// Master data for the 4-Day Physique Plan (Week 1 power/strength/growth,
// Week 2 athletic conditioning), extracted from the user's plan document.
// Follows the same conventions as the previous 2-Week Alternating program's
// data file:
//  - Only named "# Exercise" rows and power-block rows are modeled as
//    exercises; prose-only instructions aren't.
//  - A row that bundles several named sub-movements into one line (a
//    superset "X + Y", an abs/upper circuit listing several named moves,
//    the combined "Wrist Curl + Plate Pinch" row) is expanded into its
//    constituent exercises so each gets its own checkbox.
//  - This app has no per-slot alternates feature and no sets/reps fields at
//    all (workout sessions are a checklist, not a rep tracker) -- the
//    source's "Alternative" columns are recorded in each exercise's own
//    notes field as a plain reference line, and set/rep prescriptions
//    aren't stored anywhere.
//  - Where the source names the same movement slightly differently across
//    two occurrences (e.g. "Lateral raise" in Week 2 vs. "Dumbbell Lateral
//    Raise" in Week 1), it's treated as the same exercise rather than
//    creating a near-duplicate -- Week 2's reused movements inherit their
//    Week 1 alternative notes for free this way.
//
// Both training days recur every week (unlike the previous program, no
// weekday is only active in one of the two weeks), so no "Rest Day"
// placeholder plans are needed -- every weekday used here has exactly a
// rotation of 2 (Week 1, Week 2).
//
// Days map to Monday/Tuesday/Thursday/Friday (the document names them "Day
// 1..4" without specifying calendar days). This is a default, not something
// the source dictates -- change the day chips on any plan from the web
// Plans page any time.
//
// MEDIA: exercises here point at real demonstration images from
// free-exercise-db (github.com/yuhonas/free-exercise-db), a public-domain
// (Unlicense) open exercise dataset -- not fabricated or guessed URLs, and
// not this app's own Cloudinary uploads. Every URL below was verified to
// resolve before being written here. Coverage is partial: a name with no
// close, form-accurate match in that dataset is left without media rather
// than pointing at a visually misleading substitute (e.g. no plain "Cable
// Curl", "Bulgarian Split Squat", or "Side Plank" entry exists there that
// actually shows that movement) -- those, and the two runs, can have a
// real photo or clip added any time via the app's own camera/upload
// button on the exercise's detail screen, which fully replaces this.

const MEDIA_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const img = (path) => [MEDIA_BASE + path, "image"];

export const CATEGORIES = [
  { name: "Chest", color: "#2f6bff" },
  { name: "Back", color: "#7b3ff2" },
  { name: "Shoulders", color: "#f4661f" },
  { name: "Biceps", color: "#00b37e" },
  { name: "Triceps", color: "#12b0c9" },
  { name: "Forearms", color: "#f0a500" },
  { name: "Legs", color: "#e0459c" },
  { name: "Abs", color: "#e33b4e" },
  { name: "Power", color: "#d90429" },
  { name: "Cardio", color: "#06aed5" },
];

// name -> [category, notes, [media_url, media_type] | null]
export const EXERCISES = {
  // Power
  "Medicine Ball Chest Pass": ["Power", "Alternatives: medicine ball slam, band-resisted explosive press.", img("Medicine_Ball_Chest_Pass/0.jpg")],
  "Plyometric Push-Up": ["Power", "Alternatives: hands-on-bench plyo push-up, explosive push-up (no airtime).", img("Plyo_Push-up/0.jpg")],
  "Box Jump": ["Power", "Alternatives: explosive step-up, squat jump to a soft landing. Always step down from the box -- never jump down.", img("Front_Box_Jump/0.jpg")],
  "Kettlebell Swing": ["Power", "Alternatives: explosive hip thrust, band pull-through (fast).", img("One-Arm_Kettlebell_Swings/0.jpg")],
  "Broad Jump": ["Power", "Alternatives: standing vertical jump, explosive split-squat jump.", img("Standing_Long_Jump/0.jpg")],

  // Chest
  "Incline Dumbbell Press": ["Chest", "Alternatives: incline barbell press, incline machine press.", img("Incline_Dumbbell_Press/0.jpg")],
  "Flat Dumbbell or Machine Press": ["Chest", "Alternatives: chest dip, feet-elevated push-up.", img("Dumbbell_Bench_Press/0.jpg")],
  "Incline Cable or Band Fly": ["Chest", "Alternatives: pec-deck fly, incline dumbbell fly.", img("Incline_Cable_Flye/0.jpg")],
  "Machine Chest Press or Push-Up": ["Chest", "Alternatives: flat dumbbell press, chest dip.", img("Machine_Bench_Press/0.jpg")],
  "Push-Up": ["Chest", "", img("Pushups/0.jpg")],

  // Back
  "Lat Pulldown or Pull-Up": ["Back", "Alternatives: band-assisted pull-up, close-grip pulldown.", img("Wide-Grip_Lat_Pulldown/0.jpg")],
  "Chest-Supported Row": ["Back", "Alternatives: seated cable row, machine row.", null],
  "Close-Grip Lat Pulldown": ["Back", "Alternatives: neutral-grip pulldown, assisted pull-up.", img("Close-Grip_Front_Lat_Pulldown/0.jpg")],
  "Seated Cable Row": ["Back", "Alternatives: chest-supported row, band row.", img("Seated_Cable_Rows/0.jpg")],
  "Lat Pulldown": ["Back", "", img("Wide-Grip_Lat_Pulldown/0.jpg")],
  "Band or Cable Row": ["Back", "", null],

  // Shoulders
  "Seated Dumbbell Shoulder Press": ["Shoulders", "Alternatives: machine shoulder press, landmine press.", img("Seated_Dumbbell_Press/0.jpg")],
  "Dumbbell Lateral Raise": ["Shoulders", "Alternatives: cable lateral raise, machine lateral raise.", img("Side_Lateral_Raise/0.jpg")],
  "Cable Lateral Raise": ["Shoulders", "Alternatives: dumbbell lateral raise, band lateral raise.", img("Cable_Seated_Lateral_Raise/0.jpg")],
  "Face Pull": ["Shoulders", "Alternatives: reverse pec-deck, band pull-apart.", img("Face_Pull/0.jpg")],

  // Biceps
  "Incline Dumbbell Curl": ["Biceps", "Alternatives: Bayesian cable curl, seated dumbbell curl.", img("Incline_Dumbbell_Curl/0.jpg")],
  "Hammer Curl": ["Biceps", "Alternatives: rope hammer curl, cross-body hammer curl.", img("Alternate_Hammer_Curl/0.jpg")],
  "EZ-Bar Curl": ["Biceps", "Alternatives: barbell curl, alternating dumbbell curl.", img("EZ-Bar_Curl/0.jpg")],
  "Cable Curl": ["Biceps", "Alternatives: band curl, preacher curl.", null],

  // Triceps
  "Overhead Dumbbell Extension": ["Triceps", "Alternatives: overhead rope extension, cable skull crusher.", img("Standing_Dumbbell_Triceps_Extension/0.jpg")],
  "Rope Pushdown": ["Triceps", "Alternatives: straight-bar pushdown, chair dip.", img("Triceps_Pushdown/0.jpg")],
  "Assisted Dip": ["Triceps", "Alternatives: machine dip, close-grip push-up.", img("Dip_Machine/0.jpg")],
  "Cable Skull Crusher": ["Triceps", "Alternatives: rolling dumbbell extension, reverse-grip pushdown.", null],

  // Forearms
  "Reverse Curl": ["Forearms", "Alternatives: wrist curl, hammer curl.", img("Reverse_Barbell_Curl/0.jpg")],
  "Farmer's Hold": ["Forearms", "Alternatives: dead hang, plate pinch hold.", img("Farmers_Walk/0.jpg")],
  "Wrist Curl": ["Forearms", "Alternative: reverse curl.", img("Palms-Up_Barbell_Wrist_Curl_Over_A_Bench/0.jpg")],
  "Plate Pinch Hold": ["Forearms", "Alternatives: farmer's hold, reverse curl.", img("Plate_Pinch/0.jpg")],
  "Farmer's Carry": ["Forearms", "", img("Farmers_Walk/0.jpg")],

  // Legs
  "Heel-Elevated Goblet Squat": ["Legs", "Alternatives: leg press, hack squat.", img("Goblet_Squat/0.jpg")],
  "Seated or Lying Leg Curl": ["Legs", "Alternatives: sliding leg curl, stability-ball curl.", img("Seated_Leg_Curl/0.jpg")],
  "Hip Thrust": ["Legs", "Alternatives: glute bridge (loaded), single-leg hip thrust.", img("Barbell_Hip_Thrust/0.jpg")],
  "Bulgarian Split Squat": ["Legs", "Alternatives: reverse lunge, step-up.", null],
  "Standing Calf Raise": ["Legs", "Alternatives: seated calf raise, single-leg calf raise.", img("Standing_Calf_Raises/0.jpg")],
  "Goblet Squat": ["Legs", "", img("Goblet_Squat/0.jpg")],
  "Walking Lunge": ["Legs", "Alternative: reverse lunge or step-up.", img("Barbell_Walking_Lunge/0.jpg")],
  "Step-Up": ["Legs", "Alternative: walking lunge.", img("Dumbbell_Step_Ups/0.jpg")],
  "Suitcase Carry": ["Legs", "Alternative: farmer's carry.", null],

  // Abs
  "Hanging Knee Raise": ["Abs", "Alternatives: reverse crunch, lying bent-knee leg raise.", img("Hanging_Leg_Raise/0.jpg")],
  "Pallof Press": ["Abs", "Alternatives: bird dog, cable woodchop.", img("Pallof_Press/0.jpg")],
  "Side Plank": ["Abs", "Alternatives: side-plank hip dips, suitcase carry.", null],
  "Cable Crunch": ["Abs", "Alternatives: weighted ball crunch, machine ab crunch.", img("Cable_Crunch/0.jpg")],
  "Dead Bug": ["Abs", "Alternatives: bird dog, plank shoulder tap.", img("Dead_Bug/0.jpg")],
  "Cable Woodchop": ["Abs", "Alternatives: side-plank hip dips, Pallof press with rotation.", img("Standing_Cable_Wood_Chop/0.jpg")],

  // Cardio
  "Morning Run — Intervals": [
    "Cardio",
    "Before 7am. Week 1: 10 min warm-up, 15 min conversational run, 6x60 sec hard with 90 sec walk between, 5 min cooldown (25-30 min total). Week 2: 10 min warm-up, 8x90 sec hard with 90 sec walk between, 10 min cooldown.",
    null,
  ],
  "Morning Run — Easy": [
    "Cardio",
    "Before 7am. Week 1: 30-35 min easy, conversational pace throughout -- doubles as active recovery from Day 1. Week 2: 35 min easy.",
    null,
  ],
};

export const PLANS = [
  // ---- Monday: rotation of 2 ----
  {
    name: "Power, Chest, Back, Shoulders, Forearms (Week 1)", dow: 1, week: 1,
    exercises: ["Medicine Ball Chest Pass", "Plyometric Push-Up",
      "Incline Dumbbell Press", "Flat Dumbbell or Machine Press",
      "Lat Pulldown or Pull-Up", "Chest-Supported Row",
      "Seated Dumbbell Shoulder Press", "Dumbbell Lateral Raise",
      "Reverse Curl", "Farmer's Hold"],
  },
  {
    name: "Upper-Body Supersets (Week 2)", dow: 1, week: 2,
    exercises: ["Incline Dumbbell Press", "Chest-Supported Row",
      "Dumbbell Lateral Raise", "Face Pull",
      "Push-Up", "Lat Pulldown",
      "Reverse Curl", "Farmer's Carry"],
  },

  // ---- Tuesday: rotation of 2 ----
  {
    name: "Arms, Legs, Abs — Run Day (Week 1)", dow: 2, week: 1,
    exercises: ["Morning Run — Intervals",
      "Incline Dumbbell Curl", "Hammer Curl", "Overhead Dumbbell Extension", "Rope Pushdown",
      "Heel-Elevated Goblet Squat", "Seated or Lying Leg Curl",
      "Hanging Knee Raise", "Pallof Press", "Side Plank"],
  },
  {
    name: "Run Intervals, Arms, Legs, Abs (Week 2)", dow: 2, week: 2,
    exercises: ["Morning Run — Intervals",
      "Cable Curl", "Rope Pushdown",
      "Walking Lunge", "Seated or Lying Leg Curl",
      "Hanging Knee Raise", "Pallof Press", "Side Plank"],
  },

  // ---- Thursday: rotation of 2 ----
  {
    name: "Chest, Back, Shoulders, Abs — Run Day (Week 1)", dow: 4, week: 1,
    exercises: ["Morning Run — Easy",
      "Incline Cable or Band Fly", "Machine Chest Press or Push-Up",
      "Close-Grip Lat Pulldown", "Seated Cable Row",
      "Cable Lateral Raise", "Face Pull",
      "Cable Crunch", "Dead Bug", "Cable Woodchop"],
  },
  {
    name: "Run, Upper Circuit, Abs (Week 2)", dow: 4, week: 2,
    exercises: ["Morning Run — Easy",
      "Goblet Squat", "Push-Up", "Band or Cable Row", "Dumbbell Lateral Raise",
      "Hanging Knee Raise", "Pallof Press", "Side Plank"],
  },

  // ---- Friday: rotation of 2 ----
  {
    name: "Power, Arms, Legs, Forearms (Week 1)", dow: 5, week: 1,
    exercises: ["Box Jump", "Kettlebell Swing", "Broad Jump",
      "Hip Thrust", "Bulgarian Split Squat",
      "EZ-Bar Curl", "Cable Curl",
      "Assisted Dip", "Cable Skull Crusher",
      "Standing Calf Raise",
      "Wrist Curl", "Plate Pinch Hold"],
  },
  {
    name: "Full Body Density (Week 2)", dow: 5, week: 2,
    exercises: ["Hip Thrust", "Step-Up", "Seated Cable Row", "Assisted Dip", "Suitcase Carry", "Wrist Curl"],
  },
];
