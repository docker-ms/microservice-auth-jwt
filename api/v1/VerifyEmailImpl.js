'use strict';

const CommonImport = require('../../util/CommonImport');

class VerifyEmailImpl {

  static verifyEmail(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);

    let collection;
    switch (call.request.verificationType) {
      case 'isCompany':
        collection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.companiesCollectionName);
        break;
    }

    CommonImport.utils.bluebirdRetryExecutor(() => {
      return collection.findOneAndUpdate({
        email: call.request.email
      }, {
        $set: {
          isEmailVerified: true,
          lastUpdate: new Date().getTime()
        }
      }, {
        projection: {
          isEmailVerified: 1
        }
      });
    }, {}).then((res) => {
      if (res.ok) {
        if (res.value) {
          if (res.value.isEmailVerified) {
            return CommonImport.Promise.reject(new CommonImport.errors.VerificationError.EmailAlreadyVerified());
          } else {
            callback(null, {success: true});
          }
        } else {
          return CommonImport.Promise.reject(new CommonImport.errors.VerificationError.InvalidCompany());
        }
      } else {
        return CommonImport.Promise.reject(new CommonImport.errors.UnknownError());
      }
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = VerifyEmailImpl;


