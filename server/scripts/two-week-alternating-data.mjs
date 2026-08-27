// Master data for the 2-Week Alternating Training Plan (Week 1 muscle
// growth / Week 2 athletic conditioning), extracted from the user's plan
// document. Only numbered "# ... Exercise" rows are included as exercises;
// prose-only mentions (the run blocks, standing instructions) aren't,
// since they're not discrete named exercises in the same sense. A row that
// bundles several named sub-movements into one circuit line (an "Abs
// circuit" listing 3 named moves, a superset row naming two exercises) is
// expanded into its constituent exercises so each gets its own checkbox --
// same treatment as the previous program's Core A/B rows.
//
// Where the source names an exercise slightly differently across two
// occurrences but clearly means the same movement (e.g. "Leg Curl" later
// vs. "Seated or Lying Leg Curl" earlier), it's treated as the same
// exercise rather than creating a near-duplicate. Two/three "Alternative"
// columns exist per row in the source -- this app has no per-slot
// alternates feature, so they're recorded in the primary exercise's own
// notes field instead of being modeled as separate exercises.
//
// Week 1 trains Monday/Tuesday/Wednesday/Thursday; Week 2 trains
// Monday/Tuesday/Thursday/Friday -- Wednesday and Friday are each only
// "on" in one of the two weeks. Since a weekday's rotation always fires
// something every week it's due, the "off" week for those two days uses a
// zero-exercise "Rest Day" placeholder plan so nothing is generated for a
// week that's supposed to be a rest day on that weekday.

export const CATEGORIES = [
  { name: "Chest", color: "#2f6bff" },
  { name: "Back", color: "#7b3ff2" },
  { name: "Shoulders", color: "#f4661f" },
  { name: "Biceps", color: "#00b37e" },
  { name: "Triceps", color: "#12b0c9" },
  { name: "Forearms", color: "#f0a500" },
  { name: "Legs", color: "#e0459c" },
  { name: "Abs", color: "#e33b4e" },
];

// name -> [category, notes]. notes carries the source's "Alternative"
// columns, when any were given, as a plain reference line.
export const EXERCISES = {
  // Chest
  "Incline Dumbbell Press": ["Chest", "Alternatives: incline barbell press, incline machine press."],
  "Flat Dumbbell or Machine Press": ["Chest", "Alternatives: chest dip, feet-elevated push-up."],
  "Low-to-High Cable Fly": ["Chest", "Alternatives: band low-to-high fly, incline dumbbell fly."],
  "Incline Cable or Band Fly": ["Chest", "Alternatives: pec-deck fly, incline dumbbell fly."],
  "Machine Press or Push-Up": ["Chest", "Alternatives: flat dumbbell press, chest dip."],
  "Push-Up": ["Chest", "Alternatives: machine chest press, incline push-up."],
  "Goblet Squat": ["Legs", "Alternatives: leg press (light), bodyweight squat."],

  // Back
  "Pull-Up or Lat Pulldown": ["Back", "Alternatives: band-assisted pull-up, close-grip pulldown."],
  "Chest-Supported Row": ["Back", "Alternatives: seated cable row, machine row."],
  "Straight-Arm Pulldown": ["Back", "Alternatives: band straight-arm pulldown, dumbbell pullover."],
  "Close-Grip Lat Pulldown": ["Back", "Alternatives: neutral-grip pulldown, assisted pull-up."],
  "Seated Cable Row": ["Back", "Alternatives: chest-supported row, band row."],
  "Lat Pulldown": ["Back", ""],
  "Band or Cable Row": ["Back", "Alternatives: chest-supported row, seated cable row."],

  // Shoulders
  "Seated Dumbbell Press": ["Shoulders", "Alternatives: machine shoulder press, landmine press."],
  "Dumbbell Lateral Raise": ["Shoulders", "Alternatives: cable lateral raise, machine lateral raise."],
  "Reverse Pec-Deck or Face Pull": ["Shoulders", "Alternatives: rear-delt cable fly, band pull-apart."],
  "Cable Lateral Raise": ["Shoulders", "Alternatives: dumbbell lateral raise, band lateral raise."],
  "Face Pull": ["Shoulders", "Alternatives: reverse pec-deck, band pull-apart."],

  // Biceps
  "Incline Dumbbell Curl": ["Biceps", "Alternatives: Bayesian cable curl, seated dumbbell curl."],
  "Hammer Curl": ["Biceps", "Alternatives: rope hammer curl, cross-body hammer curl."],
  "EZ-Bar Curl": ["Biceps", "Alternatives: barbell curl, alternating dumbbell curl."],
  "Preacher or Spider Curl": ["Biceps", "Alternatives: machine preacher curl, concentration curl."],
  "Cable Curl": ["Biceps", "Alternatives: band curl, rope hammer curl."],

  // Triceps
  "Overhead Dumbbell Extension": ["Triceps", "Alternatives: overhead rope extension, cable skull crusher."],
  "Rope Pushdown": ["Triceps", "Alternatives: straight-bar pushdown, chair dip."],
  "Assisted Dip": ["Triceps", "Alternatives: machine dip, close-grip push-up."],
  "Cable Skull Crusher": ["Triceps", "Alternatives: rolling dumbbell extension, overhead rope extension."],
  "Reverse-Grip Pushdown": ["Triceps", "Alternatives: straight-bar pushdown, band pushdown."],

  // Forearms
  "Reverse Curl": ["Forearms", "Alternatives: wrist curl, hammer curl."],
  "Farmer's Hold": ["Forearms", "Alternatives: dead hang, plate pinch hold."],
  "Wrist Curl": ["Forearms", ""],
  "Farmer's Carry": ["Forearms", ""],

  // Legs
  "Heel-Elevated Goblet Squat": ["Legs", "Alternatives: leg press, hack squat."],
  "Seated or Lying Leg Curl": ["Legs", "Alternatives: sliding leg curl, stability-ball curl."],
  "Hip Thrust": ["Legs", "Alternatives: glute bridge, single-leg hip thrust."],
  "Bulgarian Split Squat": ["Legs", "Alternatives: reverse lunge, step-up."],
  "Standing Calf Raise": ["Legs", "Alternatives: seated calf raise, single-leg calf raise."],
  "Walking Lunge": ["Legs", "Alternatives: reverse lunge, static split squat."],
  "Step-Up": ["Legs", "Alternatives: stair step-up, box step-up."],
  "Single-Leg Glute Bridge": ["Legs", "Alternatives: hip thrust (light), cable pull-through."],
  "Suitcase Carry": ["Legs", "Alternative: loaded bag hold."],

  // Abs
  "Hanging Knee Raise": ["Abs", "Alternatives: reverse crunch, lying bent-knee leg raise."],
  "Pallof Press": ["Abs", "Alternatives: bird dog, cable woodchop."],
  "Side Plank": ["Abs", "Alternatives: side-plank hip dips, suitcase carry."],
  "Cable Crunch": ["Abs", "Alternatives: weighted ball crunch, machine ab crunch."],
  "Dead Bug": ["Abs", "Alternatives: bird dog, plank shoulder tap."],
  "Cable Woodchop": ["Abs", "Alternatives: side-plank hip dips, Pallof press with rotation."],
};

