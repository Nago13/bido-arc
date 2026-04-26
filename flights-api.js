// flights-api.js
// Mock database of flights for the demo

const FLIGHTS_DB = {
  // US Domestic
  "LAX-NYC": [
    { airline: "Delta",       flightNumber: "DL2412", departure: "07:00", arrival: "15:30", price: 189, duration: "5h 30m" },
    { airline: "United",      flightNumber: "UA1856", departure: "10:15", arrival: "18:45", price: 215, duration: "5h 30m" },
    { airline: "JetBlue",     flightNumber: "B6422",  departure: "14:30", arrival: "23:00", price: 178, duration: "5h 30m" },
    { airline: "American",    flightNumber: "AA1098", departure: "06:00", arrival: "14:35", price: 234, duration: "5h 35m" },
    { airline: "Spirit",      flightNumber: "NK729",  departure: "21:45", arrival: "06:15", price: 142, duration: "5h 30m" }
  ],
  "NYC-LAX": [
    { airline: "Delta",       flightNumber: "DL2413", departure: "08:00", arrival: "11:30", price: 195, duration: "6h 30m" },
    { airline: "United",      flightNumber: "UA1857", departure: "13:00", arrival: "16:30", price: 220, duration: "6h 30m" },
    { airline: "JetBlue",     flightNumber: "B6423",  departure: "17:00", arrival: "20:30", price: 188, duration: "6h 30m" }
  ],
  "SFO-NYC": [
    { airline: "Delta",       flightNumber: "DL3320", departure: "09:00", arrival: "17:30", price: 245, duration: "5h 30m" },
    { airline: "JetBlue",     flightNumber: "B6555",  departure: "16:00", arrival: "00:30", price: 220, duration: "5h 30m" }
  ],

  // International — Brazil
  "GRU-LAX": [
    { airline: "Latam",       flightNumber: "LA8084", departure: "22:30", arrival: "06:15", price: 892, duration: "12h 45m" },
    { airline: "American",    flightNumber: "AA952",  departure: "23:55", arrival: "07:40", price: 945, duration: "12h 45m" },
    { airline: "Delta",       flightNumber: "DL106",  departure: "21:50", arrival: "05:35", price: 968, duration: "12h 45m" },
    { airline: "United",      flightNumber: "UA62",   departure: "23:30", arrival: "07:20", price: 912, duration: "12h 50m" }
  ],
  "GRU-MIA": [
    { airline: "Latam",       flightNumber: "LA8064", departure: "23:55", arrival: "07:30", price: 678, duration: "8h 35m" },
    { airline: "American",    flightNumber: "AA962",  departure: "21:55", arrival: "05:25", price: 712, duration: "8h 30m" }
  ],
  "GRU-NYC": [
    { airline: "Latam",       flightNumber: "LA8180", departure: "22:30", arrival: "07:15", price: 834, duration: "9h 45m" },
    { airline: "Delta",       flightNumber: "DL110",  departure: "23:45", arrival: "08:20", price: 890, duration: "9h 35m" }
  ],

  // International — Europe
  "JFK-LHR": [
    { airline: "British Airways", flightNumber: "BA178", departure: "20:30", arrival: "08:25", price: 612, duration: "6h 55m" },
    { airline: "Virgin Atlantic", flightNumber: "VS4",   departure: "22:30", arrival: "10:15", price: 645, duration: "6h 45m" },
    { airline: "American",        flightNumber: "AA100", departure: "21:20", arrival: "09:10", price: 598, duration: "6h 50m" }
  ],

  // International — Asia
  "LAX-NRT": [
    { airline: "ANA",      flightNumber: "NH105", departure: "11:55", arrival: "16:35", price: 1245, duration: "11h 40m" },
    { airline: "JAL",      flightNumber: "JL61",  departure: "13:25", arrival: "18:00", price: 1198, duration: "11h 35m" },
    { airline: "United",   flightNumber: "UA32",  departure: "12:30", arrival: "17:10", price: 1167, duration: "11h 40m" }
  ]
};

function getFlights(from, to) {
  const key = `${from.toUpperCase()}-${to.toUpperCase()}`;
  return FLIGHTS_DB[key] || [];
}

function getAvailableRoutes() {
  return Object.keys(FLIGHTS_DB);
}

module.exports = { getFlights, getAvailableRoutes };