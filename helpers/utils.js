const Promise = require('bluebird');
const { PrivateKey } = require('dsteem');
const redis = require('./redis');
const db = require('./db');
const client = require('./client');

const username = process.env.STEEM_USERNAME;
const privateKey = process.env.STEEM_WIF;
const pay = process.env.PAYMENT || false;
const payPercent = process.env.PAYMENT_PERCENT || 1;
const memo = 'Here is your cut';

// redis.flushall();

const getLastProdPayment = () => redis.getAsync('last_prod_payment');

const setLastProdPayment = (date) => redis.setAsync('last_prod_payment', date);

const getLastBurnPayment = () => redis.getAsync('last_burn_payment');

const setLastBurnPayment = (hours) => redis.setAsync('last_burn_payment', hours);

const processProdPayment = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM `character`; \n\
      SELECT SUM(drug_production_rate) AS totalProd FROM `character`';
    Promise.all([
      db.queryAsync(query),
      client.database.getAccounts([username]),
    ]).then(result => {
      const totalAmount = parseFloat(result[1][0].balance) / 100 * payPercent;
      const totalProd = result[0][1][0].totalProd;
      const ops = [];
      result[0][0].forEach(user => {
        const amount = parseFloat(totalAmount / totalProd * user.drug_production_rate).toFixed(3);
        if (amount >= 0.001) {
          ops.push(['transfer', {
            from: username,
            to: user.name,
            amount: `${amount} STEEM`,
            memo,
          }]);
        }
      });
      if (pay) {
        client.broadcast.sendOperations(ops, PrivateKey.fromString(privateKey)).then(result => {
          console.log('prod-pool: Broadcast transfers done', result);
          resolve();
        }).catch(err => {
          console.error('prod-pool: Broadcast transfers failed', err);
          reject();
        });
      } else {
        console.log('prod-pool: Payment disabled');
        resolve();
      }
    }).catch(err => {
      console.error('prod-pool: Process loading data failed', err);
      reject();
    });
  });
};

const processBurnPayment = () => Promise.delay(100);

module.exports = {
  getLastProdPayment,
  setLastProdPayment,
  getLastBurnPayment,
  setLastBurnPayment,
  processProdPayment,
  processBurnPayment,
};
