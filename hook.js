/* Worker process to notify a given webhook of transaction success */
const fetch = require('node-fetch');

process.on('message', function(m) {
  console.log("Message received!");
  fetch(m.hookUrl, {
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    },
    body: JSON.stringify(m.tx)
  }).then(function() {
    // Great! We're done
    process.exit();
  });
});
