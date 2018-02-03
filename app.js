'use strict';

const os = require('os');
const cluster = require('cluster');

const grpc = require('grpc');

const CommonImport = require('./util/CommonImport');

/*
 * Constants define.
 */
global.CONSUL = require('microservice-consul');
global.RELATED_MONGODB_COLLECTIONS = {
  usersCollectionName: 'Users',
  groupsCollectionName: 'Groups',
  companiesCollectionName: 'Companies'
};

if (cluster.isMaster) {
  /*
   * The master process should be kept as light as it can be, that is: only do the workers management jobs and some others very necessary jobs.
   */

  const workerPortMap = {};

  const numOfWorkers = os.cpus().length;

  for (var i = 0; i < numOfWorkers; i++) {
    const port = 53547 + i;
    const worker = cluster.fork({
      port: port
    });
    workerPortMap['' + worker.process.pid] = port;
  }

  cluster.on('exit', (worker, code, signal) => {
    const oriKey = '' + worker.process.pid;
    const newWorker = cluster.fork({
      port: workerPortMap[oriKey]
    });
    workerPortMap[newWorker.process.pid] = workerPortMap[oriKey];
    delete workerPortMap[oriKey];
  });

} else {

  /*
   * Here the woker process will always be full featured.
   */

  const buildAuthGrpcServer = () => {
    const authGrpcServer = new grpc.Server();
    const auth = grpc.load({root: CommonImport.protos.root, file: CommonImport.protos.auth}).microservice.auth;
    
    authGrpcServer.addService(auth.Auth.service, {
      healthCheck: CommonImport.utils.healthCheck,
      verifyEmailV1: require('./api/v1/VerifyEmailImpl').verifyEmail,
      signInV1: require('./api/v1/SignInImpl').signIn,
      exchangeTokenV1: require('./api/v1/ExchangeTokenImpl').exchangeToken,
      
    });
    return authGrpcServer;
  };

  CommonImport.Promise.join(
    require('microservice-mongodb-conn-pools')(global.CONSUL.keys.mongodbGate).then((dbPools) => {
      return dbPools;
    }),
    require('microservice-email')(global.CONSUL.keys.emailGate).then((mailerPool) => {
      return mailerPool;
    }),
    CommonImport.utils.pickRandomly(global.CONSUL.agents).kv.get(global.CONSUL.keys['jwtGate']),
    CommonImport.utils.pickRandomly(global.CONSUL.agents).kv.get(global.CONSUL.keys['godSaidSo']),
    buildAuthGrpcServer(),
    (dbPools, mailerPool, jwtGateOpts, godSaidSo, authGrpcServer) => {
      if (dbPools.length === 0) {
        throw new Error('None of the mongodb servers is available.');
      }
      if (mailerPool.length === 0) {
        throw new Error('None of the email servers is available.');
      }
      if (!jwtGateOpts) {
        throw new Error('Invalid gate JWT configurations.');
      }
      if (!godSaidSo) {
        throw new Error('Invalid god said so.');
      }

      global.DB_POOLS = dbPools;
      global.MAILER_POOL = mailerPool;
      global.JWT_GATE_OPTS = JSON.parse(jwtGateOpts.Value);
      global.GOD_SAID_SO = JSON.parse(godSaidSo.Value);

      /********************************************************** Start: for zipkin. **********************************************************/

      const zipkinBaseUrl = `http://${process.env.MS_SERVICE_TAG.indexOf('localhost') == -1 ?
                                        'zipkin_server_0:9411' : 'micro02.sgdev.vcube.com:64800'}`;

      /*
       * 'zipkin-context-cls' implements a context API on top of
       * 'CLS/continuation-local-storage(https://github.com/othiym23/node-continuation-local-storage)'.
       *
       * The primary objective of CLS is to implement a transparent context API, that is: you don't need to pass around a ctx variable everywhere
       * in your application code.
       *
       * A note on CLS context vs. explicit context:
       *   There are known issues and limitations with CLS, so some people might prefer to use `ExplicitContext` instead;
       *   the drawback then is that you have to pass around a context object manually.
       */
      const CLSContext = require('zipkin-context-cls');

      const {Tracer, BatchRecorder, ConsoleRecorder} = require('zipkin');
      const {HttpLogger} = require('zipkin-transport-http');

      const recorder = new BatchRecorder({
        logger: new HttpLogger({
          endpoint: `${zipkinBaseUrl}/api/v1/spans`
        })
      });

      // `ConsoleRecorder` will be very helpful when you want to debug where is going wrong.
      // const recorder = new ConsoleRecorder();

      const ctxImpl = new CLSContext('zipkin');

      const tracer = new Tracer({ctxImpl, recorder});

      global.ZIPKIN_GRPC_INTCP = new (require('zipkin-instrumentation-grpc'))(tracer);

      /********************************************************** End: for zipkin. **********************************************************/

      authGrpcServer.bind('0.0.0.0:' + process.env.port, grpc.ServerCredentials.createInsecure());
      authGrpcServer.start();
    }
  );
  
}


