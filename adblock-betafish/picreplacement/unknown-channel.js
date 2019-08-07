
// Empty Channel
// Subclass of Channel.
//
// Allows the Sync process to create an new named Channel
// when the sync process recieves a request with a unknown channel name
function UnknownChannel() {
  Channel.call(this);
};
UnknownChannel.prototype = {
  __proto__: Channel.prototype,

  _getLatestListings: function(callback) {
    callback([]);
  }
};

Object.assign(window, {
  UnknownChannel
});