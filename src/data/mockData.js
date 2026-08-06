// Dummy data for the Phase 2/3 transition. Shapes here mirror what the real
// Google Calendar / Tasks / Keep APIs will eventually provide, so pages can be
// rewired without changing structure later (see T-04 through T-08 in
// family-hub-project.md).

export const people = {
  trey: { name: 'Trey', color: 'var(--person-trey)' },
  beryl: { name: 'Beryl', color: 'var(--person-beryl)' },
  bryce: { name: 'Bryce', color: 'var(--person-bryce)' },
  emery: { name: 'Emery', color: 'var(--person-emery)' },
};

// ── Calendar: month grid (Mar 2026), shared by Home mini-calendar + full Calendar page ──
// Each row is a week (7 cells). day=null means the cell is blank (not used here,
// otherMonth cells still show a number).
export const monthGrid = [
  [
    { day: 23, otherMonth: true }, { day: 24, otherMonth: true }, { day: 25, otherMonth: true },
    { day: 26, otherMonth: true }, { day: 27, otherMonth: true }, { day: 28, otherMonth: true },
    { day: 1 },
  ],
  [
    { day: 2 },
    { day: 3, events: [{ label: '8a School run', color: 'teal', title: 'School run', date: 'Mar 3', time: '8:00a – 9:00a', who: 'Trey', location: 'Prospect Ridge Academy', notes: 'Drop off kids before work' }] },
    { day: 4 }, { day: 5 },
    { day: 6, events: [{ label: '6p Bowling', color: 'coral', title: 'Bowling league', date: 'Mar 6', time: '6:00p – 8:30p', who: 'Trey', location: 'Bowlero Wheat Ridge', notes: 'Weekly Thursday night bowling league' }] },
    { day: 7 }, { day: 8 },
  ],
  [
    { day: 9 },
    { day: 10, events: [{ label: '3p Appt', color: 'teal', title: 'Appointment', date: 'Mar 10', time: '3:00p – 4:00p', who: 'Trey', location: 'Westminster Medical Center', notes: 'Annual checkup' }] },
    { day: 11 }, { day: 12 },
    { day: 13, events: [{ label: '6p Bowling', color: 'coral', title: 'Bowling league', date: 'Mar 13', time: '6:00p – 8:30p', who: 'Trey', location: 'Bowlero Wheat Ridge', notes: 'Weekly bowling league' }] },
    { day: 14 },
    { day: 15, events: [{ label: 'Spring break', color: 'purple', title: 'Spring break', date: 'Mar 15–22', time: 'All day', who: 'Bryce & Emery', location: 'Jefferson County Schools', notes: 'No school' }] },
  ],
  [
    { day: 16, events: [{ label: 'Spring break', color: 'purple', title: 'Spring break', date: 'Mar 16', time: 'All day', who: 'Bryce & Emery', location: 'Jefferson County Schools', notes: 'No school' }] },
    { day: 17, events: [{ label: 'Spring break', color: 'purple', title: 'Spring break', date: 'Mar 17', time: 'All day', who: 'Bryce & Emery' }] },
    { day: 18, events: [{ label: 'Spring break', color: 'purple', title: 'Spring break', date: 'Mar 18', time: 'All day', who: 'Bryce & Emery' }] },
    { day: 19, events: [{ label: 'Spring break', color: 'purple', title: 'Spring break', date: 'Mar 19', time: 'All day', who: 'Bryce & Emery' }] },
    {
      day: 20, today: true,
      events: [{ label: '6p Bowling', color: 'coral', title: 'Bowling league', date: 'Mar 20', time: '6:00p – 8:30p', who: 'Trey', location: 'Bowlero Wheat Ridge' }],
    },
    {
      day: 21,
      events: [
        { label: '10a Soccer', color: 'teal', title: 'Soccer — Bryce', date: 'Mar 21', time: '10:00a – 11:30a', who: 'Bryce', location: 'Prospect Park Fields', notes: 'Spring season game' },
        { label: '2p Dentist', color: 'teal', title: 'Dentist — Emery', date: 'Mar 21', time: '2:00p – 3:00p', who: 'Emery', location: 'Aspen Dental Westminster', notes: 'Routine cleaning. Beryl driving.' },
      ],
    },
    { day: 22, events: [{ label: 'Easter', color: 'purple', title: 'Easter', date: 'Mar 22', time: 'All day', who: 'Family', location: 'Home' }] },
  ],
  [
    { day: 23 },
    { day: 24, events: [{ label: '4p Pick-up', color: 'teal', title: 'School pick-up', date: 'Mar 24', time: '4:00p – 4:30p', who: 'Trey', location: 'Prospect Ridge Academy' }] },
    { day: 25 }, { day: 26 },
    { day: 27, events: [{ label: '6p Bowling', color: 'coral', title: 'Bowling league', date: 'Mar 27', time: '6:00p – 8:30p', who: 'Trey', location: 'Bowlero Wheat Ridge' }] },
    { day: 28 }, { day: 29 },
  ],
  [
    { day: 30, events: [{ label: '9a Yoga', color: 'teal', title: 'Yoga', date: 'Mar 30', time: '9:00a – 10:00a', who: 'Trey', location: 'Lifetime Fitness Westminster' }] },
    { day: 31 },
    { day: 1, otherMonth: true, faded: true }, { day: 2, otherMonth: true, faded: true },
    { day: 3, otherMonth: true, faded: true }, { day: 4, otherMonth: true, faded: true }, { day: 5, otherMonth: true, faded: true },
  ],
];

