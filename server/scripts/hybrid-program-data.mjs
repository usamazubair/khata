// Master data for the 3-Week Hybrid Physique Program, extracted from the
// user's plan document. Only numbered "# Exercise" rows from each day's
// table are included as exercises; prose-only mentions (warm-up steps,
// "Run: 10 minutes", stand-alone finishers described in a paragraph) are
// not, since they aren't discrete named exercises in the same sense.
// Circuit rows that bundle several named sub-movements (Core A/B, the
// Thursday Week 2 "Grip complex") are expanded into their constituent
// exercises so each gets its own checkbox, consistent with how every other
// exercise in this app works.

export const CATEGORIES = [
  { name: "Chest", color: "#2f6bff" },
  { name: "Back", color: "#7b3ff2" },
  { name: "Shoulders", color: "#f4661f" },
  { name: "Arms", color: "#00b37e" },
  { name: "Legs", color: "#f0a500" },
  { name: "Core & Lower Back", color: "#e0459c" },
  { name: "Grip & Forearm", color: "#12b0c9" },
  { name: "Conditioning", color: "#e33b4e" },
];

// name -> category. Every exercise referenced by any plan below must have
// an entry here.
export const EXERCISES = {
  // Chest
  "Barbell Bench Press": "Chest",
  "Dumbbell Bench Press": "Chest",
  "Incline Dumbbell Press": "Chest",
  "Incline Barbell Press": "Chest",
  "Dumbbell Floor Press": "Chest",
  "Standard Push-Up": "Chest",
  "Tempo Push-Up": "Chest",
  "Feet-Elevated Push-Up": "Chest",
  "Close-Grip Push-Up": "Chest",
  "Pike Push-Up": "Chest",
  "Parallel-Bar Dip": "Chest",

  // Back
  "Neutral-Grip Pull-Up": "Back",
  "Chin-Up": "Back",
  "Pull-Up (or Assisted)": "Back",
  "Chest-Supported Dumbbell Row": "Back",
  "Inverted Row": "Back",
  "Inverted or Band Row": "Back",
  "One-Arm Supported Row": "Back",
  "Face Pull": "Back",
  "Face Pull or Band Pull-Apart": "Back",
  "Rear-Delt Fly": "Back",

  // Shoulders
  "Standing Overhead Press": "Shoulders",
  "Seated Dumbbell Shoulder Press": "Shoulders",
  "Arnold Press": "Shoulders",
  "Dumbbell Lateral Raise": "Shoulders",

  // Arms
  "Barbell Curl": "Arms",
  "Incline Dumbbell Curl": "Arms",
  "Hammer Curl": "Arms",
  "Reverse Curl": "Arms",
  "Skull Crusher": "Arms",
  "Rope Tricep Extension": "Arms",

  // Legs
  "Back Squat": "Legs",
  "Front or Goblet Squat": "Legs",
  "Goblet Squat": "Legs",
  "Goblet or Front Squat": "Legs",
  "Bulgarian Split Squat": "Legs",
  "Step-Up": "Legs",
  "Reverse Lunge": "Legs",
  "Hip Thrust": "Legs",
  "Single-Leg Hip Thrust": "Legs",
  "Light Romanian Deadlift": "Legs",
  "Light RDL or Hip Thrust": "Legs",
  "Hamstring Curl": "Legs",
  "Sliding or Band Hamstring Curl": "Legs",
  "Standing Calf Raise": "Legs",
  "Calf Raise": "Legs",
  "Single-Leg Calf Raise": "Legs",

  // Core & Lower Back
  "Dead Bug": "Core & Lower Back",
  "Side Plank": "Core & Lower Back",
  "Bird Dog": "Core & Lower Back",
  "Hanging Knee Raise": "Core & Lower Back",
  "Band/Cable Crunch": "Core & Lower Back",
  "Pallof Press": "Core & Lower Back",

  // Grip & Forearm
  "Dead Hang": "Grip & Forearm",
  "Scapular Pull-Up": "Grip & Forearm",
  "Wrist Curl": "Grip & Forearm",
  "Palms Down Wrist Curl": "Grip & Forearm",
  "Reverse Wrist Curl": "Grip & Forearm",
  "Pinch Hold": "Grip & Forearm",
  "Towel Dead Hang": "Grip & Forearm",
  "Band Pull-Apart": "Grip & Forearm",

  // Conditioning
  "Farmer Carry Intervals": "Conditioning",
  "Swing or Step-Up Intervals": "Conditioning",
  "Mountain Climbers": "Conditioning",
};