export const PLANS = [
  // ---- Monday: rotation of 2 ----
  {
    name: "Chest, Back, Shoulders, Forearms (Week 1)", dow: 1, week: 1,
    exercises: ["Incline Dumbbell Press", "Flat Dumbbell or Machine Press", "Low-to-High Cable Fly",
      "Pull-Up or Lat Pulldown", "Chest-Supported Row", "Straight-Arm Pulldown",
      "Seated Dumbbell Press", "Dumbbell Lateral Raise", "Reverse Pec-Deck or Face Pull",
      "Reverse Curl", "Farmer's Hold"],
  },
  {
    name: "Upper Body Supersets (Week 2)", dow: 1, week: 2,
    exercises: ["Incline Dumbbell Press", "Chest-Supported Row", "Dumbbell Lateral Raise", "Face Pull",
      "Push-Up", "Lat Pulldown", "Reverse Curl", "Farmer's Carry"],
  },

  // ---- Tuesday: rotation of 2 ----
  {
    name: "Arms, Legs, Abs (Week 1)", dow: 2, week: 1,
    exercises: ["Incline Dumbbell Curl", "Hammer Curl", "Overhead Dumbbell Extension", "Rope Pushdown",
      "Heel-Elevated Goblet Squat", "Seated or Lying Leg Curl",
      "Hanging Knee Raise", "Pallof Press", "Side Plank"],
  },
  {
    name: "Run Intervals, Single-Leg Work, Core (Week 2)", dow: 2, week: 2,
    exercises: ["Walking Lunge", "Step-Up", "Single-Leg Glute Bridge", "Seated or Lying Leg Curl",
      "Hanging Knee Raise", "Pallof Press", "Side Plank"],
  },

  // ---- Wednesday: rotation of 2 -- Week 2 has no Wednesday session ----
  {
    name: "Chest, Back, Shoulders, Abs (Week 1)", dow: 3, week: 1,
    exercises: ["Incline Cable or Band Fly", "Machine Press or Push-Up", "Close-Grip Lat Pulldown",
      "Seated Cable Row", "Cable Lateral Raise", "Face Pull",
      "Cable Crunch", "Dead Bug", "Cable Woodchop"],
  },
  { name: "Rest Day", dow: 3, week: 2, exercises: [] },

  // ---- Thursday: rotation of 2 ----
  {
    name: "Arms, Legs, Forearms (Week 1)", dow: 4, week: 1,
    exercises: ["EZ-Bar Curl", "Preacher or Spider Curl", "Cable Curl",
      "Assisted Dip", "Cable Skull Crusher", "Reverse-Grip Pushdown",
      "Hip Thrust", "Bulgarian Split Squat", "Standing Calf Raise",
      "Reverse Curl", "Wrist Curl"],
  },
  {
    name: "Full Body Density Circuit (Week 2)", dow: 4, week: 2,
    exercises: ["Goblet Squat", "Push-Up", "Band or Cable Row", "Hip Thrust", "Suitcase Carry"],
  },

  // ---- Friday: rotation of 2 -- Week 1 has no Friday session ----
  { name: "Rest Day", dow: 5, week: 1, exercises: [] },
  {
    name: "Pull, Arms and Core (Week 2)", dow: 5, week: 2,
    exercises: ["Pull-Up or Lat Pulldown", "Seated Cable Row", "Face Pull",
      "Hammer Curl", "Rope Pushdown", "Reverse Curl",
      "Cable Crunch", "Dead Bug", "Cable Woodchop"],
  },
];