// ── Calendar: week view (Mar 16–22), shared by Home + full Calendar page ──
export const weekDays = [
  { dow: 'Sun', date: 16, hi: 55, lo: 38, wxIcon: '⛅', events: [
    { color: 'purple', time: 'All day', title: 'Spring break', who: null, date: 'Mar 16', fullTime: 'All day', location: 'Jefferson County Schools', notes: 'No school' },
  ]},
  { dow: 'Mon', date: 17, hi: 50, lo: 36, wxIcon: '🌧️', events: [
    { color: 'purple', time: 'All day', title: 'Spring break', who: null, date: 'Mar 17', fullTime: 'All day' },
    { color: 'teal', time: '3:30p', title: 'Kids pickup', who: 'Trey', date: 'Mar 17', fullTime: '3:30p – 4:00p', location: 'Prospect Ridge Academy' },
  ]},
  { dow: 'Tue', date: 18, hi: 53, lo: 37, wxIcon: '⛅', events: [
    { color: 'purple', time: 'All day', title: 'Spring break', who: null, date: 'Mar 18', fullTime: 'All day' },
  ]},
  { dow: 'Wed', date: 19, hi: 56, lo: 40, wxIcon: '🌤️', events: [
    { color: 'purple', time: 'All day', title: 'Spring break', who: null, date: 'Mar 19', fullTime: 'All day' },
    { color: 'teal', time: '10:00a', title: 'Dentist — Emery', who: 'Beryl', date: 'Mar 19', fullTime: '10:00a – 11:00a', location: 'Aspen Dental Westminster', notes: 'Beryl driving' },
  ]},
  { dow: 'Thu', date: 20, today: true, hi: 58, lo: 42, wxIcon: '☀️', events: [
    { color: 'purple', time: 'All day', title: 'Spring break', who: null, date: 'Mar 20', fullTime: 'All day' },
    { color: 'coral', time: '6:00p', title: 'Bowling league', who: 'Trey', date: 'Mar 20', fullTime: '6:00p – 8:30p', location: 'Bowlero Wheat Ridge' },
  ]},
  { dow: 'Fri', date: 21, hi: 62, lo: 45, wxIcon: '⛅', events: [
    { color: 'teal', time: '10:00a', title: 'Soccer — Bryce', who: 'Kids', date: 'Mar 21', fullTime: '10:00a – 11:30a', location: 'Prospect Park Fields', notes: 'Spring season game' },
    { color: 'teal', time: '2:00p', title: 'Dentist — Emery', who: 'Beryl', date: 'Mar 21', fullTime: '2:00p – 3:00p', location: 'Aspen Dental Westminster', notes: 'Beryl driving' },
  ]},
  { dow: 'Sat', date: 22, hi: 54, lo: 40, wxIcon: '🌧️', events: [
    { color: 'purple', time: 'All day', title: 'Easter', who: 'Family', date: 'Mar 22', fullTime: 'All day', location: 'Home' },
  ]},
];

