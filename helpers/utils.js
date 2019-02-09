const Promise = require('bluebird');
const { PrivateKey } = require('dsteem');
const redis = require('./redis');
const db = require('./db');
const client = require('./client');

const username = process.env.STEEM_USERNAME;
const privateKey = process.env.STEEM_WIF;
const pay = parseInt(process.env.PAYMENT) || 0;
const payPercentProd = parseFloat(process.env.PAYMENT_PERCENT_PROD) || 1;
const payPercentBurn = parseFloat(process.env.PAYMENT_PERCENT_BURN) || 1;
const memoProd = 'Here is your cut';
const memoBurn = 'Got that for you';

// redis.flushall();

const getLastPayment = () => redis.getAsync('last_payment');

const setLastPayment = (date) => redis.setAsync('last_payment', date);

const processPayments = () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM users ORDER BY drug_production_rate DESC; \n\
      SELECT SUM(drug_production_rate) AS totalProd FROM users; \n\
      SELECT * FROM heist ORDER BY drugs DESC; \n\
      SELECT SUM(drugs) AS totalBurn FROM heist';

    Promise.all([
      db.queryAsync(query),
      client.database.getAccounts([username]),
    ]).then(result => {
      const ops = [];
      let body = '';

      /** Create transfer ops based on prod rate */
      body += '\n\nHere is the drug production rate payroll:\n\n';
      const totalPotProd = parseFloat(result[1][0].balance) / 100 * payPercentProd;
      const totalProd = result[0][1][0].totalProd;
      result[0][0].forEach(user => {
        const amount = parseFloat(totalPotProd / totalProd * user.drug_production_rate).toFixed(3);
        if (amount >= 0.001) {
          body += `@${user.username} +${amount} STEEM \n`;
          ops.push(['transfer', {
            from: username,
            to: user.username,
            amount: `${amount} STEEM`,
            memo: memoProd,
          }]);
        }
      });

      /** Create transfer ops based on heist */
      body += '\n\nHere is the heist payroll:\n\n';
      const totalBurnProd = parseFloat(result[1][0].balance) / 100 * payPercentBurn;
      const totalBurn = result[0][3][0].totalBurn;
      result[0][2].forEach(user => {
        const amount = parseFloat(totalBurnProd / totalBurn * user.drugs).toFixed(3);
        if (amount >= 0.001 && user.username) {
          body += `@${user.username} +${amount} STEEM \n`;
          ops.push(['transfer', {
            from: username,
            to: user.username,
            amount: `${amount} STEEM`,
            memo: memoBurn,
          }]);
        }
      });

      /** Create post op */
      const post = [['comment', {
        parent_author: '',
        parent_permlink: 'drugwars',
        author: username,
        permlink: `drugwars-pay-${new Date().getTime()}`,
        title: 'Daily payroll',
        body,
        json_metadata: JSON.stringify({}),
      }]];

      /** Broadcast transfers and post */
      if (pay) {
        client.broadcast.sendOperations(ops, PrivateKey.fromString(privateKey)).then(result => {
          console.log('Broadcast transfers done', result);
          client.broadcast.sendOperations(post, PrivateKey.fromString(privateKey)).then(result => {
            console.log('Broadcast article done', result);
            resolve();
          }).catch(err => {
            console.error('Broadcast article failed', err);
            reject();
          });
        }).catch(err => {
          console.error('Broadcast transfers failed', err);
          reject();
        });
      } else {
        console.log('Payment disabled');
        resolve();
      }

    }).catch(err => {
      console.error('Process loading data failed', err);
      reject();
    });
  });
};

module.exports = {
  getLastPayment,
  setLastPayment,
  processPayments,
};
