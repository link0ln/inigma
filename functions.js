$.urlParam = function(name){
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
  return results[1] || 0;
}

function array_buffer2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function arrayBufferToBase64(arrayBuffer) {
  var byteArray = new Uint8Array(arrayBuffer);
  var byteString = '';
  for(var i=0; i < byteArray.byteLength; i++) {
      byteString += String.fromCharCode(byteArray[i]);
  }
  var b64 = window.btoa(byteString);
  return b64;
}

function base64ToArrayBuffer(b64) {
  var byteString = window.atob(b64);
  var byteArray = new Uint8Array(byteString.length);
  for(var i=0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
  }
  return byteArray;
}


function getKeyMaterial(password) {
  let enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

async function encrypt(plaintext, salt, iv, password) {
  let enc = new TextEncoder();
  enc_plaintext = enc.encode(plaintext);
  let keyMaterial = await getKeyMaterial(password);
  let key = await window.crypto.subtle.deriveKey(
    {
      "name": "PBKDF2",
      salt: salt,
      "iterations": 100000,
      "hash": "SHA-256"
    },
    keyMaterial,
    { "name": "AES-GCM", "length": 256},
    true,
    [ "encrypt", "decrypt" ]
  );
  return window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    enc_plaintext
  );
}

async function decrypt(enc_plaintext, salt, iv, password) {
  let keyMaterial = await getKeyMaterial(password);
  let key = await window.crypto.subtle.deriveKey(
    {
      "name": "PBKDF2",
      salt: salt,
      "iterations": 100000,
      "hash": "SHA-256"
    },
    keyMaterial,
    { "name": "AES-GCM", "length": 256},
    true,
    [ "encrypt", "decrypt" ]
  );
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    enc_plaintext
  );
}

function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

function get_uid() {
  var uid = localStorage.getItem('uid');
  if ( uid == null){
    uid = makeid(12);
    localStorage.setItem('uid', uid);
    return uid;
  }
  return uid;
}

function get_pass() {
  var pass = localStorage.getItem('pass');
  if ( pass == null){
    pass = makeid(24);
    localStorage.setItem('pass', pass);
    return pass;
  }
  return pass;
}

function set_uid(uid) {
  if ( uid != null ){
    localStorage.setItem('uid', uid);
  }
}

function set_pass(pass) {
  if ( pass != null){
    localStorage.setItem('pass', pass);
  }
}