// ── Calendar: "Next 5 days" strip (Home only) ──
export const next5Days = [
  { dow: 'Thu — Today', date: 20, today: true, hi: 58, lo: 42, wxIcon: '☀️', events: [
    { color: 'purple', time: 'All day', title: 'Spring break', who: null, date: 'Mar 20', fullTime: 'All day' },
    { color: 'coral', time: '6:00p', title: 'Bowling league', who: 'Trey', date: 'Mar 20', fullTime: '6:00p – 8:30p', location: 'Bowlero Wheat Ridge' },
  ]},
  { dow: 'Fri', date: 21, hi: 62, lo: 45, wxIcon: '⛅', events: [
    { color: 'teal', time: '10:00a', title: 'Soccer — Bryce', who: 'Kids', date: 'Mar 21', fullTime: '10:00a – 11:30a', location: 'Prospect Park Fields', notes: 'Spring season game' },
    { color: 'teal', time: '2:00p', title: 'Dentist — Emery', who: 'Beryl', date: 'Mar 21', fullTime: '2:00p – 3:00p', location: 'Aspen Dental Westminster', notes: 'Beryl driving' },
  ]},
  { dow: 'Sat', date: 22, hi: 54, lo: 40, wxIcon: '🌧️', events: [
    { color: 'purple', time: 'All day', title: 'Easter', who: 'Family', date: 'Mar 22', fullTime: 'All day', location: 'Home' },
  ]},
  { dow: 'Sun', date: 23, hi: 59, lo: 43, wxIcon: '⛅', events: [] },
  { dow: 'Mon', date: 24, hi: 65, lo: 48, wxIcon: '☀️', events: [
    { color: 'teal', time: '4:00p', title: 'School pick-up', who: 'Trey', date: 'Mar 24', fullTime: '4:00p – 4:30p', location: 'Prospect Ridge Academy' },
  ]},
];

// ── Calendar: agenda list, grouped by day. Home shows the first 3 groups. ──
export const agendaGroups = [
  { day: 'Today — Thu Mar 20', items: [
    { time: '6:00p', color: '#D85A30', title: 'Bowling league', who: 'Trey · Bowlero Wheat Ridge', date: 'Mar 20', fullTime: '6:00p – 8:30p', person: 'Trey', location: 'Bowlero Wheat Ridge' },
  ]},
  { day: 'Fri Mar 21', items: [
    { time: '10:00a', color: 'var(--person-trey)', title: 'Soccer — Bryce', who: 'Kids', date: 'Mar 21', fullTime: '10:00a – 11:30a', person: 'Bryce', location: 'Prospect Park Fields', notes: 'Spring season game' },
    { time: '2:00p', color: 'var(--person-trey)', title: 'Dentist — Emery', who: 'Beryl driving', date: 'Mar 21', fullTime: '2:00p – 3:00p', person: 'Emery', location: 'Aspen Dental Westminster', notes: 'Beryl driving' },
  ]},
  { day: 'Sat Mar 22', items: [
    { time: 'All day', color: 'var(--person-beryl)', title: 'Easter', who: 'Family', date: 'Mar 22', fullTime: 'All day', person: 'Family', location: 'Home' },
  ]},
  { day: 'Mon Mar 24', items: [
    { time: '4:00p', color: 'var(--person-trey)', title: 'School pick-up', who: 'Trey', date: 'Mar 24', fullTime: '4:00p – 4:30p', person: 'Trey', location: 'Prospect Ridge Academy' },
  ]},
  { day: 'Thu Mar 27', items: [
    { time: '6:00p', color: '#D85A30', title: 'Bowling league', who: 'Trey · Bowlero Wheat Ridge', date: 'Mar 27', fullTime: '6:00p – 8:30p', person: 'Trey', location: 'Bowlero Wheat Ridge' },
  ]},
];

// ── Home sidebar ──
export const familySummary = [
  { person: 'trey', next: 'Bowling · 6pm', todos: ['Pick up dry cleaning', 'Research swing set install'] },
  { person: 'beryl', next: 'Dentist run · Fri', todos: ['Schedule HVAC service'] },
  { person: 'bryce', next: 'Soccer · Fri 10a', todos: [] },
  { person: 'emery', next: 'Dentist · Fri 2p', todos: [] },
];

export const homeGroceryTeaser = [
  { text: 'Eggs', done: true },
  { text: 'Bread', done: true },
  { text: 'Milk', done: false },
  { text: 'Apples', done: false },
  { text: 'Chicken thighs', done: false },
  { text: 'Sparkling water', done: false },
];

