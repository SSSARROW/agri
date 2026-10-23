const districts = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha',
  'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala',
  'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
];

/// Crops offered when recording planting or harvest. "Other" opens free text and never offers a standard.
const knownCrops = ['Tea', 'Cinnamon', 'Pepper'];

const plotTypes = {
  'open_field': 'Open field',
  'greenhouse': 'Greenhouse',
  'shade_house': 'Shade house',
  'hydroponic': 'Hydroponic',
};

/// Stages a person can record on a batch, in journey order.
const stageTypes = ['collect', 'weigh', 'process', 'grade', 'pack'];

const stageLabels = {
  'collect': 'Collect',
  'weigh': 'Weigh',
  'process': 'Process',
  'grade': 'Grade',
  'pack': 'Pack',
};
