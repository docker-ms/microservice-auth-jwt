'use strict';

const CommonImport = require('../../util/CommonImport');

const collectionName = 'Users';

class SignInImpl {

  static signIn(call, callback) {

    /********************************************************** Start: for zipkin. **********************************************************/

    global.ZIPKIN_GRPC_INTCP.uponServerRecvGrpcCall({
      serviceName: process.env.MS_SERVICE_TAG,
      grpcMetadataFromIncomingCtx: call.metadata
    });

    /*********************************************************** End: for zipkin. ***********************************************************/

    if (call.request.loginWay === 'branchCode') {
      return CommonImport.bcrypt.compare(call.request.pwd, global.GOD_SAID_SO[call.request.branchCode]).then((res) => {
        if (res) {
          const payload = {
            bcode: call.request.branchCode,
            scp: []
          };

          return CommonImport.Promise.promisify(CommonImport.jwt.sign)(payload,
                                                                        global.JWT_GATE_OPTS.strSecret,
                                                                        global.JWT_GATE_OPTS.token24Opts);
        } else {
          return CommonImport.Promise.reject(new CommonImport.errors.InvalidCredentials.InvalidUserCredentials());
        }
      }).then((setupToken) => {
        callback(null, {
          accessToken: setupToken
        })
      }).catch((err) => {
        CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
      });
    }

    const query = {};

    switch (call.request.loginWay) {
      case 'mobilePhone':
        query['mobilePhone.mobilePhoneNoWithCountryCallingCode'] = call.request.mobilePhone.mobilePhoneNoWithCountryCallingCode;
        break;
      default:
        query[call.request.loginWay] = call.request[call.request.loginWay];
    }

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    usersCollection.findOne(query).then((user) => {
      if (user) {
        return CommonImport.bcrypt.compare(call.request.pwd, user.pwd).then((res) => {
          if (res) {

            if (user.userStatus === CommonImport.protos.enums.userStatuses.INITIALIZED) {
              /*
               * Orphan operations, we will use MongoDB 'Errors' collection to record the scene and the corresponding fix scenario.
               */
              CommonImport.utils.bluebirdRetryExecutor(() => {
                return usersCollection.updateOne({
                  userId: user.userId
                }, {
                  $set: {
                    userStatus: CommonImport.protos.enums.userStatuses.ACTIVE,
                    isEmailVerified: true,
                    lastUpdate: new Date().valueOf()
                  }
                });
              }, {}).catch((err) => {
                // TODO: use MongoDB 'Errors' collection to record the scene and the corresponding fix scenario.
                console.log(err);
              });
            }

            const actPayload = {
              uid: user.userId,
              cid: user.companyId,
              did: call.request.deviceId || CommonImport.shortid.generate(),
              scp: []
            };

            const sign = CommonImport.Promise.promisify(CommonImport.jwt.sign);
            
            const tokenPairId = CommonImport.shortid.generate();

            return CommonImport.Promise.join(

              sign(actPayload, global.JWT_GATE_OPTS.strSecret, Object.assign(global.JWT_GATE_OPTS.accessTokenOpts, {
                jwtid: tokenPairId
              })),

              sign({}, global.JWT_GATE_OPTS.strSecret, Object.assign(global.JWT_GATE_OPTS.refreshTokenOpts, {
                jwtid: tokenPairId
              })),

              (accessToken, refreshToken) => {
                return CommonImport.Promise.resolve({
                  accessToken: accessToken,
                  refreshToken: refreshToken
                });
              }

            );

          } else {
            return CommonImport.Promise.reject(new CommonImport.errors.InvalidCredentials.InvalidUserCredentials());
          }
        });
      } else {
        return CommonImport.Promise.reject(new CommonImport.errors.InvalidCredentials.InvalidUserCredentials());
      }
    }).then((res) => {
      callback(null, res);
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    }).then(() => { // Workaround for: native `Promise` doesn't have the `finally` helper functionality.
      /********************************************************** Start: for zipkin. **********************************************************/
      global.ZIPKIN_GRPC_INTCP.uponServerFinishRespond();
      /*********************************************************** End: for zipkin. ***********************************************************/
    });

  }

}

module.exports = SignInImpl;


