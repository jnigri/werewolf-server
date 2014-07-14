var _ = require('lodash'),
Q = require("Q"),
log;

var Server = function(options) {
  var defaults = {
    verbose: false,
    debug: false,
    displayTime: true
  };
  this.settings = _.extend(defaults, options);
  this.clients = [];
  this.users = [];
  this.games = [];
  log = require('./misc/log.js')().setOptions({
    displayTime: this.settings.displayTime,
    verbose: this.settings.verbose,
    debug: this.settings.debug
  });
};

Server.prototype.displayTitle = function () {
  log.base(" _     _  _______  ______    _______  _     _  _______  ___      _______ ");
  log.base("| | _ | ||       ||    _ |  |       || | _ | ||       ||   |    |       |");
  log.base("| || || ||    ___||   | ||  |    ___|| || || ||   _   ||   |    |    ___|");
  log.base("|       ||   |___ |   |_||_ |   |___ |       ||  | |  ||   |    |   |___ ");
  log.base("|       ||    ___||    __  ||    ___||       ||  |_|  ||   |___ |    ___|");
  log.base("|   _   ||   |___ |   |  | ||   |___ |   _   ||       ||       ||   |    ");
  log.base("|__| |__||_______||___|  |_||_______||__| |__||_______||_______||___|    ");
  log.base(" _______  _______  ______    __   __  _______  ______                    ");
  log.base("|       ||       ||    _ |  |  | |  ||       ||    _ |                   ");
  log.base("|  _____||    ___||   | ||  |  |_|  ||    ___||   | ||                   ");
  log.base("| |_____ |   |___ |   |_||_ |       ||   |___ |   |_||_                  ");
  log.base("|_____  ||    ___||    __  ||       ||    ___||    __  |                 ");
  log.base(" _____| ||   |___ |   |  | | |     | |   |___ |   |  | |                 ");
  log.base("|_______||_______||___|  |_|  |___|  |_______||___|  |_|       ");
  log.base("");
};

Server.prototype.start = function () {
  this.displayTitle();
  log.info("welcome");
  log.info("[svr] starting");
  this.initializeDb();
  this.startSocketServer();
};

Server.prototype.stop = function () {
  log.info("[svr] stopping");
  _(this.clients).forEach(function(client) {
    client.disconnect();
  });
  this.http.close();
  log.info("[mdb] stopping");
  this.mongo.close();
  log.info("byebye");
};

Server.prototype.initializeDb = function () {
  log.info("[mdb] initilizing");
  var easyMongo = require('easymongo');
  this.mongo = new easyMongo({
    dbname: this.settings.dbname,
    host: this.settings.dbhost,
    port: this.settings.dbport
  });
};

Server.prototype.startSocketServer = function () {
  log.info("[sio] starting");
  this.app = require('express')();
  this.http = require('http').Server(this.app);
  this.io = require('socket.io')(this.http);

  this.io.on('connection', _.bind(this.onConnection, this));

  this.http.listen(this.settings.socketport, _.bind(function(){
    log.info('[sio] listening on port ' + this.settings.socketport);
  }, this));
  this.clients = [];
  this.users = [];
  this.games = [];
};

Server.prototype.getClientInfo = function (socket) {
  var addr = socket.handshake.address;
  if (addr) {
    return addr.address + ":" + addr.port;
  } else {
    return "test client";
  }
};

Server.prototype.onConnection = function (socket) {
  log.info("[usr] '" + this.getClientInfo(socket) + "' trying to connect");
  if (!_(this.clients).contains(socket)) {
    log.info("[usr] '" + this.getClientInfo(socket) + "' connected");
    this.clients.push(socket);
    this.on(socket, 'sign_up', require('./connection/signUp').signUp, _.bind(this.onLobby, this));
    this.on(socket, 'sign_in', require('./connection/signIn').signIn, _.bind(this.onLobby, this));
  } else {
    log.info("[usr] '" + this.getClientInfo(socket) + "' already connected");
  }
};

Server.prototype.onLobby = function(user) {
  if (!this.users[user.data.username]) {
    log.info("[usr] '" + user.data.username + "' (" + this.getClientInfo(user.socket) + ") entering the lobby");
    user.rolesLoaded = false;
    this.users[user.data.username] = user;
    this.on(user, 'list_roles', require('./lobby/listRoles').listRoles);
    this.on(user, 'create_game', require('./lobby/createGame').createGame, this.games);
    // this.on(user.socket, 'list_games', require('./lobby/listGames').listGames, this.games);
    // this.on(user.socket, 'join_game', require('./lobby/joinGame').joinGame, {games: this.games, callback: _.bind(this.onGame, this)});
    // this.on(user.socket, 'leave_game', require('./lobby/leaveGame').leaveGame, this.games);
  } else {
    // log.info("[usr] '" + user.data.username + "' (" + this.getClientInfo(user.socket) + ") already in lobby");
    // user.socket.disconnect();
  }
};

Server.prototype.onGame = function(user, game) {
  log.error("user connected Oo");
};

Server.prototype.on = function (client, actionName, func, additionalData) {
  // client can be the identified user, or (if not identified yet) the socket
  var socket = client.socket ? client.socket : client;

  socket.on(actionName, _.bind(function(data) {
    log.input("[usr] '" + this.getClientInfo(socket) + "' " + actionName, "\ndata:\n ", data);
    func(data, client, this.mongo, additionalData);
  }, this));
};

module.exports = Server;