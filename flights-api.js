// flights-api.js
// Mock database of flights for the demo

const FLIGHTS_DB = {
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