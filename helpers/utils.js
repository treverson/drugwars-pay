const Promise = require('bluebird');
const redis = require('./redis');
const client = require('./client');

redis.flushall();

const getLastJackpotDate = () => redis.getAsync('last_jackpot_date');

const setLastJackpotDate = (date) => redis.setAsync('last_jackpot_date', date);

const getLastJackpotHours = () => redis.getAsync('last_jackpot_hours');

const setLastJackpotHours = (hours) => redis.setAsync('last_jackpot_hours', hours);

const processDailyJackpot = () => Promise.delay(5000);

const processHourlyJackpot = () => Promise.delay(5000);

module.exports = {
  getLastJackpotDate,
  setLastJackpotDate,
  getLastJackpotHours,
  setLastJackpotHours,
  processDailyJackpot,
  processHourlyJackpot,
};
