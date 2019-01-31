const Promise = require('bluebird');
const redis = require('./redis');
const client = require('./client');

// redis.flushall();

const getLastDailyJackpot = () => redis.getAsync('last_daily_jackpot');

const setLastDailyJackpot = (date) => redis.setAsync('last_daily_jackpot', date);

const getLastHourlyJackpot = () => redis.getAsync('last_hourly_jackpot');

const setLastHourlyJackpot = (hours) => redis.setAsync('last_hourly_jackpot', hours);

const processDailyJackpot = () => Promise.delay(1000 * 60 * 2);

const processHourlyJackpot = () => Promise.delay(1000 * 60 * 2);

module.exports = {
  getLastDailyJackpot,
  setLastDailyJackpot,
  getLastHourlyJackpot,
  setLastHourlyJackpot,
  processDailyJackpot,
  processHourlyJackpot,
};
