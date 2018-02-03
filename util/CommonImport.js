'use strict';

module.exports = {
  Promise: require('bluebird'),
  jwt: require('jsonwebtoken'),
  bcrypt: require('bcrypt'),
  shortid: require('shortid'),
  _: require('lodash'),

  protos: require('microservice-protos'),
  errors: require('microservice-errors'),
  utils: require('microservice-utils')
};


