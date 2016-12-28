var cassandra = require('cassandra-driver');

module.exports = new cassandra.Client({contactPoints: ['146.148.106.33'], keyspace: 'asimtest'});