// ── Tasks ──
export const initialTasks = [
  { id: 't1', text: 'Pick up dry cleaning', person: 'trey', time: 'today', due: 'Due today', done: false },
  { id: 't2', text: 'Schedule HVAC service call', person: 'beryl', time: 'today', due: 'Due today', done: false },
  { id: 't3', text: 'Empty dishwasher', person: 'kids', time: 'today', due: 'Due today', done: false },
  { id: 't4', text: 'Take out recycling', person: 'trey', time: 'today', due: 'Done', done: true },
  { id: 't5', text: 'Research swing set installation', person: 'trey', time: 'week', due: 'Sat Mar 22', done: false },
  { id: 't6', text: 'Pay water bill', person: 'beryl', time: 'week', due: 'Sun Mar 23', done: false },
  { id: 't7', text: 'Return library books', person: 'kids', time: 'week', due: 'Mon Mar 24', done: false },
  { id: 't8', text: 'Get car oil change', person: 'trey', time: 'week', due: 'Fri Mar 28', done: false },
  { id: 't9', text: 'Plan Easter dinner menu', person: 'family', time: 'week', due: 'Sat Mar 22', done: false },
  { id: 't10', text: 'File taxes', person: 'family', time: 'later', due: 'Apr 15', done: false },
  { id: 't11', text: "Bryce's baseball signup", person: 'kids', time: 'later', due: 'Apr 1', done: false },
  { id: 't12', text: 'Schedule summer camp', person: 'beryl', time: 'later', due: 'Apr 10', done: false },
  { id: 't13', text: 'Fix back fence gate', person: 'trey', time: 'later', due: 'Apr 5', done: false },
];

export const taskSectionOrder = ['today', 'week', 'later'];
export const taskSectionLabels = { today: 'Today', week: 'This week', later: 'Coming up' };

// ── Groceries ──
export const initialGroceries = {
  grocery: [
    { id: 'g1', text: 'Apples', done: false }, { id: 'g2', text: 'Baby spinach', done: false },
    { id: 'g3', text: 'Bananas', done: false }, { id: 'g4', text: 'Cherry tomatoes', done: false },
    { id: 'g5', text: 'Eggs', done: true }, { id: 'g6', text: 'Milk (2%)', done: false },
    { id: 'g7', text: 'Shredded cheddar', done: false }, { id: 'g8', text: 'Chicken thighs', done: false },
    { id: 'g9', text: 'Bread', done: true }, { id: 'g10', text: 'Orange juice', done: false },
  ],
  costco: [
    { id: 'c1', text: 'Olive oil (2L)', done: false }, { id: 'c2', text: 'Sparkling water (24pk)', done: false },
    { id: 'c3', text: 'Pasta (5lb bag)', done: false }, { id: 'c4', text: 'Ground beef (3lb)', done: false },
  ],
  other: [
    { id: 'o1', text: 'Dish soap (Target)', done: false }, { id: 'o2', text: 'Kids multivitamins (Target)', done: false },
  ],
};

export const storeLabels = { grocery: 'Grocery store', costco: 'Costco', other: 'Other' };
export const storeIcons = { grocery: '🛒', costco: '📦', other: '🏪' };

export const frequentGroceryItems = ['🥛 Milk', '🥚 Eggs', '🍞 Bread', '🧀 Cheese', '🍌 Bananas', '🐔 Chicken', '💧 Sparkling water', '🍎 Apples', '🍝 Pasta', '🧴 Dish soap'];

// ── Chores ──
export const initialChores = {
  trey: [
    { id: 'ch1', text: 'Take out trash', freq: 'Weekly', done: true },
    { id: 'ch2', text: 'Vacuum living room', freq: 'Weekly', done: true },
    { id: 'ch3', text: 'Mow lawn', freq: 'Weekly', done: true },
    { id: 'ch4', text: 'Clean garage', freq: 'Monthly', done: false },
  ],
  beryl: [
    { id: 'ch5', text: 'Laundry', freq: 'Weekly', done: true },
    { id: 'ch6', text: 'Grocery shopping', freq: 'Weekly', done: true },
    { id: 'ch7', text: 'Clean bathrooms', freq: 'Weekly', done: true },
    { id: 'ch8', text: 'Meal prep', freq: 'Weekly', done: true },
    { id: 'ch9', text: 'Deep clean kitchen', freq: 'Monthly', done: false },
  ],
  bryce: [
    { id: 'ch10', text: 'Make bed', freq: 'Daily', done: true },
    { id: 'ch11', text: 'Empty dishwasher', freq: 'Daily', done: false },
    { id: 'ch12', text: 'Tidy bedroom', freq: 'Weekly', done: false },
    { id: 'ch13', text: 'Feed dog', freq: 'Daily', done: false },
  ],
  emery: [
    { id: 'ch14', text: 'Make bed', freq: 'Daily', done: true },
    { id: 'ch15', text: 'Set dinner table', freq: 'Daily', done: false },
    { id: 'ch16', text: 'Tidy bedroom', freq: 'Weekly', done: false },
    { id: 'ch17', text: 'Water plants', freq: 'Weekly', done: false },
    { id: 'ch18', text: 'Wipe down counters', freq: 'Daily', done: false },
  ],
};

