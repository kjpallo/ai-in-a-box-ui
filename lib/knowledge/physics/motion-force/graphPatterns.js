const graphPatterns = [
  {
    "id": "distance_time_1",
    "unit": "Motion and Force",
    "graphType": "distance_time",
    "visualPattern": "horizontal line",
    "meaning": "object is not moving",
    "slopeMeans": "speed",
    "responseRule": "Say speed is 0 because distance does not change as time passes.",
    "sourcePages": "5,8-10,18-19"
  },
  {
    "id": "distance_time_2",
    "unit": "Motion and Force",
    "graphType": "distance_time",
    "visualPattern": "straight line sloping upward",
    "meaning": "object moves at constant speed away from the reference point",
    "slopeMeans": "speed",
    "responseRule": "Steeper slope means greater speed.",
    "sourcePages": "5,8-10,18-19"
  },
  {
    "id": "distance_time_3",
    "unit": "Motion and Force",
    "graphType": "distance_time",
    "visualPattern": "curve getting steeper",
    "meaning": "object is speeding up",
    "slopeMeans": "speed increasing",
    "responseRule": "The slope increases, so the speed increases.",
    "sourcePages": "5,8-10,18-19"
  },
  {
    "id": "distance_time_4",
    "unit": "Motion and Force",
    "graphType": "distance_time",
    "visualPattern": "curve flattening",
    "meaning": "object is slowing down",
    "slopeMeans": "speed decreasing",
    "responseRule": "The slope decreases, so the speed decreases.",
    "sourcePages": "5,8-10,18-19"
  },
  {
    "id": "distance_time_5",
    "unit": "Motion and Force",
    "graphType": "distance_time",
    "visualPattern": "line slopes downward toward zero distance",
    "meaning": "object returns toward the reference point",
    "slopeMeans": "speed toward reference point",
    "responseRule": "Distance from the start is decreasing, so the object is heading back.",
    "sourcePages": "10"
  },
  {
    "id": "velocity_time_6",
    "unit": "Motion and Force",
    "graphType": "velocity_time",
    "visualPattern": "horizontal line at zero",
    "meaning": "object is not moving",
    "slopeMeans": "acceleration",
    "responseRule": "Velocity is 0 the whole time, so acceleration is also 0.",
    "sourcePages": "12,14,18-19"
  },
  {
    "id": "velocity_time_7",
    "unit": "Motion and Force",
    "graphType": "velocity_time",
    "visualPattern": "horizontal line above zero",
    "meaning": "object moves at constant velocity",
    "slopeMeans": "zero acceleration",
    "responseRule": "Velocity stays the same, so acceleration is 0.",
    "sourcePages": "12,14,18-19"
  },
  {
    "id": "velocity_time_8",
    "unit": "Motion and Force",
    "graphType": "velocity_time",
    "visualPattern": "straight line sloping upward",
    "meaning": "positive acceleration / speeding up in basic examples",
    "slopeMeans": "acceleration",
    "responseRule": "Velocity increases over time, so acceleration is positive.",
    "sourcePages": "12,14,18-19"
  },
  {
    "id": "velocity_time_9",
    "unit": "Motion and Force",
    "graphType": "velocity_time",
    "visualPattern": "straight line sloping downward",
    "meaning": "negative acceleration / slowing down in basic examples",
    "slopeMeans": "acceleration",
    "responseRule": "Velocity decreases over time, so acceleration is negative.",
    "sourcePages": "12,14,18-19"
  }
];

module.exports = graphPatterns;