// One entry per plan: { name, dow (1=Mon,2=Tue,4=Thu,5=Fri,6=Sat),
// week (1|2|3|null -- null means no rotation, single plan for that
// weekday), exercises: [names in order] }
export const PLANS = [
  // ---- Monday: Upper body ----
  {
    name: "Upper Strength (Week 1)", dow: 1, week: 1,
    exercises: ["Barbell Bench Press", "Neutral-Grip Pull-Up", "Incline Dumbbell Press", "Chest-Supported Dumbbell Row",
      "Standing Overhead Press", "Dumbbell Lateral Raise", "Barbell Curl", "Skull Crusher", "Farmer Carry Intervals"],
  },
  {
    name: "Upper Hypertrophy (Week 2)", dow: 1, week: 2,
    exercises: ["Dumbbell Bench Press", "Neutral-Grip Pull-Up", "Incline Barbell Press", "Inverted Row",
      "Seated Dumbbell Shoulder Press", "Dumbbell Lateral Raise", "Incline Dumbbell Curl", "Skull Crusher"],
  },
  {
    name: "Upper-Body Physique Circuit (Week 3)", dow: 1, week: 3,
    exercises: ["Standard Push-Up", "Pull-Up (or Assisted)", "Incline Dumbbell Press", "Inverted or Band Row",
      "Pike Push-Up", "Dumbbell Lateral Raise", "Hammer Curl", "Close-Grip Push-Up"],
  },

  // ---- Tuesday: Lower body + Core A ----
  {
    name: "Lower Strength + Core A (Week 1)", dow: 2, week: 1,
    exercises: ["Back Squat", "Hip Thrust", "Bulgarian Split Squat", "Hamstring Curl", "Standing Calf Raise",
      "Dead Bug", "Side Plank", "Bird Dog"],
  },
  {
    name: "Lower Hypertrophy + Core A (Week 2)", dow: 2, week: 2,
    exercises: ["Front or Goblet Squat", "Hip Thrust", "Bulgarian Split Squat", "Hamstring Curl", "Calf Raise",
      "Dead Bug", "Side Plank", "Bird Dog"],
  },
  {
    name: "Lower Stamina + Core A (Week 3)", dow: 2, week: 3,
    exercises: ["Goblet Squat", "Hip Thrust", "Step-Up", "Hamstring Curl", "Calf Raise",
      "Dead Bug", "Side Plank", "Bird Dog"],
  },

  // ---- Thursday: Upper + calisthenics + grip ----
  {
    name: "Upper Strength + Calisthenics + Grip (Week 1)", dow: 4, week: 1,
    exercises: ["Close-Grip Push-Up", "Chin-Up", "Dumbbell Bench Press", "One-Arm Supported Row", "Face Pull",
      "Hammer Curl", "Dead Hang", "Palms Down Wrist Curl", "Rope Tricep Extension", "Swing or Step-Up Intervals"],
  },
  {
    name: "Calisthenics Upper + Grip (Week 2)", dow: 4, week: 2,
    exercises: ["Tempo Push-Up", "Chin-Up", "Parallel-Bar Dip", "Chest-Supported Dumbbell Row", "Pike Push-Up",
      "Rear-Delt Fly", "Reverse Curl", "Towel Dead Hang", "Pinch Hold"],
  },
  {
    name: "Upper Density + Grip (Week 3)", dow: 4, week: 3,
    exercises: ["Feet-Elevated Push-Up", "Chin-Up", "Dumbbell Floor Press", "One-Arm Supported Row", "Arnold Press",
      "Face Pull or Band Pull-Apart", "Reverse Curl", "Farmer Carry Intervals"],
  },

  // ---- Friday: Lower body + Core B ----
  {
    name: "Lower Strength + Core B (Week 1)", dow: 5, week: 1,
    exercises: ["Goblet or Front Squat", "Light Romanian Deadlift", "Step-Up", "Sliding or Band Hamstring Curl",
      "Single-Leg Calf Raise", "Hanging Knee Raise", "Band/Cable Crunch", "Pallof Press", "Side Plank"],
  },
  {
    name: "Lower Hypertrophy + Core B (Week 2)", dow: 5, week: 2,
    exercises: ["Step-Up", "Goblet Squat", "Single-Leg Hip Thrust", "Sliding or Band Hamstring Curl", "Calf Raise",
      "Hanging Knee Raise", "Band/Cable Crunch", "Pallof Press", "Side Plank"],
  },
  {
    name: "Lower Conditioning + Intervals + Core B (Week 3)", dow: 5, week: 3,
    exercises: ["Goblet or Front Squat", "Light RDL or Hip Thrust", "Reverse Lunge", "Sliding or Band Hamstring Curl",
      "Mountain Climbers", "Hanging Knee Raise", "Band/Cable Crunch", "Pallof Press"],
  },

  // ---- Saturday: optional, same every week (no rotation) ----
  {
    name: "Optional Grip & Posture", dow: 6, week: null,
    exercises: ["Dead Hang", "Scapular Pull-Up", "Wrist Curl", "Reverse Wrist Curl", "Pinch Hold",
      "Band Pull-Apart", "Bird Dog"],
  },
];
