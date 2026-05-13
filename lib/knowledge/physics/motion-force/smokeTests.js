const smokeTests = [
  {
    "id": "motion_force_smoke_1",
    "query": "what is speed if I go 36 meters in 6 seconds",
    "expectedRoute": "formula",
    "expectedTool": "speed",
    "expectedCoreAnswer": "6 m/s",
    "notes": "Basic speed formula."
  },
  {
    "id": "motion_force_smoke_2",
    "query": "find volocity 18 km north in .5 hours",
    "expectedRoute": "formula",
    "expectedTool": "velocity",
    "expectedCoreAnswer": "36 km/hr north",
    "notes": "Misspelled velocity; direction should be preserved."
  },
  {
    "id": "motion_force_smoke_3",
    "query": "distance vs displacement if I walk 40m east then 15m west",
    "expectedRoute": "concept_or_formula",
    "expectedTool": "distance_displacement",
    "expectedCoreAnswer": "distance 55 m; displacement 25 m east",
    "notes": "Needs distance/displacement distinction."
  },
  {
    "id": "motion_force_smoke_4",
    "query": "a car goes from 12 m/s to 0 in 4 seconds what is acceleration",
    "expectedRoute": "formula",
    "expectedTool": "acceleration",
    "expectedCoreAnswer": "-3 m/s²",
    "notes": "Comes to a stop -> final velocity 0."
  },
  {
    "id": "motion_force_smoke_5",
    "query": "from rest to 9 m/s in 3 seconds acceleration",
    "expectedRoute": "formula",
    "expectedTool": "acceleration",
    "expectedCoreAnswer": "3 m/s²",
    "notes": "'From rest' means initial velocity = 0."
  },
  {
    "id": "motion_force_smoke_6",
    "query": "what does a flat line on a distance time graph mean",
    "expectedRoute": "graph_concept",
    "expectedTool": "distance_time_graphs",
    "expectedCoreAnswer": "object is stopped/not moving; speed 0",
    "notes": "Graph vocabulary."
  },
  {
    "id": "motion_force_smoke_7",
    "query": "what does slope mean on a velocity vs time graph",
    "expectedRoute": "graph_concept",
    "expectedTool": "velocity_time_graphs",
    "expectedCoreAnswer": "acceleration",
    "notes": "Graph concept."
  },
  {
    "id": "motion_force_smoke_8",
    "query": "12 N right and 5 N left net force",
    "expectedRoute": "formula",
    "expectedTool": "net_force",
    "expectedCoreAnswer": "7 N right",
    "notes": "Opposite direction force diagram text."
  },
  {
    "id": "motion_force_smoke_9",
    "query": "force for 12 kg accelerating at 4 m/s2",
    "expectedRoute": "formula",
    "expectedTool": "newtons_second_law",
    "expectedCoreAnswer": "48 N",
    "notes": "F=ma."
  },
  {
    "id": "motion_force_smoke_10",
    "query": "40 N force on 10 kg cart acceleration",
    "expectedRoute": "formula",
    "expectedTool": "newtons_second_law",
    "expectedCoreAnswer": "4 m/s²",
    "notes": "a=F/m."
  },
  {
    "id": "motion_force_smoke_11",
    "query": "how much does 25 kg weigh on earth",
    "expectedRoute": "formula",
    "expectedTool": "weight",
    "expectedCoreAnswer": "245 N",
    "notes": "Use g=9.8 m/s²."
  },
  {
    "id": "motion_force_smoke_12",
    "query": "momentum of 60 kg skateboarder going 5 m/s",
    "expectedRoute": "formula",
    "expectedTool": "momentum",
    "expectedCoreAnswer": "300 kg*m/s",
    "notes": "p=mv."
  },
  {
    "id": "motion_force_smoke_13",
    "query": "swimmer pushes water back and moves forward what law",
    "expectedRoute": "law_identification",
    "expectedTool": "newtons_third_law",
    "expectedCoreAnswer": "Newton's 3rd Law",
    "notes": "Scenario classification."
  },
  {
    "id": "motion_force_smoke_14",
    "query": "why does a flat paper fall slower than crumpled paper",
    "expectedRoute": "concept",
    "expectedTool": "air_resistance",
    "expectedCoreAnswer": "flat paper has more air resistance",
    "notes": "Air resistance concept."
  },
  {
    "id": "motion_force_smoke_15",
    "query": "rank feather baseball bicycle car by inertia",
    "expectedRoute": "concept",
    "expectedTool": "inertia",
    "expectedCoreAnswer": "feather, baseball, bicycle, car",
    "notes": "Inertia depends on mass."
  }
];

module.exports = smokeTests;
