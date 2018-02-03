'use strict';

const CommonImport = require('../../util/CommonImport');

class ExchangeTokenImpl {

  static exchangeToken(call, callback) {
    const consulAgent = CommonImport.utils.pickRandomly(global.CONSUL_AGENTS);

    const decodedAccessToken = CommonImport.jwt.decode(call.request.access_token);
    const decodedRefreshToken = CommonImport.jwt.decode(call.request.refresh_token);

    const utcNow = Math.floor(Date.now() / 1000);

    if (decodedAccessToken.exp - utcNow > CommonImport.JWT_EXCHANGE_WINDOW) {
      // Blacklist this token pair.
      consulAgent.kv.set(decodedRefreshToken.jti, '' + decodedRefreshToken.exp).then((res) => {
        if (res) {
          throw CommonImport.errors.client.InvalidTokens;
        }
      }, (err) => {
        // TODO?
        throw err;
      });
    } else {
      CommonImport.Promise.promisify(consulAgent.kv.get)(decodedRefreshToken.jti).then((res) => {
        if (res) {
          // This token pair was in our blacklist.
          throw CommonImport.errors.client.InvalidTokens;
        } else {
          // Ok for issuing new token pair.
          const payload = {
            uid: decodedRefreshToken.uid,
            cid: decodedRefreshToken.cid,
            scp: decodedRefreshToken.scp
          };

          const sign = CommonImport.Promise.promisify(CommonImport.jwt.sign);

          return sign(payload, global.JWT_SECRET, Object.assign(CommonImport.JWT_ACCESS_TOKEN_OPTS, {
            jwtid: decodedRefreshToken.jti
          }));
        }
      }).then((newAccessToken) => {
        callback(null, {
          access_token: newAccessToken,
          refresh_token: call.request.refresh_token
        });
      }).catch((err) => {
        // TODO?
        throw err;
      });
    }
  }

}

module.exports = ExchangeTokenImpl;