export const choreProgressColors = { trey: '#1D9E75', beryl: '#7F77DD', bryce: '#F0997B', emery: '#AFA9EC' };

// ── Home control ──
export const initialRooms = [
  {
    id: 'living-room', name: 'Living room',
    devices: [
      { id: 'lr-main', name: 'Main lights', icon: '💡', on: true, dimmable: true, brightness: 75 },
      { id: 'lr-lamp', name: 'Floor lamp', icon: '🪔', on: false, dimmable: false },
    ],
    thermostat: { current: 68, set: 70 },
  },
  {
    id: 'kitchen', name: 'Kitchen',
    devices: [
      { id: 'kit-main', name: 'Overhead lights', icon: '💡', on: true, dimmable: true, brightness: 100 },
      { id: 'kit-under', name: 'Under-cabinet', icon: '💡', on: false, dimmable: false },
    ],
  },
  {
    id: 'bedrooms', name: 'Bedrooms',
    devices: [
      { id: 'bed-master', name: 'Primary bedroom', icon: '💡', on: false, dimmable: false },
      { id: 'bed-bryce', name: "Bryce's room", icon: '💡', on: false, dimmable: false },
      { id: 'bed-emery', name: "Emery's room", icon: '💡', on: false, dimmable: false },
    ],
  },
  {
    id: 'garage-exterior', name: 'Garage & exterior',
    garage: { name: 'Garage door', open: true },
    devices: [
      { id: 'ext-front', name: 'Front porch', icon: '💡', on: true, dimmable: false },
      { id: 'ext-back', name: 'Backyard lights', icon: '💡', on: false, dimmable: false },
    ],
    cameras: [
      { id: 'cam-front', name: 'Front doorbell' },
      { id: 'cam-back', name: 'Backyard camera' },
    ],
  },
];

export const scenes = [
  { id: 'normal', icon: '🏠', label: 'Normal' },
  { id: 'evening', icon: '🌙', label: 'Evening' },
  { id: 'movie', icon: '🎬', label: 'Movie mode' },
  { id: 'away', icon: '🚗', label: 'Away' },
  { id: 'sleep', icon: '😴', label: 'Sleep' },
  { id: 'alloff', icon: '⭕', label: 'All lights off' },
];

// ── Weather ──
export const weatherNow = {
  icon: '☀️', temp: 58, desc: 'Sunny', location: 'Westminster, CO',
  feelsLike: 55, high: 58, low: 42,
  humidity: '28%', wind: '9 mph W', uv: '4 Moderate', visibility: '10 mi', sunrise: '6:42a', sunset: '7:28p',
};

export const weatherHourly = [
  { time: 'Now', icon: '☀️', temp: 58, pop: '' },
  { time: '9a', icon: '☀️', temp: 56, pop: '' },
  { time: '10a', icon: '🌤️', temp: 57, pop: '' },
  { time: '11a', icon: '🌤️', temp: 57, pop: '' },
  { time: '12p', icon: '⛅', temp: 57, pop: '10%' },
  { time: '1p', icon: '⛅', temp: 57, pop: '10%' },
  { time: '2p', icon: '⛅', temp: 56, pop: '15%' },
  { time: '3p', icon: '🌥️', temp: 55, pop: '20%' },
  { time: '4p', icon: '🌥️', temp: 54, pop: '20%' },
  { time: '5p', icon: '🌥️', temp: 52, pop: '20%' },
  { time: '6p', icon: '🌧️', temp: 50, pop: '60%' },
  { time: '7p', icon: '🌧️', temp: 48, pop: '65%' },
];

export const weatherDaily = [
  { day: 'Today', name: 'Thursday Mar 20', icon: '☀️', desc: 'Sunny', hi: 58, lo: 42, barWidth: 70, barOffset: 20,
    humidity: '28%', wind: '9 mph W', uv: '4 Moderate', sunrise: '6:42a', sunset: '7:28p',
    hourly: [['6a','☀️','44°',''],['8a','☀️','50°',''],['10a','☀️','56°',''],['12p','⛅','57°','10%'],['2p','⛅','56°','15%'],['4p','🌥️','54°','20%'],['6p','🌧️','50°','60%'],['8p','🌧️','47°','65%']] },
  { day: 'Fri', name: 'Friday Mar 21', icon: '⛅', desc: 'Partly cloudy', hi: 62, lo: 45, barWidth: 75, barOffset: 22,
    humidity: '32%', wind: '12 mph SW', uv: '3 Moderate', sunrise: '6:40a', sunset: '7:29p',
    hourly: [['6a','⛅','46°',''],['8a','⛅','52°',''],['10a','🌤️','58°','5%'],['12p','⛅','61°','10%'],['2p','⛅','62°','15%'],['4p','🌥️','60°','20%'],['6p','🌥️','56°','25%'],['8p','⛅','50°','15%']] },
  { day: 'Sat', name: 'Saturday Mar 22', icon: '🌧️', desc: 'Rain showers', hi: 54, lo: 40, barWidth: 65, barOffset: 18,
    humidity: '65%', wind: '8 mph E', uv: '1 Low', sunrise: '6:39a', sunset: '7:30p',
    hourly: [['6a','🌥️','41°','20%'],['8a','🌧️','44°','55%'],['10a','🌧️','48°','70%'],['12p','🌧️','51°','75%'],['2p','🌧️','53°','70%'],['4p','🌦️','52°','50%'],['6p','⛅','49°','30%'],['8p','⛅','44°','20%']] },
  { day: 'Sun', name: 'Sunday Mar 23', icon: '⛅', desc: 'Partly cloudy', hi: 59, lo: 43, barWidth: 72, barOffset: 20,
    humidity: '40%', wind: '7 mph W', uv: '2 Low', sunrise: '6:38a', sunset: '7:31p',
    hourly: [['6a','⛅','44°',''],['8a','🌤️','48°',''],['10a','🌤️','54°','10%'],['12p','⛅','58°','15%'],['2p','⛅','59°','15%'],['4p','⛅','57°','10%'],['6p','🌤️','53°',''],['8p','🌤️','47°','']] },
  { day: 'Mon', name: 'Monday Mar 24', icon: '☀️', desc: 'Sunny', hi: 65, lo: 48, barWidth: 80, barOffset: 22,
    humidity: '22%', wind: '10 mph SW', uv: '5 Moderate', sunrise: '6:36a', sunset: '7:32p',
    hourly: [['6a','☀️','49°',''],['8a','☀️','54°',''],['10a','☀️','60°',''],['12p','☀️','64°',''],['2p','☀️','65°',''],['4p','🌤️','63°',''],['6p','🌤️','58°',''],['8p','⛅','52°','']] },
  { day: 'Tue', name: 'Tuesday Mar 25', icon: '🌤️', desc: 'Mostly sunny', hi: 67, lo: 50, barWidth: 78, barOffset: 25,
    humidity: '25%', wind: '11 mph W', uv: '5 Moderate', sunrise: '6:35a', sunset: '7:33p',
    hourly: [['6a','🌤️','51°',''],['8a','☀️','56°',''],['10a','☀️','62°',''],['12p','☀️','66°',''],['2p','🌤️','67°','5%'],['4p','🌤️','65°','5%'],['6p','⛅','60°','10%'],['8p','⛅','54°','10%']] },
  { day: 'Wed', name: 'Wednesday Mar 26', icon: '⛅', desc: 'Partly cloudy', hi: 63, lo: 46, barWidth: 74, barOffset: 22,
    humidity: '38%', wind: '9 mph W', uv: '3 Moderate', sunrise: '6:33a', sunset: '7:34p',
    hourly: [['6a','⛅','47°',''],['8a','🌤️','52°',''],['10a','⛅','57°','10%'],['12p','⛅','62°','15%'],['2p','⛅','63°','20%'],['4p','🌥️','61°','25%'],['6p','🌥️','56°','30%'],['8p','🌧️','50°','40%']] },
];

// ── Agent inbox ──
export const agentInbox = [
  { from: 'via email · today 6:14am', msg: '"Add dentist appt for Emery Mar 21 at 2pm" — added to calendar ✓' },
  { from: 'via email · yesterday 9:02pm', msg: '"Add milk to groceries" — added to list ✓' },
];
